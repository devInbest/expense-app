import { z } from 'zod';
import { amountSchema, currencySchema, dateSchema, noteSchema } from './common';

/** Cash isn't a saved account, so it has a fixed id. */
export const CASH_ACCOUNT_ID = 'cash';

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
export const createTransferSchema = z
  .object(transferFields)
  .refine((t) => t.fromAccount !== t.toAccount, { message: 'Pick two different accounts', path: ['toAccount'] });
export type CreateTransferInput = z.input<typeof createTransferSchema>;

export const updateTransferSchema = z.object(transferFields).partial();
export type UpdateTransferInput = z.input<typeof updateTransferSchema>;

export const listTransfersQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type ListTransfersQuery = z.input<typeof listTransfersQuerySchema>;
