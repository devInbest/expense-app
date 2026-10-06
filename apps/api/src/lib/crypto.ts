import crypto from 'node:crypto';
import { env } from '../config/env';

export const hmac = (value: string) => crypto.createHmac('sha256', env.hashSecret).update(value).digest('hex');

export const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export const randomDigits = (length: number) =>
  Array.from({ length }, () => crypto.randomInt(10)).join('');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const randomCode = (length = 8) =>
  Array.from({ length }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

export const uuid = () => crypto.randomUUID();

const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SPECIAL = '!@#$%^&*';

/** Random password guaranteed to contain lower/upper/digit/special chars. */
export const generatePassword = (length = 12) => {
  const pick = (chars: string) => chars[crypto.randomInt(chars.length)];
  const all = LOWER + UPPER + DIGITS + SPECIAL;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};
