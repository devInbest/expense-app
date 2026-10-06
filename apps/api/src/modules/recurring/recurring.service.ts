import { formatMoney } from '@expense/shared';
import { inTz, nextOccurrence } from '../../lib/dates';
import { notify } from '../notifications/notification.service';
import { Transaction } from '../transactions/transaction.model';
import { User } from '../users/user.model';
import { RecurringRule } from './recurring.model';

/** Bounds catch-up after downtime (or a past start date) so one run cannot flood a user. */
const MAX_CATCH_UP = 12;

/**
 * Creates due transactions for every active rule. The clientId is derived from rule + run date,
 * so if the job crashes mid-way and reruns, it does not create duplicates.
 */
export const runRecurringRules = async (now = new Date()) => {
  let created = 0;
  const due = await RecurringRule.find({ active: true, deletedAt: null, ownerType: 'user', nextRunAt: { $lte: now } }).limit(500);

  for (const rule of due) {
    const user = await User.findById(rule.ownerId).select('status timezone defaultCurrency').lean();
    if (!user || user.status !== 'active') {
      rule.active = false;
      await rule.save();
      continue;
    }

    let runs = 0;
    let lastAmount = 0;
    while (rule.nextRunAt <= now && runs < MAX_CATCH_UP) {
      if (rule.endDate && rule.nextRunAt > rule.endDate) {
        rule.active = false;
        break;
      }
      const runKey = inTz(rule.nextRunAt, user.timezone).format('YYYYMMDD');
      const clientId = `rec_${rule._id}_${runKey}`;
      const result = await Transaction.updateOne(
        { userId: rule.ownerId, clientId },
        {
          $setOnInsert: {
            userId: rule.ownerId,
            clientId,
            type: rule.template!.type,
            amount: rule.template!.amount,
            currency: user.defaultCurrency,
            categoryId: rule.template!.categoryId,
            note: rule.template!.note,
            paymentMethod: rule.template!.paymentMethod,
            occurredAt: rule.nextRunAt,
            recurringId: rule._id,
            clientUpdatedAt: new Date(),
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount) {
        created += 1;
        lastAmount = rule.template!.amount;
      }
      rule.lastRunAt = rule.nextRunAt;
      rule.nextRunAt = nextOccurrence(rule.nextRunAt, rule.frequency as 'monthly', rule.interval, rule.anchorDay ?? undefined, user.timezone);
      runs += 1;
    }
    if (rule.endDate && rule.nextRunAt > rule.endDate) rule.active = false;
    await rule.save();

    if (lastAmount) {
      await notify({
        userIds: [String(rule.ownerId)],
        type: 'recurring_created',
        title: 'Recurring entry added',
        body: `${rule.template!.note || 'A recurring entry'} of ${formatMoney(lastAmount, user.defaultCurrency)} was added${runs > 1 ? ` (${runs} entries)` : ''}`,
        data: { recurringId: String(rule._id) },
        pref: 'recurringReminders',
      });
    }
  }
  return created;
};
