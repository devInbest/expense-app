import { z } from 'zod';
import { LIMITS } from '../constants/limits';
import { amountSchema, currencySchema, dateSchema, noteSchema } from './common';

/** Cash isn't a saved account, so it has a fixed id. */
export const CASH_ACCOUNT_ID = 'cash';

/** Start of the day, `LIMITS.TRANSFER_MAX_MONTHS_BACK` months before `now`: the earliest date a self transfer can have. */
export const earliestTransferDate = (now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth() - LIMITS.TRANSFER_MAX_MONTHS_BACK, now.getDate());
  // e.g. 31 Aug - 6 months rolls over into March; clamp to the month's last day instead.
  if (d.getDate() !== now.getDate()) d.setDate(0);
  return d;
};

export const TRANSFER_TOO_OLD_MESSAGE = `Self transfers can only be dated up to ${LIMITS.TRANSFER_MAX_MONTHS_BACK} months back`;

/** `cash` or the id of a saved bank account / card (see `UserDTO.accounts`). */
const endpointSchema = z.string().trim().min(1, 'Pick an account').max(64);

const transferFields = {
  amount: amountSchema,
  currency: currencySchema.optional(),
  fromAccount: endpointSchema,
  toAccount: endpointSchema,
  occurredAt: dateSchema,
  note: noteSchema,
};

/** Moving your own money between cash, bank accounts and cards. Not counted as spending or income. */
/** Fields without the cross-field check, for embedding in other schemas (e.g. linking a bank transaction). */
export const transferBodySchema = z.object(transferFields);

export const createTransferSchema = transferBodySchema
  .refine((t) => t.fromAccount !== t.toAccount, { message: 'Pick two different accounts', path: ['toAccount'] });
export type CreateTransferInput = z.input<typeof createTransferSchema>;

export const updateTransferSchema = z.object(transferFields).partial();
export type UpdateTransferInput = z.input<typeof updateTransferSchema>;

export const listTransfersQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type ListTransfersQuery = z.input<typeof listTransfersQuerySchema>;
