import type { Request } from 'express';
import mongoose from 'mongoose';
import {
  computeExpenseDebts,
  computeSplits,
  formatMoney,
  SplitError,
  validatePayers,
  type CreateRoomExpenseInput,
  type RoomExpenseDTO,
  type SplitType,
  type UpdateRoomExpenseInput,
} from '@expense/shared';
import { z } from 'zod';
import { listRoomExpensesQuerySchema } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { cursorFilter, pageOf } from '../../core/cursor';
import { logActivity } from '../activity/activity.service';
import { checkBudgetAlerts } from '../budgets/budget.service';
import { notifyLater } from '../notifications/notification.service';
import type { UserDoc } from '../users/user.model';
import { activeMemberIds, isManager, loadRoomForMember } from './access';
import { toExpenseDTO } from './room.dto';
import { RoomExpense, Settlement, type RoomAttrs, type RoomExpenseAttrs } from './room.models';

type RoomDoc = mongoose.HydratedDocument<RoomAttrs>;

interface ExpenseShape {
  amount: number;
  paidBy: { userId: string; amount: number }[];
  splitType: SplitType;
  splits: { userId: string; value?: number }[] | undefined;
}

/**
 * Validates participants and computes final split amounts.
 * People must be active members, except those already on the expense being edited
 * (so an old expense involving someone who left can still be corrected).
 */
const buildLedgerRows = async (room: RoomDoc, shape: ExpenseShape, existingParticipants: string[] = []) => {
  const active = new Set(await activeMemberIds(room._id));
  const allowed = (id: string) => active.has(id) || existingParticipants.includes(id);

  validatePayers(shape.amount, shape.paidBy);
  for (const p of shape.paidBy) if (!allowed(p.userId)) throw new SplitError('Every payer must be a member of the room');

  if (room.type === 'shared_budget') {
    return { paidBy: shape.paidBy, splitType: 'equal' as SplitType, splits: [] };
  }

  const inputs = shape.splits?.length ? shape.splits : [...active].map((userId) => ({ userId }));
  for (const s of inputs) if (!allowed(s.userId)) throw new SplitError('Everyone in the split must be a member of the room');
  const splits = computeSplits(shape.splitType, shape.amount, inputs);
  return { paidBy: shape.paidBy, splitType: shape.splitType, splits: splits.filter((s) => s.amount > 0 || shape.splitType === 'equal') };
};

const participantsOf = (e: Pick<RoomExpenseAttrs, 'paidBy' | 'splits'>) => [
  ...new Set([...e.paidBy.map((p) => String(p.userId)), ...e.splits.map((s) => String(s.userId))]),
];

type ExpenseDoc = mongoose.HydratedDocument<RoomExpenseAttrs>;

const assertCreator = (actorId: string, expense: { createdBy: unknown }) => {
  if (String(expense.createdBy) !== actorId) throw ApiError.forbidden('Only the person who added this expense can change it');
};

const assertCanEdit = (actorId: string, expense: ExpenseDoc) => {
  assertCreator(actorId, expense);
  if (expense.settledAt) throw ApiError.forbidden('This expense is fully settled and can no longer be changed');
};

const hasPaidShares = (expense: ExpenseDoc) => expense.splits.some((s) => s.paidAt);

const ledgerOf = (e: Pick<RoomExpenseAttrs, 'paidBy' | 'splits'>) => ({
  paidBy: e.paidBy.map((p) => ({ userId: String(p.userId), amount: p.amount })),
  splits: e.splits.map((s) => ({ userId: String(s.userId), amount: s.amount })),
});

const touchRoom = async (room: RoomDoc) => {
  room.hasExpenses = true;
  room.lastActivityAt = new Date();
  await room.save();
};

export const listExpenses = async (roomId: string, userId: unknown, q: z.output<typeof listRoomExpensesQuerySchema>) => {
  const { room } = await loadRoomForMember(roomId, userId, { allowFormer: true });
  const filter: Record<string, unknown> = { roomId: room._id, deletedAt: null, ...cursorFilter(q.cursor, 'occurredAt') };
  if (q.from || q.to) filter.occurredAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  if (q.memberId) {
    const mid = new mongoose.Types.ObjectId(q.memberId);
    filter.$and = [{ $or: [{ 'paidBy.userId': mid }, { 'splits.userId': mid }] }];
  }
  const docs = await RoomExpense.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(q.limit + 1).lean();
  const page = pageOf(docs, q.limit, 'occurredAt');
  return { items: page.items.map(toExpenseDTO), nextCursor: page.nextCursor };
};

export const addExpense = async (roomId: string, actor: UserDoc, input: CreateRoomExpenseInput & { occurredAt: Date }, req: Request): Promise<RoomExpenseDTO> => {
  const { room, member } = await loadRoomForMember(roomId, actor._id, { write: true });
  if (!isManager(member.role) && room.settings?.membersCanAddExpense === false) {
    throw ApiError.forbidden('Only room admins can add expenses in this room');
  }
  const rows = await buildLedgerRows(room, {
    amount: input.amount,
    paidBy: [{ userId: String(actor._id), amount: input.amount }],
    splitType: input.splitType ?? 'equal',
    splits: input.splits,
  });

  const expense = await RoomExpense.create({
    roomId: room._id,
    amount: input.amount,
    categoryId: input.categoryId,
    note: input.note ?? '',
    occurredAt: input.occurredAt,
    receiptUrl: input.receiptUrl || undefined,
    paymentMethod: input.paymentMethod ?? 'upi',
    upiId: input.upiId || undefined,
    createdBy: actor._id,
    ...rows,
  });
  await touchRoom(room);

  const dto = toExpenseDTO(expense.toObject());
  const notifyIds = (room.type === 'split' ? participantsOf(expense) : await activeMemberIds(room._id)).filter((id) => id !== String(actor._id));
  notifyLater({
    userIds: notifyIds,
    type: 'room_expense_added',
    title: room.name,
    body: `${actor.name || 'Someone'} added ${expense.note ? `"${expense.note}" ` : 'an expense '}of ${formatMoney(expense.amount, room.currency)}`,
    data: { roomId: String(room._id), expenseId: dto._id },
    pref: 'roomActivity',
  });
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.expense_added', entity: 'room_expense', entityId: expense._id, roomId: room._id, meta: { amount: expense.amount }, req });
  if (room.type === 'shared_budget') checkBudgetAlerts('room', String(room._id)).catch(() => undefined);
  return dto;
};

export const updateExpense = async (roomId: string, expenseId: string, actor: UserDoc, input: UpdateRoomExpenseInput & { occurredAt?: Date }, req: Request) => {
  const { room } = await loadRoomForMember(roomId, actor._id, { write: true });
  const expense = await RoomExpense.findOne({ _id: expenseId, roomId: room._id, deletedAt: null });
  if (!expense) throw ApiError.notFound('Expense not found');
  assertCanEdit(String(actor._id), expense);

  const before = participantsOf(expense);
  const moneyChanged = input.amount !== undefined || input.splits !== undefined || input.splitType !== undefined;
  if (moneyChanged && hasPaidShares(expense)) {
    throw ApiError.badRequest('Some shares are already marked paid. Undo those first to change the amount or split.');
  }
  if (moneyChanged) {
    const current = toExpenseDTO(expense.toObject());
    const rows = await buildLedgerRows(
      room,
      {
        amount: input.amount ?? current.amount,
        paidBy: [{ userId: current.createdBy, amount: input.amount ?? current.amount }],
        splitType: input.splitType ?? current.splitType,
        splits: input.splits ?? current.splits.map((s) => ({ userId: s.userId, value: current.splitType === 'exact' ? s.amount : s.share })),
      },
      before,
    );
    expense.amount = input.amount ?? current.amount;
    expense.set(rows);
  }
  if (input.note !== undefined) expense.note = input.note;
  if (input.categoryId !== undefined) expense.categoryId = new mongoose.Types.ObjectId(input.categoryId);
  if (input.occurredAt !== undefined) expense.occurredAt = input.occurredAt;
  if (input.receiptUrl !== undefined) expense.receiptUrl = input.receiptUrl || undefined;
  if (input.paymentMethod !== undefined) expense.paymentMethod = input.paymentMethod;
  if (input.upiId !== undefined) expense.upiId = input.upiId || undefined;
  expense.updatedBy = actor._id;
  await expense.save();
  await touchRoom(room);

  if (moneyChanged) {
    const affected = [...new Set([...before, ...participantsOf(expense)])].filter((id) => id !== String(actor._id));
    notifyLater({
      userIds: affected,
      type: 'room_expense_updated',
      title: room.name,
      body: `${actor.name || 'Someone'} edited ${expense.note ? `"${expense.note}"` : 'an expense'}. Balances were updated.`,
      data: { roomId: String(room._id), expenseId: String(expense._id) },
      pref: 'roomActivity',
    });
  }
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.expense_updated', entity: 'room_expense', entityId: expense._id, roomId: room._id, meta: { fields: Object.keys(input) }, req });
  return toExpenseDTO(expense.toObject());
};

export const deleteExpense = async (roomId: string, expenseId: string, actor: UserDoc, req: Request) => {
  const { room } = await loadRoomForMember(roomId, actor._id, { write: true });
  const expense = await RoomExpense.findOne({ _id: expenseId, roomId: room._id, deletedAt: null });
  if (!expense) throw ApiError.notFound('Expense not found');
  assertCanEdit(String(actor._id), expense);
  if (hasPaidShares(expense)) throw ApiError.badRequest('Some shares are already marked paid. Undo those first to delete this expense.');

  expense.deletedAt = new Date();
  expense.deletedBy = actor._id;
  await expense.save();

  notifyLater({
    userIds: participantsOf(expense).filter((id) => id !== String(actor._id)),
    type: 'room_expense_deleted',
    title: room.name,
    body: `${actor.name || 'Someone'} deleted ${expense.note ? `"${expense.note}"` : 'an expense'} of ${formatMoney(expense.amount, room.currency)}`,
    data: { roomId: String(room._id) },
    pref: 'roomActivity',
  });
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.expense_deleted', entity: 'room_expense', entityId: expense._id, roomId: room._id, meta: { amount: expense.amount }, req });
};

export const getExpense = async (roomId: string, expenseId: string, userId: unknown) => {
  const { room } = await loadRoomForMember(roomId, userId, { allowFormer: true });
  const expense = await RoomExpense.findOne({ _id: expenseId, roomId: room._id, deletedAt: null }).lean();
  if (!expense) throw ApiError.notFound('Expense not found');
  return toExpenseDTO(expense);
};

/**
 * The creator marks (or un-marks) one person's share as paid back. The person who owes can also mark
 * their own share paid, but only right after paying through a UPI app (`upi`); the creator can undo it
 * if the money never arrived. Marking records settlements linked to the expense so room balances move
 * too; un-marking removes them. When everyone who owes is marked paid, the expense is settled and locked.
 */
export const markSharePaid = async (
  roomId: string,
  expenseId: string,
  userId: string,
  actor: UserDoc,
  paid: boolean,
  req: Request,
  upi?: { txnId?: string; app?: string },
) => {
  const { room } = await loadRoomForMember(roomId, actor._id, { write: true });
  if (room.type !== 'split') throw ApiError.badRequest('Only split rooms track who has paid');
  const expense = await RoomExpense.findOne({ _id: expenseId, roomId: room._id, deletedAt: null });
  if (!expense) throw ApiError.notFound('Expense not found');
  const actorId = String(actor._id);
  const selfUpi = Boolean(upi) && paid && userId === actorId;
  if (!selfUpi) assertCreator(actorId, expense);
  if (selfUpi && expense.settledAt) throw ApiError.forbidden('This expense is already fully settled');

  const debts = computeExpenseDebts(ledgerOf(expense));
  const owed = debts.filter((d) => d.from === userId);
  const split = expense.splits.find((s) => String(s.userId) === userId);
  if (!owed.length || !split) throw ApiError.badRequest('This person doesn’t owe anything on this expense');
  if (Boolean(split.paidAt) === paid) return toExpenseDTO(expense.toObject());

  if (paid) {
    await Settlement.insertMany(
      owed.map((d) => ({
        roomId: room._id,
        fromUserId: d.from,
        toUserId: d.to,
        amount: d.amount,
        method: selfUpi ? 'upi' : 'cash',
        note: [expense.note ? `For "${expense.note}"` : 'For a shared expense', upi?.txnId ? `UPI txn ${upi.txnId}` : null].filter(Boolean).join(' · '),
        settledAt: new Date(),
        recordedBy: actor._id,
        confirmedAt: d.to === actorId ? new Date() : null,
        confirmedBy: d.to === actorId ? actor._id : null,
        expenseId: expense._id,
      })),
    );
    split.paidAt = new Date();
    split.paidViaUpi = selfUpi;
    split.upiTxnId = selfUpi ? upi?.txnId || null : null;
  } else {
    await Settlement.updateMany({ expenseId: expense._id, fromUserId: userId, deletedAt: null }, { $set: { deletedAt: new Date() } });
    split.paidAt = null;
    split.paidViaUpi = false;
    split.upiTxnId = null;
  }

  const debtors = new Set(debts.map((d) => d.from));
  const allPaid = expense.splits.filter((s) => debtors.has(String(s.userId))).every((s) => s.paidAt);
  expense.settledAt = allPaid ? (expense.settledAt ?? new Date()) : null;
  expense.updatedBy = actor._id;
  await expense.save();
  room.lastActivityAt = new Date();
  await room.save();

  const label = expense.note ? `"${expense.note}"` : 'an expense';
  const amount = formatMoney(owed.reduce((s, d) => s + d.amount, 0), room.currency);
  notifyLater({
    userIds: selfUpi ? [String(expense.createdBy)] : [userId].filter((id) => id !== actorId),
    type: 'settlement_recorded',
    title: room.name,
    body: selfUpi
      ? `${actor.name || 'Someone'} paid you ${amount} for ${label} via ${upi?.app || 'UPI'}${upi?.txnId ? ` · Txn ${upi.txnId}` : ''}`
      : paid
        ? `${actor.name || 'Someone'} marked your ${amount} share of ${label} as paid`
        : `${actor.name || 'Someone'} marked your ${amount} share of ${label} as unpaid`,
    data: { roomId: String(room._id), expenseId: String(expense._id) },
    pref: 'roomActivity',
  });
  logActivity({
    actorType: 'user',
    actorId: actor._id,
    action: selfUpi ? 'room.share_paid_upi' : paid ? 'room.share_marked_paid' : 'room.share_marked_unpaid',
    entity: 'room_expense',
    entityId: expense._id,
    roomId: room._id,
    meta: { userId, settled: Boolean(expense.settledAt), ...(selfUpi ? { txnId: upi?.txnId, app: upi?.app } : {}) },
    req,
  });
  return toExpenseDTO(expense.toObject());
};
