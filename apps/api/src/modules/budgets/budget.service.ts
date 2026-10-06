import mongoose from 'mongoose';
import { formatMoney, type BudgetProgressDTO, type OwnerType } from '@expense/shared';
import { periodRange } from '../../lib/dates';
import { Category } from '../categories/category.model';
import { notify } from '../notifications/notification.service';
import { Room, RoomExpense, RoomMember } from '../rooms/room.models';
import { Transaction } from '../transactions/transaction.model';
import { User } from '../users/user.model';
import { Budget, toBudgetDTO, type BudgetAttrs } from './budget.model';

type BudgetLean = BudgetAttrs & { _id: unknown };

const spentInRange = async (budget: BudgetLean, start: Date, end: Date): Promise<number> => {
  const ownerId = new mongoose.Types.ObjectId(String(budget.ownerId));
  const categoryMatch = budget.categoryId ? { categoryId: new mongoose.Types.ObjectId(String(budget.categoryId)) } : {};
  const Model = budget.ownerType === 'user' ? Transaction : RoomExpense;
  const match =
    budget.ownerType === 'user'
      ? { userId: ownerId, type: 'expense', deletedAt: null, binnedAt: null, occurredAt: { $gte: start, $lte: end }, ...categoryMatch }
      : { roomId: ownerId, deletedAt: null, occurredAt: { $gte: start, $lte: end }, ...categoryMatch };
  const [row] = await (Model as typeof Transaction).aggregate<{ total: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return row?.total ?? 0;
};

export const computeProgress = async (budget: BudgetLean, tz: string | null | undefined, ref = new Date()): Promise<BudgetProgressDTO> => {
  const { start, end } = periodRange(budget.period as BudgetProgressDTO['period'], tz, ref, budget);
  let limit = budget.amount;
  if (budget.rollover && budget.period !== 'custom') {
    // Unspent money from the previous period carries over (overspend does not reduce the new limit).
    const prev = periodRange(budget.period as BudgetProgressDTO['period'], tz, new Date(start.getTime() - 1));
    const prevSpent = await spentInRange(budget, prev.start, prev.end);
    limit += Math.max(0, budget.amount - prevSpent);
  }
  const spent = await spentInRange(budget, start, end);
  return {
    ...toBudgetDTO(budget),
    amount: limit,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    spent,
    remaining: limit - spent,
    percent: limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0,
  };
};

export const listBudgetProgress = async (ownerType: OwnerType, ownerId: unknown, tz?: string | null) => {
  const budgets = await Budget.find({ ownerType, ownerId, deletedAt: null }).sort({ categoryId: 1, createdAt: 1 }).lean();
  return Promise.all(budgets.map((b) => computeProgress(b, tz)));
};

/**
 * Fires a notification the first time spending crosses each threshold in a period.
 * Markers are "<periodStart>:<threshold>", so a new month starts with a clean slate.
 */
export const checkBudgetAlerts = async (ownerType: OwnerType, ownerId: string) => {
  const budgets = await Budget.find({ ownerType, ownerId, deletedAt: null });
  if (budgets.length === 0) return;

  let tz: string | undefined;
  let recipients: string[];
  let currency: string;
  let label: string;
  if (ownerType === 'user') {
    const user = await User.findById(ownerId).select('timezone defaultCurrency').lean();
    if (!user) return;
    tz = user.timezone;
    currency = user.defaultCurrency;
    recipients = [ownerId];
    label = 'Your';
  } else {
    const room = await Room.findById(ownerId).select('name currency').lean();
    if (!room) return;
    currency = room.currency;
    recipients = (await RoomMember.find({ roomId: ownerId, status: 'active' }).select('userId').lean()).map((m) => String(m.userId));
    label = `${room.name}:`;
  }

  for (const budget of budgets) {
    const progress = await computeProgress(budget.toObject(), tz);
    const crossed = [...budget.alertThresholds].sort((a, b) => b - a).find((t) => progress.percent >= t);
    if (crossed === undefined) continue;
    const marker = `${progress.periodStart}:${crossed}`;
    if (budget.notifiedThresholds.includes(marker)) continue;

    // Claim the alert atomically: the post-write check and the cron sweep can race.
    // Lower thresholds are marked too, so a jump from 50% to 120% sends one alert, not two.
    const markers = budget.alertThresholds.filter((t) => t <= crossed).map((t) => `${progress.periodStart}:${t}`);
    const claim = await Budget.updateOne(
      { _id: budget._id, notifiedThresholds: { $ne: marker } },
      { $push: { notifiedThresholds: { $each: markers, $slice: -50 } } },
    );
    if (claim.modifiedCount === 0) continue;

    const category = budget.categoryId ? await Category.findById(budget.categoryId).select('name').lean() : null;
    const what = category ? `${category.name} budget` : `${budget.period} budget`;
    const over = progress.percent >= 100;
    await notify({
      userIds: recipients,
      type: 'budget_threshold',
      title: over ? 'Budget exceeded' : 'Budget alert',
      body: over
        ? `${label} ${what} is over by ${formatMoney(-progress.remaining, currency)}`
        : `${label} ${what} is at ${Math.floor(progress.percent)}%. ${formatMoney(progress.remaining, currency)} left.`,
      data: { budgetId: String(budget._id), ...(ownerType === 'room' ? { roomId: ownerId } : {}) },
      pref: 'budgetAlerts',
    });
  }
};
