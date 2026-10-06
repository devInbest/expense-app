import * as Crypto from 'expo-crypto';
import type { PaymentMethod, SyncChange, TransactionDTO, TransactionType } from '@expense/shared';
import { db } from './db';

export interface LocalTransaction {
  clientId: string;
  serverId: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string;
  note: string;
  paymentMethod: PaymentMethod;
  occurredAt: string;
  receiptUrl: string | null;
  tags: string[];
  recurringId: string | null;
  binned: boolean;
  /** Saved on this device but not yet confirmed by the server. */
  pending: boolean;
  syncError: string | null;
}

export interface TransactionRow {
  client_id: string;
  server_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  category_id: string;
  note: string;
  payment_method: PaymentMethod;
  occurred_at: string;
  receipt_url: string | null;
  tags: string;
  recurring_id: string | null;
  deleted: number;
  binned: number;
  dirty: number;
  client_updated_at: string;
  sync_error: string | null;
}

export type TransactionInput = Pick<
  LocalTransaction,
  'type' | 'amount' | 'currency' | 'categoryId' | 'note' | 'paymentMethod' | 'occurredAt'
> & { receiptUrl?: string | null; tags?: string[] };

// ---------- change notifications ----------
const listeners = new Set<() => void>();
export const subscribeTransactions = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const emitTransactionsChanged = () => listeners.forEach((fn) => fn());

let onLocalWrite: () => void = () => {};
/** The sync engine registers here so local edits get pushed soon after they happen. */
export const setLocalWriteHandler = (fn: () => void) => {
  onLocalWrite = fn;
};

const afterWrite = () => {
  emitTransactionsChanged();
  onLocalWrite();
};

// ---------- mapping ----------
export const fromRow = (r: TransactionRow): LocalTransaction => ({
  clientId: r.client_id,
  serverId: r.server_id,
  type: r.type,
  amount: r.amount,
  currency: r.currency,
  categoryId: r.category_id,
  note: r.note,
  paymentMethod: r.payment_method,
  occurredAt: r.occurred_at,
  receiptUrl: r.receipt_url,
  tags: JSON.parse(r.tags || '[]') as string[],
  recurringId: r.recurring_id,
  binned: r.binned === 1,
  pending: r.dirty === 1,
  syncError: r.sync_error,
});

export const toSyncChange = (r: TransactionRow): SyncChange => ({
  clientId: r.client_id,
  deleted: r.deleted === 1,
  binned: r.binned === 1,
  clientUpdatedAt: r.client_updated_at,
  data:
    r.deleted === 1
      ? undefined
      : {
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          categoryId: r.category_id,
          note: r.note,
          paymentMethod: r.payment_method,
          occurredAt: r.occurred_at,
          receiptUrl: r.receipt_url ?? '',
          tags: JSON.parse(r.tags || '[]') as string[],
        },
});

const UPSERT_SERVER_SQL = `
  INSERT INTO transactions (client_id, server_id, type, amount, currency, category_id, note, payment_method,
    occurred_at, receipt_url, tags, recurring_id, binned, deleted, dirty, client_updated_at, sync_error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL)
  ON CONFLICT (client_id) DO UPDATE SET
    server_id = excluded.server_id, type = excluded.type, amount = excluded.amount, currency = excluded.currency,
    category_id = excluded.category_id, note = excluded.note, payment_method = excluded.payment_method,
    occurred_at = excluded.occurred_at, receipt_url = excluded.receipt_url, tags = excluded.tags,
    recurring_id = excluded.recurring_id, binned = excluded.binned, deleted = 0, dirty = 0,
    client_updated_at = excluded.client_updated_at, sync_error = NULL
`;

const serverParams = (t: TransactionDTO) => [
  t.clientId,
  t._id,
  t.type,
  t.amount,
  t.currency,
  t.categoryId,
  t.note ?? '',
  t.paymentMethod,
  t.occurredAt,
  t.receiptUrl ?? null,
  JSON.stringify(t.tags ?? []),
  t.recurringId ?? null,
  t.binnedAt ? 1 : 0,
  t.updatedAt,
];

/** Applies a server copy unless the user has unsynced local edits to that row. */
export const applyServerIfClean = (t: TransactionDTO) =>
  db.runAsync(`${UPSERT_SERVER_SQL} WHERE transactions.dirty = 0`, ...serverParams(t));

/** Applies the server copy only if the row hasn't been edited since `expectedUpdatedAt` (i.e. during the push). */
export const applyServerIfUnchanged = (t: TransactionDTO, expectedUpdatedAt: string) =>
  db.runAsync(`${UPSERT_SERVER_SQL} WHERE transactions.client_updated_at = ?`, ...serverParams(t), expectedUpdatedAt);

// ---------- queries ----------
export interface TransactionFilter {
  from?: string;
  to?: string;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  search?: string;
  /** List the bin instead of active transactions. */
  binned?: boolean;
  limit?: number;
  offset?: number;
}

const buildWhere = (f: TransactionFilter) => {
  const clauses = ['deleted = 0', f.binned ? 'binned = 1' : 'binned = 0'];
  const params: (string | number)[] = [];
  if (f.from) {
    clauses.push('occurred_at >= ?');
    params.push(f.from);
  }
  if (f.to) {
    clauses.push('occurred_at < ?');
    params.push(f.to);
  }
  if (f.type) {
    clauses.push('type = ?');
    params.push(f.type);
  }
  if (f.categoryId) {
    clauses.push('category_id = ?');
    params.push(f.categoryId);
  }
  if (f.paymentMethod) {
    clauses.push('payment_method = ?');
    params.push(f.paymentMethod);
  }
  if (f.search) {
    clauses.push('note LIKE ?');
    params.push(`%${f.search.replace(/[%_]/g, '')}%`);
  }
  return { where: clauses.join(' AND '), params };
};

export const listTransactions = async (f: TransactionFilter = {}) => {
  const { where, params } = buildWhere(f);
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE ${where} ORDER BY occurred_at DESC, client_id DESC LIMIT ? OFFSET ?`,
    ...params,
    f.limit ?? 50,
    f.offset ?? 0,
  );
  return rows.map(fromRow);
};

export const getTransaction = async (clientId: string) => {
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE client_id = ?', clientId);
  return row && row.deleted === 0 ? fromRow(row) : null;
};

export interface LocalSummary {
  expense: number;
  income: number;
  count: number;
  byCategory: { categoryId: string; total: number; count: number }[];
  byDay: { date: string; expense: number; income: number }[];
  byPaymentMethod: { paymentMethod: PaymentMethod; total: number }[];
}

/**
 * Totals over [from, to). `occurred_at` is stored as UTC ISO; the day bucket uses the
 * device's UTC offset, which matches the user's timezone for nearly everyone.
 */
export const summarize = async (from: string, to: string, type: TransactionType = 'expense'): Promise<LocalSummary> => {
  const offsetMin = -new Date().getTimezoneOffset();
  const modifier = `${offsetMin >= 0 ? '+' : '-'}${Math.abs(offsetMin)} minutes`;
  const [totals, byCategory, byDay, byPaymentMethod] = await Promise.all([
    db.getAllAsync<{ type: TransactionType; total: number; count: number }>(
      'SELECT type, SUM(amount) AS total, COUNT(*) AS count FROM transactions WHERE deleted = 0 AND binned = 0 AND occurred_at >= ? AND occurred_at < ? GROUP BY type',
      from,
      to,
    ),
    db.getAllAsync<{ categoryId: string; total: number; count: number }>(
      'SELECT category_id AS categoryId, SUM(amount) AS total, COUNT(*) AS count FROM transactions WHERE deleted = 0 AND binned = 0 AND type = ? AND occurred_at >= ? AND occurred_at < ? GROUP BY category_id ORDER BY total DESC',
      type,
      from,
      to,
    ),
    db.getAllAsync<{ date: string; expense: number; income: number }>(
      `SELECT date(occurred_at, ?) AS date,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income
       FROM transactions WHERE deleted = 0 AND binned = 0 AND occurred_at >= ? AND occurred_at < ? GROUP BY 1 ORDER BY 1`,
      modifier,
      from,
      to,
    ),
    db.getAllAsync<{ paymentMethod: PaymentMethod; total: number }>(
      'SELECT payment_method AS paymentMethod, SUM(amount) AS total FROM transactions WHERE deleted = 0 AND binned = 0 AND type = ? AND occurred_at >= ? AND occurred_at < ? GROUP BY payment_method ORDER BY total DESC',
      type,
      from,
      to,
    ),
  ]);
  const expense = totals.find((t) => t.type === 'expense');
  const income = totals.find((t) => t.type === 'income');
  return {
    expense: expense?.total ?? 0,
    income: income?.total ?? 0,
    count: (expense?.count ?? 0) + (income?.count ?? 0),
    byCategory,
    byDay,
    byPaymentMethod,
  };
};

export const countUnsynced = async () => {
  const row = await db.getFirstAsync<{ pending: number; failed: number }>(
    'SELECT SUM(CASE WHEN sync_error IS NULL THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN sync_error IS NOT NULL THEN 1 ELSE 0 END) AS failed FROM transactions WHERE dirty = 1',
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
};

// ---------- local writes (always succeed offline) ----------
export const createTransaction = async (input: TransactionInput) => {
  const clientId = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO transactions (client_id, type, amount, currency, category_id, note, payment_method, occurred_at,
      receipt_url, tags, deleted, dirty, client_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
    clientId,
    input.type,
    input.amount,
    input.currency,
    input.categoryId,
    input.note,
    input.paymentMethod,
    input.occurredAt,
    input.receiptUrl ?? null,
    JSON.stringify(input.tags ?? []),
    new Date().toISOString(),
  );
  afterWrite();
  return clientId;
};

/** Saved transactions can't be edited or deleted; moving to and from the bin is the only change. */
export const setTransactionBinned = async (clientId: string, binned: boolean) => {
  await db.runAsync(
    'UPDATE transactions SET binned = ?, dirty = 1, sync_error = NULL, client_updated_at = ? WHERE client_id = ?',
    binned ? 1 : 0,
    new Date().toISOString(),
    clientId,
  );
  afterWrite();
};
