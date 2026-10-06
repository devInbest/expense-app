import { dayjs, utcDateKey } from '../../lib/dates';
import { AppEvent } from '../events/appEvent.model';
import { Room, RoomExpense, Settlement } from '../rooms/room.models';
import { Transaction } from '../transactions/transaction.model';
import { User } from '../users/user.model';
import { DailyStat } from './dailyStat.model';

/**
 * Rolls up one UTC day. DAU counts distinct users with any app event that day, which (unlike
 * lastActiveAt) stays correct for past days. Safe to rerun: it upserts by date.
 */
export const aggregateDay = async (day: Date) => {
  const start = dayjs.utc(day).startOf('day').toDate();
  const end = dayjs.utc(day).endOf('day').toDate();
  const created = { createdAt: { $gte: start, $lte: end } };
  const [activeUsers, newUsers, transactions, roomExpenses, roomsCreated, settlements, appOpens] = await Promise.all([
    AppEvent.distinct('userId', { at: { $gte: start, $lte: end } }),
    User.countDocuments(created),
    Transaction.countDocuments(created),
    RoomExpense.countDocuments(created),
    Room.countDocuments(created),
    Settlement.countDocuments(created),
    AppEvent.countDocuments({ name: 'app_open', at: { $gte: start, $lte: end } }),
  ]);
  await DailyStat.updateOne(
    { date: utcDateKey(start) },
    { $set: { dau: activeUsers.length, newUsers, transactions, roomExpenses, roomsCreated, settlements, appOpens } },
    { upsert: true },
  );
};

/** Recomputes yesterday and today, so a missed nightly run heals itself. */
export const refreshDailyStats = async () => {
  const now = new Date();
  await aggregateDay(dayjs.utc(now).subtract(1, 'day').toDate());
  await aggregateDay(now);
};
