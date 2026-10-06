import { z } from 'zod';
import { CURRENCY_CODES } from '../constants/currencies';
import { LIMITS } from '../constants/limits';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter the phone number with country code, e.g. +919876543210'));

export const currencySchema = z.enum(CURRENCY_CODES);

/** Money is always an integer in minor units (paise / cents). */
export const amountSchema = z
  .number({ invalid_type_error: 'Amount is required' })
  .int('Amount must be in minor units')
  .positive('Amount must be greater than zero')
  .max(LIMITS.MAX_AMOUNT_MINOR, 'Amount is too large');

export const noteSchema = z.string().trim().max(LIMITS.MAX_NOTE_LENGTH).optional().default('');

/** Accepts ISO strings (what clients send over JSON) or Dates; always parses to a Date. */
export const dateSchema = z
  .union([z.string(), z.number(), z.date()])
  .pipe(z.coerce.date({ invalid_type_error: 'Invalid date' }));

/** A UPI ID (VPA) such as 9876543210@ybl. Plain UPI numbers aren't accepted: pay links can only carry a UPI ID. */
export const upiIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/, 'Enter your UPI ID, e.g. 9876543210@ybl or name@okicici');

/** UPI numbers saved before only UPI IDs were accepted. */
export const isUpiNumber = (v: string) => /^\d{8,10}$/.test(v);

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a hex color like #22C55E');

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(LIMITS.PAGE_SIZE),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

export const dateRangeQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export const idParamSchema = z.object({ id: objectIdSchema });
