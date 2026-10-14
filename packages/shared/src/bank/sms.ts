import type { BankTxnDirection, PaymentMethod } from '../constants/enums';
import { LIMITS } from '../constants/limits';
import { bankFromSender } from './banks';

export interface BankSms {
  /** Sender as the phone shows it, e.g. `AX-HDFCBK-S`. */
  sender: string;
  body: string;
  /** Epoch ms when the SMS arrived; used as the transaction time. */
  receivedAt: number;
}

export interface ParsedBankSms {
  /** Stable id for the same transaction across re-scans and duplicate alerts. */
  fingerprint: string;
  direction: BankTxnDirection;
  /** Minor units (paise). */
  amount: number;
  occurredAt: string;
  counterparty: string;
  bank: string;
  accountMask: string;
  reference: string;
  paymentMethod: PaymentMethod;
}

/**
 * DLT business headers (`AX-HDFCBK`, `VM-SBIUPI-S`, bare `ICICIB`) and short codes. Ten-digit
 * personal numbers are rejected so a forwarded or spoofed text can't create transactions.
 */
const senderCode = (sender: string): string | null => {
  const s = sender.trim().toUpperCase();
  const header = /^(?:[A-Z0-9]{2}-)?([A-Z0-9]{3,9})(?:-[A-Z])?$/.exec(s);
  if (header && /[A-Z]/.test(header[1]!)) return header[1]!;
  if (/^\d{5,8}$/.test(s)) return s;
  return null;
};

// ---------- what isn't a completed transaction ----------
const OTP = [
  /\b(?:otp|one[\s-]?time[\s-]?password|verification code)\b(?:[^.]|\.(?=\d)){0,80}?\b(?:is|:)\s*\d{4,8}\b/i,
  /\b\d{4,8}\s+is\s+(?:your|the)\b[^.]{0,30}\b(?:otp|one[\s-]?time|code)\b/i,
];
const NOT_A_TRANSACTION = [
  ...OTP,
  /\b(?:has requested|is requesting|requested (?:money|payment|rs|inr)|collect request|payment request from)\b/i,
  /\b(?:will be (?:debited|deducted|charged|auto[\s-]?debited)|to be debited|is due|due (?:on|by|date)|payment due|amount due|min(?:imum)? (?:amt|amount) due|total (?:amt|amount) due|bill (?:is |has been )?generated|statement (?:is |has been )?generated|reminder)\b/i,
  /\b(?:mandate|autopay|auto[\s-]?pay|e-?mandate|standing instruction)\b[^.]{0,60}\b(?:created|registered|set up|setup|activated|approved|modified|revoked|cancelled|canceled|paused)\b/i,
];
const FAILED = /\b(?:failed|declined|unsuccessful|not successful|could not be (?:processed|completed)|was not processed|has been rejected|insufficient (?:funds|balance))\b/i;
const PROMO = /\b(?:pre[\s-]?approved|loan (?:offer|of up ?to|up ?to)|get up ?to|apply now|eligible for|limited period|congratulations|offers?)\b/i;

// ---------- direction ----------
const REVERSAL = /\b(?:reversed|reversal|refund(?:ed)?)\b/i;
const INTO_YOUR = /\b(?:transferred|sent|paid|deposited)\s+(?:to|in|into)\s+your\b/i;
const DEBIT =
  /\b(?:debited|debit(?!\s*card)|spent|paid|sent|withdrawn|withdrawal|purchased?|deducted|charged|transferred(?!\s+(?:to|in|into)\s+your)|thank you for using|txn of|transaction of|dr\.?(?=\s*(?:with|by|for|of|from|to|rs|inr|₹)))(?![a-z])/i;
const CREDIT = /\b(?:credited|received|deposited|cashback|cr\.?(?=\s*(?:with|by|for|of|from|to|rs|inr|₹)))(?![a-z])/i;

const directionOf = (body: string): BankTxnDirection | null => {
  if (REVERSAL.test(body) || INTO_YOUR.test(body)) return 'credit';
  const debit = DEBIT.exec(body)?.index ?? Infinity;
  const credit = CREDIT.exec(body)?.index ?? Infinity;
  if (debit === Infinity && credit === Infinity) return null;
  return debit <= credit ? 'debit' : 'credit';
};

// ---------- amount ----------
const CURRENCY_AMOUNT = /(?:\b(?:rs|inr)\.?|₹)\s*:?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi;
const BARE_AMOUNT = /\b(?:debited|credited|dr|cr)\.?\s*(?:by|with|for|of)\s+(\d[\d,]*(?:\.\d{1,2})?)\b/i;
/** Text right before an amount that marks it as a balance or limit, not the transaction. */
const BALANCE_PREFIX = /(?:\bbal(?:ance)?|\bavl|\bavail(?:able)?|\blimit|\boutstanding|\bdue|o\/s)(?:\s*(?:bal(?:ance)?|amt|amount|is|of|lmt|limit|:|-|\.))*\s*$/i;

const toPaise = (raw: string) => Math.round(Number.parseFloat(raw.replace(/,/g, '')) * 100);

const amountOf = (body: string): number | null => {
  for (const m of body.matchAll(CURRENCY_AMOUNT)) {
    const before = body.slice(Math.max(0, m.index - 24), m.index);
    if (BALANCE_PREFIX.test(before)) continue;
    const paise = toPaise(m[1]!);
    if (paise > 0) return paise;
  }
  const bare = BARE_AMOUNT.exec(body);
  return bare ? toPaise(bare[1]!) : null;
};

// ---------- details ----------
const ACCOUNT = /\b(?:a\/c|acct|account|ac|card)\b(?:\s*(?:no|number|num)\b\.?)?(?:\s*ending(?:\s*(?:with|in))?)?\s*[:-]?\s*[x*#.-]*\s*(\d{3,})\b/i;

const REFERENCE =
  /\b(?:upi\s*ref(?:erence)?(?:\s*(?:no|num(?:ber)?))?|ref(?:erence)?(?:\s*(?:no|num(?:ber)?|id))?|utr(?:\s*no)?|rrn|txn\s*(?:id|no|ref)|transaction\s*(?:id|ref(?:erence)?)(?:\s*no)?|imps\s*ref(?:\s*no)?|upi)\s*[:.#-]?\s*(?:no\.?\s*)?([a-z0-9]*\d[a-z0-9]{5,24})\b/i;
const UPI_PATH = /\bupi\/(?:p2[ampb]|[a-z]{2,4})\/(\d{6,})\/([^/]{2,40}?)(?=\/|\s+(?:not you|avl|bal)\b|\s*$)/i;

const VPA = /\b([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,30})\b(?!\.[a-z])/i;
const STOP = String.raw`(?:your|you|a\/?c|acct|account|ac|card|the|upi|imps|neft|rtgs|vpa|rs|inr|bank|be|on|date|beneficiary|mobile)`;
const NAME = String.raw`([a-z0-9][a-z0-9 &'._@*/-]{1,40}?)`;
const END = String.raw`(?=\s+(?:on|via|using|ref|refno|upi|imps|neft|rtgs|from|dated|avl|is|has|not|for|at|with|txn|info|bal|and)\b|\s*[,;:()]|\.(?:\s|$)|\s+-|\s*$)`;
const TO = new RegExp(String.raw`\b(?:trf to|transfer(?:red)? to|paid to|sent to|to|towards|favou?ring)\s+(?!${STOP}\b)${NAME}${END}`, 'i');
const FROM = new RegExp(String.raw`\b(?:received from|transfer from|from|by)\s+(?!${STOP}\b)${NAME}${END}`, 'i');
const AT = new RegExp(String.raw`\bat\s+(?!\d{1,2}:\d{2})${NAME}${END}`, 'i');
/** Card alerts: "... on 05-Oct-26 on AMAZON PAY IN." Merchant names are upper case. */
const ON_MERCHANT = /\bon\s+([A-Z][A-Z0-9 &'.*_-]{2,40}?)(?=\.\s|\.$|\s+(?:Avl|AVL|on|via|Ref|REF)\b|\s*$)/;
/** ICICI style: "debited for Rs 349.00 on 05-Oct-26; Netflix credited." */
const SEMI_CREDITED = /;\s*([^;.]{2,40}?)\s+credited\b/i;

const tidy = (v: string | undefined) => {
  const out = (v ?? '').replace(/\s+/g, ' ').replace(/[\s.,;:*/-]+$/, '').trim().slice(0, 60);
  return /^\d*$/.test(out) ? '' : out;
};

const counterpartyOf = (body: string, direction: BankTxnDirection): string => {
  const upiPath = UPI_PATH.exec(body);
  if (upiPath) return tidy(upiPath[2]);
  if (direction === 'debit') {
    const semi = SEMI_CREDITED.exec(body);
    if (semi) return tidy(semi[1]);
  }
  const vpa = VPA.exec(body);
  if (vpa) return vpa[1]!.toLowerCase();
  const named = (direction === 'debit' ? TO : FROM).exec(body);
  if (named && tidy(named[1])) return tidy(named[1]);
  if (direction === 'debit') return tidy(AT.exec(body)?.[1]) || tidy(ON_MERCHANT.exec(body)?.[1]);
  return '';
};

const paymentMethodOf = (body: string): PaymentMethod => {
  if (/\bupi\b|\bvpa\b|@[a-z]/i.test(body)) return 'upi';
  if (/\bcard\b/i.test(body)) return 'card';
  return 'bank';
};

/**
 * Turns a bank alert SMS into a transaction, or `null` for anything that isn't a completed
 * debit or credit (OTPs, balance alerts, payment requests, reminders, failed payments, offers).
 * Works on wording rather than per-bank templates, so new or small banks are covered too.
 */
export const parseBankSms = (sms: BankSms): ParsedBankSms | null => {
  const code = senderCode(sms.sender);
  if (!code) return null;
  const body = sms.body.replace(/\s+/g, ' ').trim();
  if (!body) return null;

  if (NOT_A_TRANSACTION.some((rx) => rx.test(body))) return null;
  const reversal = REVERSAL.test(body);
  if (!reversal && FAILED.test(body)) return null;

  const direction = directionOf(body);
  if (!direction) return null;
  const amount = amountOf(body);
  if (!amount || amount > LIMITS.MAX_AMOUNT_MINOR) return null;

  const account = ACCOUNT.exec(body)?.[1] ?? '';
  const accountMask = account.slice(-4);
  const bank = bankFromSender(code, body);
  const upiPath = UPI_PATH.exec(body);
  const reference = (upiPath?.[1] ?? REFERENCE.exec(body)?.[1] ?? '').toUpperCase();

  // Merchants and apps also send "paid"/"received" texts; without an account, a bank, or a
  // bank reference it's most likely one of those (or marketing).
  if (!accountMask && !bank.known && !reference) return null;
  if (!accountMask && PROMO.test(body)) return null;

  const fingerprint = reference
    ? `${direction}:${amount}:${reference}`
    : `${direction}:${amount}:${accountMask}:${code}:${Math.floor(sms.receivedAt / 60_000)}`;

  return {
    fingerprint,
    direction,
    amount,
    occurredAt: new Date(sms.receivedAt).toISOString(),
    counterparty: counterpartyOf(body, direction),
    bank: bank.name,
    accountMask,
    reference,
    paymentMethod: paymentMethodOf(body),
  };
};

/** Normalised counterparty used to remember the category picked for it last time. */
export const merchantKey = (counterparty: string) =>
  counterparty
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60);
