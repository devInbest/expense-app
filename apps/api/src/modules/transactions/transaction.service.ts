import type { Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  createTransactionSchema,
  ERROR_CODES,
  LIMITS,
  listTransactionsQuerySchema,
  syncChangeSchema,
  updateTransactionSchema,
  type SyncPullResult,
  type SyncPushResult,
} from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { cursorFilter, pageOf } from '../../core/cursor';
import { uuid } from '../../lib/crypto';
import { logActivity } from '../activity/activity.service';
import { checkBudgetAlerts } from '../budgets/budget.service';
import { assertCategoryUsable } from '../categories/category.service';
import type { UserDoc } from '../users/user.model';
import { Transaction, toTransactionDTO } from './transaction.model';

type CreateInput = z.output<typeof createTransactionSchema>;
type UpdateInput = z.output<typeof updateTransactionSchema>;
type ListQuery = z.output<typeof listTransactionsQuerySchema>;
type SyncChange = z.output<typeof syncChangeSchema>;

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const alertLater = (userId: unknown) => {
  checkBudgetAlerts('user', String(userId)).catch((err) => console.error('Budget alert check failed:', err.message));
};

export const listTransactions = async (userId: unknown, q: ListQuery) => {
  const filter: Record<string, unknown> = { userId, deletedAt: null, binnedAt: null, ...cursorFilter(q.cursor, 'occurredAt') };
  if (q.from || q.to) {
    const range = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    filter.$and = [...((filter.$and as unknown[]) ?? []), { occurredAt: range }];
  }
  if (q.type) filter.type = q.type;
  if (q.categoryId) filter.categoryId = q.categoryId;
  if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$and = [...((filter.$and as unknown[]) ?? []), { $or: [{ note: rx }, { tags: rx }] }];
  }
  const docs = await Transaction.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(q.limit + 1).lean();
  const page = pageOf(docs, q.limit, 'occurredAt');
  return { items: page.items.map(toTransactionDTO), nextCursor: page.nextCursor };
};

export const getTransaction = async (userId: unknown, id: string) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Transaction not found');
  const t = await Transaction.findOne({ _id: id, userId, deletedAt: null }).lean();
  if (!t) throw ApiError.notFound('Transaction not found');
  return toTransactionDTO(t);
};

/** Idempotent on clientId: a retried create returns the row created the first time. */
export const createTransaction = async (user: UserDoc, input: CreateInput, req?: Request) => {
  const clientId = input.clientId ?? uuid();
  const existing = await Transaction.findOne({ userId: user._id, clientId }).lean();
  if (existing) return toTransactionDTO(existing);

  await assertCategoryUsable(user._id, input.categoryId);
  try {
    const t = await Transaction.create({
      ...input,
      clientId,
      userId: user._id,
      currency: input.currency ?? user.defaultCurrency,
      receiptUrl: input.receiptUrl || undefined,
      clientUpdatedAt: new Date(),
    });
    if (req) logActivity({ actorType: 'user', actorId: user._id, action: 'transaction.created', entity: 'transaction', entityId: t._id, meta: { amount: t.amount, type: t.type }, req });
    if (t.type === 'expense') alertLater(user._id);
    return toTransactionDTO(t.toObject());
  } catch (err) {
    // Two concurrent retries with the same clientId: the loser returns the winner's row.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Transaction.findOne({ userId: user._id, clientId }).lean();
      if (winner) return toTransactionDTO(winner);
    }
    throw err;
  }
};

const lockedError = () =>
  ApiError.forbidden('Transactions can’t be deleted once saved. Move it to the bin instead.', ERROR_CODES.TRANSACTION_LOCKED);

type TransactionDoc = InstanceType<typeof Transaction>;

/** Copies the edited fields onto the doc. Returns true when anything actually changed. */
const applyEdits = async (user: UserDoc, t: TransactionDoc, input: UpdateInput) => {
  const { receiptUrl, ...fields } = input;
  if (fields.categoryId && fields.categoryId !== String(t.categoryId)) await assertCategoryUsable(user._id, fields.categoryId);
  t.set(Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
  if (receiptUrl !== undefined) t.receiptUrl = receiptUrl || undefined;
  return t.isModified();
};

export const updateTransaction = async (user: UserDoc, id: string, input: UpdateInput, req: Request) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Transaction not found');
  const t = await Transaction.findOne({ _id: id, userId: user._id, deletedAt: null });
  if (!t) throw ApiError.notFound('Transaction not found');
  const wasExpense = t.type === 'expense';
  if (await applyEdits(user, t, input)) {
    t.version += 1;
    t.clientUpdatedAt = new Date();
    await t.save();
    logActivity({ actorType: 'user', actorId: user._id, action: 'transaction.updated', entity: 'transaction', entityId: t._id, req });
    if (wasExpense || t.type === 'expense') alertLater(user._id);
  }
  return toTransactionDTO(t.toObject());
};

export const deleteTransaction = async (_user: UserDoc, _id: string, _req: Request) => {
  throw lockedError();
};

export const setBinned = async (user: UserDoc, id: string, binned: boolean, req: Request) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Transaction not found');
  const t = await Transaction.findOne({ _id: id, userId: user._id, deletedAt: null });
  if (!t) throw ApiError.notFound('Transaction not found');
  if (Boolean(t.binnedAt) !== binned) {
    t.binnedAt = binned ? new Date() : null;
    t.version += 1;
    t.clientUpdatedAt = new Date();
    await t.save();
    logActivity({ actorType: 'user', actorId: user._id, action: binned ? 'transaction.binned' : 'transaction.restored', entity: 'transaction', entityId: t._id, req });
    if (t.type === 'expense') alertLater(user._id);
  }
  return toTransactionDTO(t.toObject());
};

/**
 * Applies offline mutations with last-write-wins on the device clock (`clientUpdatedAt`).
 * Each change is independent: one bad row never blocks the rest of the batch.
 */
export const pushChanges = async (user: UserDoc, changes: SyncChange[], req: Request): Promise<SyncPushResult> => {
  const results: SyncPushResult['results'] = [];
  let touchedExpenses = false;

  for (const change of changes) {
    try {
      const existing = await Transaction.findOne({ userId: user._id, clientId: change.clientId });
      const serverTime = existing?.clientUpdatedAt ?? existing?.updatedAt;
      const isNewer = !serverTime || change.clientUpdatedAt.getTime() >= serverTime.getTime();

      if (existing && !isNewer) {
        logActivity({ actorType: 'user', actorId: user._id, action: 'transaction.sync_conflict', entity: 'transaction', entityId: existing._id, req });
        results.push({ clientId: change.clientId, status: 'conflict', message: 'Changed on another device', transaction: toTransactionDTO(existing.toObject()) });
        continue;
      }

      if (change.deleted) throw lockedError();

      if (!existing) {
        const parsed = createTransactionSchema.safeParse({ ...change.data, clientId: change.clientId });
        if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid transaction');
        await assertCategoryUsable(user._id, parsed.data.categoryId);
        const t = await Transaction.create({
          ...parsed.data,
          userId: user._id,
          currency: parsed.data.currency ?? user.defaultCurrency,
          receiptUrl: parsed.data.receiptUrl || undefined,
          binnedAt: change.binned ? change.clientUpdatedAt : null,
          clientUpdatedAt: change.clientUpdatedAt,
        });
        touchedExpenses ||= t.type === 'expense';
        results.push({ clientId: change.clientId, status: 'applied', transaction: toTransactionDTO(t.toObject()) });
        continue;
      }

      if (!existing.deletedAt) {
        const wasExpense = existing.type === 'expense';
        let changed = false;
        if (change.data) {
          const parsed = updateTransactionSchema.safeParse(change.data);
          if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid transaction');
          changed = await applyEdits(user, existing, parsed.data);
        }
        if (change.binned !== undefined && Boolean(existing.binnedAt) !== change.binned) {
          existing.binnedAt = change.binned ? change.clientUpdatedAt : null;
          changed = true;
        }
        if (changed) {
          existing.version += 1;
          existing.clientUpdatedAt = change.clientUpdatedAt;
          await existing.save();
          touchedExpenses ||= wasExpense || existing.type === 'expense';
        }
      }
      results.push({ clientId: change.clientId, status: 'applied', transaction: toTransactionDTO(existing.toObject()) });
    } catch (err) {
      results.push({ clientId: change.clientId, status: 'error', message: (err as Error).message });
    }
  }

  if (touchedExpenses) alertLater(user._id);
  return { results };
};

const FIRST_SYNC_LIMIT = 5000;

/** Changes since the last pull, including soft-deletes so devices can drop removed rows. */
export const pullChanges = async (userId: unknown, since?: Date): Promise<SyncPullResult> => {
  const serverTime = new Date();
  const filter = since ? { userId, updatedAt: { $gt: since, $lte: serverTime } } : { userId, deletedAt: null };
  const limit = since ? LIMITS.MAX_SYNC_BATCH * 25 : FIRST_SYNC_LIMIT;
  const docs = await Transaction.find(filter)
    .sort(since ? { updatedAt: 1 } : { occurredAt: -1 })
    .limit(limit)
    .lean();
  // Incremental pulls are ordered by updatedAt, so a truncated page can resume from its last row.
  const hasMore = Boolean(since) && docs.length === limit;
  const cursor = hasMore ? docs[docs.length - 1]!.updatedAt : serverTime;
  return { changes: docs.map(toTransactionDTO), serverTime: cursor.toISOString(), hasMore };
};
