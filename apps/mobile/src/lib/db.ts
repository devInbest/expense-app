import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('expense.db');

/**
 * Each entry upgrades the schema by one version. Never edit a shipped migration;
 * append a new one instead.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    client_id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    category_id TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    receipt_url TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    recurring_id TEXT,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 0,
    client_updated_at TEXT NOT NULL,
    sync_error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions (occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tx_dirty ON transactions (dirty);
  `,
  `
  ALTER TABLE transactions ADD COLUMN binned INTEGER NOT NULL DEFAULT 0;
  UPDATE transactions SET deleted = 0, binned = 1, sync_error = NULL WHERE deleted = 1;
  `,
];

let ready: Promise<void> | null = null;

export const initDb = () =>
  (ready ??= (async () => {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let version = row?.user_version ?? 0;
    while (version < MIGRATIONS.length) {
      const sql = MIGRATIONS[version]!;
      await db.withTransactionAsync(async () => {
        await db.execAsync(sql);
      });
      version += 1;
      await db.execAsync(`PRAGMA user_version = ${version}`);
    }
  })());

export const kv = {
  get: async <T>(key: string): Promise<T | null> => {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return row ? (JSON.parse(row.value) as T) : null;
  },
  set: (key: string, value: unknown) =>
    db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value)),
  remove: (key: string) => db.runAsync('DELETE FROM kv WHERE key = ?', key),
};

/** A join link opened while signed out; resumed after sign-in. */
export const PENDING_JOIN_KEY = 'pending.join';

/** Wipes everything tied to the signed-in user (logout / account deletion). */
export const clearLocalData = async () => {
  await db.execAsync('DELETE FROM transactions; DELETE FROM kv;');
};
