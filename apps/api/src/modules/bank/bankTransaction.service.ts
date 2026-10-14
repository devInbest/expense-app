import type { Request } from 'express';
import mongoose from 'mongoose';
import type { z } from 'zod';
import {
  merchantKey,
  type BankTransactionDTO,
  type BankTransactionPage,
  type IngestBankTransactionsResult,
  type LinkBankTransactionResult,
  bankTransactionInputSchema,
  linkBankTransactionSchema,
  listBankTransactionsQuerySchema,
} from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { cursorFilter, pageOf } from '../../core/cursor';
import { logActivity } from '../activity/activity.service';
import { addExpense, markSharePaid } from '../rooms/expense.service';
import { createTransaction } from '../transactions/transaction.service';
import type { UserDoc } from '../users/user.model';
import { BankTransaction, MerchantRule, toBankTransactionDTO, type BankTransactionAttrs } from './bankTransaction.model';

type IngestItem = z.output<typeof bankTransactionInputSchema>;
type ListQuery = z.output<typeof listBankTransactionsQuerySchema>;
type LinkInput = z.output<typeof linkBankTransactionSchema>;
type Suggestion = NonNullable<BankTransactionDTO['suggestion']>;

const LOCK_MS = 30_000;

const typeFor = (direction: string) => (direction === 'credit' ? 'income' : 'expense');

/** Upserts on fingerprint, so re-scanning the inbox or a second alert for the same payment adds nothing. */
export const ingest = async (user: UserDoc, items: IngestItem[]): Promise<IngestBankTransactionsResult> => {
  if (!items.length) return { received: 0, added: 0 };
  const ops = items.map(({ fingerprint, ...item }) => ({
    updateOne: {
      filter: { userId: user._id, fingerprint },
      update: { $setOnInsert: { ...item, currency: item.currency ?? 'INR', status: 'pending' as const } },
      upsert: true,
    },
  }));
  try {
    const res = await BankTransaction.bulkWrite(ops, { ordered: false });
    return { received: items.length, added: res.upsertedCount };
  } catch (err) {
    // Two devices uploading the same payment at once: the loser's duplicate is simply skipped.
    const bulk = err as { code?: number; result?: { upsertedCount?: number } };
    if (bulk.code === 11000) return { received: items.length, added: bulk.result?.upsertedCount ?? 0 };
    throw err;
  }
};

const suggestionsFor = async (userId: unknown, docs: (BankTransactionAttrs & { _id: unknown })[]) => {
  const keys = [...new Set(docs.map((d) => merchantKey(d.counterparty ?? '')).filter(Boolean))];
  const out = new Map<string, Suggestion>();
  if (!keys.length) return out;
  const rules = await MerchantRule.find({ userId, key: { $in: keys } }).lean();
  const byKey = new Map(rules.map((r) => [`${r.key}|${r.type}`, r]));
  for (const d of docs) {
    const type = typeFor(d.direction);
    const rule = byKey.get(`${merchantKey(d.counterparty ?? '')}|${type}`);
    if (rule) out.set(String(d._id), { categoryId: String(rule.categoryId), type });
  }
  return out;
};

export const listBankTransactions = async (userId: unknown, q: ListQuery): Promise<BankTransactionPage> => {
  const filter = { userId, status: q.status, ...cursorFilter(q.cursor, 'occurredAt') };
  const [docs, pending] = await Promise.all([
    BankTransaction.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(q.limit + 1).lean(),
    BankTransaction.countDocuments({ userId, status: 'pending' }),
  ]);
  const page = pageOf(docs, q.limit, 'occurredAt');
  const suggestions = q.status === 'pending' ? await suggestionsFor(userId, page.items) : new Map<string, Suggestion>();
  return {
    items: page.items.map((d) => toBankTransactionDTO(d, suggestions.get(String(d._id)))),
    nextCursor: page.nextCursor,
    pending,
  };
};

const findOwn = async (userId: unknown, id: string) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Bank transaction not found');
  const doc = await BankTransaction.findOne({ _id: id, userId }).lean();
  if (!doc) throw ApiError.notFound('Bank transaction not found');
  return doc;
};

export const getBankTransaction = async (userId: unknown, id: string) => {
  const doc = await findOwn(userId, id);
  const suggestions = doc.status === 'pending' ? await suggestionsFor(userId, [doc]) : new Map<string, Suggestion>();
  return toBankTransactionDTO(doc, suggestions.get(String(doc._id)));
};

const rememberCategory = (userId: unknown, counterparty: string, categoryId: string | undefined, type: 'expense' | 'income') => {
  const key = merchantKey(counterparty);
  if (!key || !categoryId) return;
  MerchantRule.updateOne({ userId, key, type }, { $set: { categoryId } }, { upsert: true }).catch((err) =>
    console.error('Failed to save merchant rule:', err.message),
  );
};

/** Creates what the user picked and marks the bank transaction as handled. */
const createLinked = async (
  user: UserDoc,
  doc: BankTransactionAttrs,
  input: LinkInput,
  req: Request,
): Promise<{ link: NonNullable<BankTransactionDTO['link']>; result: Omit<LinkBankTransactionResult, 'bankTransaction'> }> => {
  const me = String(user._id);
  switch (input.kind) {
    case 'transaction': {
      if (input.transaction.type !== typeFor(doc.direction)) {
        throw ApiError.badRequest(doc.direction === 'debit' ? 'Money you paid can only be saved as an expense' : 'Money you received can only be saved as income');
      }
      const transaction = await createTransaction(user, input.transaction, req);
      rememberCategory(user._id, doc.counterparty, transaction.categoryId, transaction.type);
      return { link: { kind: 'transaction', id: transaction.clientId }, result: { transaction } };
    }
    case 'room_expense': {
      if (doc.direction !== 'debit') throw ApiError.badRequest('Only money you paid can be added as a room expense');
      const roomExpense = await addExpense(input.roomId, user, input.expense as Parameters<typeof addExpense>[2], req);
      rememberCategory(user._id, doc.counterparty, roomExpense.categoryId, 'expense');
      return { link: { kind: 'room_expense', id: roomExpense._id, roomId: input.roomId }, result: { roomExpense } };
    }
    case 'room_payment': {
      const paidByMe = doc.direction === 'debit';
      if (paidByMe && input.userId !== me) throw ApiError.badRequest('A payment you made can only settle your own share');
      if (!paidByMe && input.userId === me) throw ApiError.badRequest('Money you received settles someone else’s share');
      const upi = paidByMe ? { txnId: doc.reference || undefined, app: doc.bank || undefined } : undefined;
      const roomExpense = await markSharePaid(input.roomId, input.expenseId, input.userId, user, true, req, upi);
      return { link: { kind: 'room_payment', id: input.expenseId, roomId: input.roomId, userId: input.userId }, result: { roomExpense } };
    }
  }
};

export const linkBankTransaction = async (user: UserDoc, id: string, input: LinkInput, req: Request): Promise<LinkBankTransactionResult> => {
  const existing = await findOwn(user._id, id);
  if (existing.status !== 'pending') throw ApiError.conflict('This bank transaction has already been handled');

  const now = new Date();
  const doc = await BankTransaction.findOneAndUpdate(
    { _id: existing._id, status: 'pending', $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
    { new: true },
  );
  if (!doc) throw ApiError.conflict('This bank transaction is already being saved');

  try {
    const { link, result } = await createLinked(user, doc.toObject(), input, req);
    doc.set({ status: 'linked', link, linkedAt: new Date(), lockedUntil: null });
    await doc.save();
    logActivity({
      actorType: 'user',
      actorId: user._id,
      action: 'bank_txn.linked',
      entity: 'bank_transaction',
      entityId: doc._id,
      meta: { kind: link.kind, amount: doc.amount },
      req,
    });
    return { bankTransaction: toBankTransactionDTO(doc.toObject()), ...result };
  } catch (err) {
    await BankTransaction.updateOne({ _id: doc._id }, { $set: { lockedUntil: null } });
    throw err;
  }
};

/** Ignore (already added by hand, self-transfer, ...) or bring an ignored one back for review. Idempotent. */
export const setIgnored = async (userId: unknown, id: string, ignored: boolean) => {
  const doc = await findOwn(userId, id);
  if (doc.status === 'linked') throw ApiError.conflict('This bank transaction has already been saved');
  const next = ignored ? 'ignored' : 'pending';
  if (doc.status === next) return toBankTransactionDTO(doc);
  const updated = await BankTransaction.findOneAndUpdate({ _id: doc._id, status: doc.status }, { $set: { status: next } }, { new: true }).lean();
  return toBankTransactionDTO(updated ?? doc);
};
