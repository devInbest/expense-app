import { PermissionsAndroid, Platform } from 'react-native';
import { qk } from '@expense/api-client';
import { LIMITS, parseBankSms, type BankTransactionInput } from '@expense/shared';
import { SmsInbox } from '../../modules/sms-inbox';
import { api } from './api';
import { kv } from './db';
import { queryClient } from './queryClient';

const CURSOR_KEY = 'bank.sms.cursor';
/** How far back the first scan looks. */
const FIRST_SCAN_DAYS = 60;
const PAGE_SIZE = 500;

/** False on iOS/web (no SMS access) and on Android builds made before the native module existed. */
export const smsImportSupported = Platform.OS === 'android' && SmsInbox !== null;

export const hasSmsPermission = () => SmsInbox?.hasPermission() ?? false;

export type SmsPermissionResult = 'granted' | 'denied' | 'blocked';

export const requestSmsPermission = async (): Promise<SmsPermissionResult> => {
  if (!smsImportSupported) return 'denied';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
};

/** Bank import is on exactly when the app can read SMS. */
export const isSmsImportEnabled = () => smsImportSupported && hasSmsPermission();

/** Query key for the Bank tab's "is SMS access granted" check. */
export const SMS_ACCESS_KEY = ['bank-sms-access'] as const;

/** Asks for SMS access (if not granted yet) right after sign-in, like notifications, then imports. */
export const promptSmsAccess = async () => {
  if (!smsImportSupported) return;
  if (!hasSmsPermission() && (await requestSmsPermission()) !== 'granted') return;
  await queryClient.invalidateQueries({ queryKey: SMS_ACCESS_KEY });
  const added = await autoScanBankSms();
  if (added > 0) await queryClient.invalidateQueries({ queryKey: qk.bankAll });
};

/**
 * Reads new SMS since the last scan, keeps only bank transactions (parsed on the phone), and uploads
 * just the parsed fields. The server dedupes, so a re-scan or a second alert for the same payment adds
 * nothing. The cursor only moves after a page is uploaded, so a failed upload is retried next time.
 */
const scan = async (): Promise<number> => {
  if (!SmsInbox || !SmsInbox.hasPermission()) return 0;
  let cursor = (await kv.get<number>(CURSOR_KEY)) ?? Date.now() - FIRST_SCAN_DAYS * 86_400_000;
  let added = 0;
  for (;;) {
    const page = await SmsInbox.readAsync(cursor, PAGE_SIZE);
    if (!page.length) break;

    const items = new Map<string, BankTransactionInput>();
    for (const sms of page) {
      const parsed = parseBankSms(sms);
      if (parsed) items.set(parsed.fingerprint, parsed);
    }
    const batch = [...items.values()];
    for (let i = 0; i < batch.length; i += LIMITS.MAX_SYNC_BATCH) {
      const res = await api.bank.ingest({ items: batch.slice(i, i + LIMITS.MAX_SYNC_BATCH) });
      added += res.added;
    }

    cursor = page[page.length - 1]!.receivedAt;
    await kv.set(CURSOR_KEY, cursor);
    if (page.length < PAGE_SIZE) break;
  }
  return added;
};

let inflight: Promise<number> | null = null;

/** Concurrent callers share one scan. Resolves to how many new bank transactions were found. */
export const scanBankSms = () => {
  inflight ??= scan().finally(() => {
    inflight = null;
  });
  return inflight;
};

/** Calls `fn` when a new SMS lands while the app is running. Returns an unsubscribe function. */
export const onNewSms = (fn: () => void) => {
  const sub = SmsInbox?.addListener('onSmsReceived', fn);
  return () => sub?.remove();
};

/** Background scan on app open / foreground / new SMS; quiet and skipped without SMS access. */
export const autoScanBankSms = async () => {
  if (!isSmsImportEnabled()) return 0;
  return scanBankSms().catch((err) => {
    console.warn('Bank SMS scan failed', err);
    return 0;
  });
};
