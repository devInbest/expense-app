import mongoose from 'mongoose';
import {
  computeNetBalances,
  computePairwiseDebts,
  simplifyDebts,
  type LedgerExpense,
  type LedgerSettlement,
  type RoomBalancesDTO,
  type RoomSpendingDTO,
  type RoomSpendingItemDTO,
} from '@expense/shared';
import { Room, RoomExpense, RoomMember, Settlement, type RoomAttrs } from './room.models';

export const loadLedger = async (roomId: unknown): Promise<{ expenses: LedgerExpense[]; settlements: LedgerSettlement[]; totalSpent: number }> => {
  const [expenses, settlements] = await Promise.all([
    RoomExpense.find({ roomId, deletedAt: null }).select('amount paidBy splits').lean(),
    Settlement.find({ roomId, deletedAt: null }).select('fromUserId toUserId amount').lean(),
  ]);
  return {
    expenses: expenses.map((e) => ({
      paidBy: e.paidBy.map((p) => ({ userId: String(p.userId), amount: p.amount })),
      splits: e.splits.map((s) => ({ userId: String(s.userId), amount: s.amount })),
    })),
    settlements: settlements.map((s) => ({
      fromUserId: String(s.fromUserId),
      toUserId: String(s.toUserId),
      amount: s.amount,
    })),
    totalSpent: expenses.reduce((a, e) => a + e.amount, 0),
  };
};

export const computeRoomBalances = async (room: RoomAttrs & { _id: unknown }): Promise<RoomBalancesDTO> => {
  const { expenses, settlements, totalSpent } = await loadLedger(room._id);
  const net = computeNetBalances(expenses, settlements);
  const simplified = room.settings?.simplifyDebts ?? true;
  const spentBy: Record<string, number> = {};
  for (const e of expenses) for (const s of e.splits) spentBy[s.userId] = (spentBy[s.userId] ?? 0) + s.amount;
  return {
    currency: room.currency,
    net,
    debts: simplified ? simplifyDebts(net) : computePairwiseDebts(expenses, settlements),
    simplified,
    totalSpent,
    spentBy,
  };
};

export const netBalanceFor = async (roomId: unknown, userId: string): Promise<number> => {
  const { expenses, settlements } = await loadLedger(roomId);
  return computeNetBalances(expenses, settlements)[userId] ?? 0;
};

const shareOf = (field: '$splits' | '$paidBy', uid: mongoose.Types.ObjectId) => ({
  $sum: { $map: { input: { $filter: { input: field, cond: { $eq: ['$$this.userId', uid] } } }, in: '$$this.amount' } },
});

/** Rooms I've ever been in that use this currency, and a pipeline yielding my share of each expense in [from, to). */
const myShares = async (userId: unknown, currency: string, from: Date, to: Date) => {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const memberships = await RoomMember.find({ userId: uid }).select('roomId').lean();
  const rooms = await Room.find({ _id: { $in: memberships.map((m) => m.roomId) }, currency }).select('_id name').lean();
  const pipeline = [
    { $match: { roomId: { $in: rooms.map((r) => r._id) }, deletedAt: null, occurredAt: { $gte: from, $lt: to } } },
    {
      $project: {
        roomId: 1,
        note: 1,
        amount: 1,
        categoryId: 1,
        occurredAt: 1,
        share: { $cond: [{ $gt: [{ $size: '$splits' }, 0] }, shareOf('$splits', uid), shareOf('$paidBy', uid)] },
      },
    },
    { $match: { share: { $gt: 0 } } },
  ];
  return { rooms, pipeline };
};

export const roomSpendingItemsForUser = async (userId: unknown, currency: string, from: Date, to: Date): Promise<RoomSpendingItemDTO[]> => {
  const { rooms, pipeline } = await myShares(userId, currency, from, to);
  if (!rooms.length) return [];
  const names = new Map(rooms.map((r) => [String(r._id), r.name]));
  const rows = await RoomExpense.aggregate<{ _id: unknown; roomId: unknown; note?: string; amount: number; categoryId?: unknown; occurredAt: Date; share: number }>([
    ...pipeline,
    { $sort: { occurredAt: -1, _id: -1 } },
    { $limit: 500 },
  ]);
  return rows.map((r) => ({
    expenseId: String(r._id),
    roomId: String(r.roomId),
    roomName: names.get(String(r.roomId)) ?? 'Room',
    note: r.note ?? '',
    categoryId: r.categoryId ? String(r.categoryId) : undefined,
    occurredAt: r.occurredAt.toISOString(),
    amount: r.amount,
    share: r.share,
  }));
};

/** A user's share of expenses across their rooms in one currency, over [from, to). */
export const roomSpendingForUser = async (userId: unknown, currency: string, from: Date, to: Date, tz: string): Promise<RoomSpendingDTO> => {
  const { rooms, pipeline } = await myShares(userId, currency, from, to);
  const empty: RoomSpendingDTO = { currency, total: 0, count: 0, byCategory: [], byDay: [] };
  if (!rooms.length) return empty;

  const [facet] = await RoomExpense.aggregate([
    ...pipeline,
    {
      $facet: {
        totals: [{ $group: { _id: null, total: { $sum: '$share' }, count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: '$categoryId', total: { $sum: '$share' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }],
        byDay: [
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: tz } }, total: { $sum: '$share' } } },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);
  if (!facet?.totals.length) return empty;
  return {
    currency,
    total: facet.totals[0].total,
    count: facet.totals[0].count,
    byCategory: facet.byCategory.map((c: { _id: unknown; total: number; count: number }) => ({ categoryId: c._id ? String(c._id) : '', total: c.total, count: c.count })),
    byDay: facet.byDay.map((d: { _id: string; total: number }) => ({ date: d._id, total: d.total })),
  };
};

/** One user's net balance and settled payments across many split rooms, computed in the database. */
export const netBalancesForUser = async (roomIds: unknown[], userId: unknown): Promise<{ net: Map<string, number>; settled: Map<string, number> }> => {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const ids = roomIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const [paid, owed, sent, received] = await Promise.all([
    RoomExpense.aggregate([
      { $match: { roomId: { $in: ids }, deletedAt: null } },
      { $unwind: '$paidBy' },
      { $match: { 'paidBy.userId': uid } },
      { $group: { _id: '$roomId', total: { $sum: '$paidBy.amount' } } },
    ]),
    RoomExpense.aggregate([
      { $match: { roomId: { $in: ids }, deletedAt: null } },
      { $unwind: '$splits' },
      { $match: { 'splits.userId': uid } },
      { $group: { _id: '$roomId', total: { $sum: '$splits.amount' } } },
    ]),
    Settlement.aggregate([
      { $match: { roomId: { $in: ids }, deletedAt: null, fromUserId: uid } },
      { $group: { _id: '$roomId', total: { $sum: '$amount' } } },
    ]),
    Settlement.aggregate([
      { $match: { roomId: { $in: ids }, deletedAt: null, toUserId: uid } },
      { $group: { _id: '$roomId', total: { $sum: '$amount' } } },
    ]),
  ]);
  const result = new Map<string, number>();
  const add = (rows: { _id: unknown; total: number }[], sign: 1 | -1) => {
    for (const r of rows) result.set(String(r._id), (result.get(String(r._id)) ?? 0) + sign * r.total);
  };
  add(paid, 1);
  add(owed, -1);
  add(sent, 1);
  add(received, -1);
  const settled = new Map<string, number>((sent as { _id: unknown; total: number }[]).map((r) => [String(r._id), r.total]));
  return { net: result, settled };
};
