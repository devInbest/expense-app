import type { AdminDashboardDTO } from '@expense/shared';
import { dayjs, utcDateKey } from '../../lib/dates';
import { AppEvent } from '../events/appEvent.model';
import { Room, RoomExpense } from '../rooms/room.models';
import { DailyStat } from '../stats/dailyStat.model';
import { Transaction } from '../transactions/transaction.model';
import { User } from '../users/user.model';

const DAY = 86400_000;

const seriesByDay = async (model: typeof User | typeof Transaction | typeof RoomExpense, since: Date, extra: Record<string, unknown> = {}) => {
  const rows = await (model as typeof User).aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: since }, ...extra } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.count]));
};

const fillDays = (since: Date, days: number, values: Map<string, number>) =>
  Array.from({ length: days }, (_, i) => {
    const date = utcDateKey(new Date(since.getTime() + i * DAY));
    return { date, count: values.get(date) ?? 0 };
  });

/** Weekly signup cohorts: share who came back in week 2 (days 7-13) and week 5 (days 28-34). */
const retention = async (weeks = 8) => {
  const start = dayjs.utc().startOf('week').subtract(weeks, 'week');
  const out: AdminDashboardDTO['retention'] = [];
  for (let w = 0; w < weeks; w += 1) {
    const from = start.add(w, 'week');
    const to = from.add(1, 'week');
    const cohort = await User.find({ createdAt: { $gte: from.toDate(), $lt: to.toDate() } }).select('_id createdAt').lean();
    if (cohort.length === 0) {
      out.push({ cohort: from.format('YYYY-MM-DD'), size: 0, week1: 0, week4: 0 });
      continue;
    }
    const ids = cohort.map((u) => u._id);
    const activeIn = async (offsetDays: number) => {
      const windowStart = from.add(offsetDays, 'day');
      if (windowStart.isAfter(dayjs.utc())) return 0;
      const users = await AppEvent.distinct('userId', {
        userId: { $in: ids },
        name: 'app_open',
        at: { $gte: windowStart.toDate(), $lt: windowStart.add(7, 'day').toDate() },
      });
      return users.length;
    };
    out.push({ cohort: from.format('YYYY-MM-DD'), size: cohort.length, week1: await activeIn(7), week4: await activeIn(28) });
  }
  return out;
};

export const getDashboard = async (days: number): Promise<AdminDashboardDTO> => {
  const now = Date.now();
  const since = dayjs.utc().startOf('day').subtract(days - 1, 'day').toDate();
  const notDeleted = { status: { $ne: 'deleted' } };

  const [users, activeUsers, blockedUsers, rooms, transactions, roomExpenses, dau, wau, mau] = await Promise.all([
    User.countDocuments(notDeleted),
    User.countDocuments({ ...notDeleted, lastActiveAt: { $gte: new Date(now - 30 * DAY) } }),
    User.countDocuments({ status: 'blocked' }),
    Room.countDocuments({ archivedAt: null }),
    Transaction.countDocuments({ deletedAt: null }),
    RoomExpense.countDocuments({ deletedAt: null }),
    User.countDocuments({ ...notDeleted, lastActiveAt: { $gte: new Date(now - DAY) } }),
    User.countDocuments({ ...notDeleted, lastActiveAt: { $gte: new Date(now - 7 * DAY) } }),
    User.countDocuments({ ...notDeleted, lastActiveAt: { $gte: new Date(now - 30 * DAY) } }),
  ]);

  const [signups, txns, stats, platforms, versions, roomTypes] = await Promise.all([
    seriesByDay(User, since),
    seriesByDay(Transaction, since),
    DailyStat.find({ date: { $gte: utcDateKey(since) } }).lean(),
    User.aggregate<{ _id: string | null; count: number }>([
      { $match: { ...notDeleted, lastActiveAt: { $gte: new Date(now - 30 * DAY) } } },
      { $group: { _id: '$lastPlatform', count: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: string | null; count: number }>([
      { $match: { ...notDeleted, lastActiveAt: { $gte: new Date(now - 30 * DAY) } } },
      { $group: { _id: '$lastAppVersion', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Room.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);

  const activeMap = new Map(stats.map((s) => [s.date, s.dau]));
  activeMap.set(utcDateKey(new Date()), dau);

  return {
    totals: { users, activeUsers, blockedUsers, rooms, transactions, roomExpenses },
    dau,
    wau,
    mau,
    signupsSeries: fillDays(since, days, signups),
    activeSeries: fillDays(since, days, activeMap),
    transactionsSeries: fillDays(since, days, txns),
    platformSplit: platforms.map((p) => ({ platform: p._id ?? 'unknown', count: p.count })),
    appVersionSplit: versions.map((v) => ({ appVersion: v._id ?? 'unknown', count: v.count })),
    roomTypeSplit: roomTypes.map((r) => ({ type: r._id, count: r.count })),
    retention: await retention(),
  };
};
