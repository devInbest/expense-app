import { LIMITS } from '@expense/shared';
import { api, errorMessage, isOffline } from './api';
import { db, kv } from './db';
import { tokenStorage } from './secure';
import {
  applyServerIfClean,
  applyServerIfUnchanged,
  countUnsynced,
  emitTransactionsChanged,
  setLocalWriteHandler,
  toSyncChange,
  type TransactionRow,
} from './transactions';

const CURSOR_KEY = 'sync.cursor';
const MAX_PUSH_ROUNDS = 20;

export interface SyncStatus {
  syncing: boolean;
  offline: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  pending: number;
  failed: number;
}

let status: SyncStatus = { syncing: false, offline: false, lastSyncedAt: null, lastError: null, pending: 0, failed: 0 };
const statusListeners = new Set<() => void>();

const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => fn());
};

export const syncStatusStore = {
  subscribe: (fn: () => void) => {
    statusListeners.add(fn);
    return () => {
      statusListeners.delete(fn);
    };
  },
  getSnapshot: () => status,
};

const refreshCounts = async () => setStatus(await countUnsynced());

const push = async () => {
  for (let round = 0; round < MAX_PUSH_ROUNDS; round += 1) {
    const rows = await db.getAllAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE dirty = 1 AND sync_error IS NULL ORDER BY client_updated_at LIMIT ?',
      LIMITS.MAX_SYNC_BATCH,
    );
    if (rows.length === 0) return;

    const { results } = await api.transactions.syncPush({ changes: rows.map(toSyncChange) });
    const byId = new Map(rows.map((r) => [r.client_id, r]));

    await db.withTransactionAsync(async () => {
      for (const result of results) {
        const row = byId.get(result.clientId);
        if (!row) continue;
        if (result.status === 'error') {
          await db.runAsync(
            'UPDATE transactions SET sync_error = ? WHERE client_id = ? AND client_updated_at = ?',
            result.message ?? 'Rejected by server',
            row.client_id,
            row.client_updated_at,
          );
        } else if (row.deleted === 1 && result.status === 'applied') {
          await db.runAsync(
            'DELETE FROM transactions WHERE client_id = ? AND client_updated_at = ?',
            row.client_id,
            row.client_updated_at,
          );
        } else if (result.transaction && !result.transaction.deletedAt) {
          // Applied: adopt server ids/version. Conflict: another device won, take its copy.
          await applyServerIfUnchanged(result.transaction, row.client_updated_at);
        } else {
          await db.runAsync(
            'DELETE FROM transactions WHERE client_id = ? AND client_updated_at = ?',
            row.client_id,
            row.client_updated_at,
          );
        }
      }
    });
    emitTransactionsChanged();
    if (rows.length < LIMITS.MAX_SYNC_BATCH) return;
  }
};

const pull = async () => {
  let cursor = await kv.get<string>(CURSOR_KEY);
  for (;;) {
    const res = await api.transactions.syncPull(cursor ?? undefined);
    if (res.changes.length > 0) {
      await db.withTransactionAsync(async () => {
        for (const t of res.changes) {
          if (t.deletedAt) {
            await db.runAsync('DELETE FROM transactions WHERE client_id = ? AND dirty = 0', t.clientId);
          } else {
            await applyServerIfClean(t);
          }
        }
      });
      emitTransactionsChanged();
    }
    cursor = res.serverTime;
    await kv.set(CURSOR_KEY, cursor);
    if (!res.hasMore) return;
  }
};

let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const run = async () => {
  if (!(await tokenStorage.getRefreshToken())) return;
  setStatus({ syncing: true });
  try {
    await push();
    await pull();
    setStatus({ offline: false, lastError: null, lastSyncedAt: new Date().toISOString() });
  } catch (err) {
    setStatus(isOffline(err) ? { offline: true } : { lastError: errorMessage(err) });
  } finally {
    await refreshCounts();
    setStatus({ syncing: false });
  }
};

/** Push local changes then pull remote ones. Concurrent callers share one run. */
export const syncNow = () => (inflight ??= run().finally(() => (inflight = null)));

export const scheduleSync = (delayMs = 1500) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
};

/** Clears the "failed" mark so rejected rows are retried (e.g. after the user fixes them). */
export const retryFailed = async () => {
  await db.runAsync('UPDATE transactions SET sync_error = NULL WHERE dirty = 1');
  await syncNow();
};

export const resetSyncState = () => {
  if (timer) clearTimeout(timer);
  status = { syncing: false, offline: false, lastSyncedAt: null, lastError: null, pending: 0, failed: 0 };
  statusListeners.forEach((fn) => fn());
};

setLocalWriteHandler(() => {
  void refreshCounts();
  scheduleSync();
});
