import { z } from 'zod';
import { BANK_TXN_DIRECTION_VALUES, BANK_TXN_STATUS_VALUES, PAYMENT_METHOD_VALUES } from '../constants/enums';
import { LIMITS } from '../constants/limits';
import { amountSchema, currencySchema, cursorQuerySchema, dateSchema, objectIdSchema } from './common';
import { createTransactionSchema } from './finance';
import { createRoomExpenseSchema } from './room';

/** One transaction parsed on the device from a bank SMS. The SMS text itself never leaves the phone. */
export const bankTransactionInputSchema = z.object({
  fingerprint: z.string().trim().min(8).max(160),
  direction: z.enum(BANK_TXN_DIRECTION_VALUES),
  amount: amountSchema,
  currency: currencySchema.optional(),
  occurredAt: dateSchema,
  counterparty: z.string().trim().max(80).default(''),
  bank: z.string().trim().max(60).default(''),
  accountMask: z.string().trim().max(8).default(''),
  reference: z.string().trim().max(40).default(''),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('bank'),
});
export type BankTransactionInput = z.input<typeof bankTransactionInputSchema>;

export const ingestBankTransactionsSchema = z.object({
  items: z.array(bankTransactionInputSchema).max(LIMITS.MAX_SYNC_BATCH),
});
export type IngestBankTransactionsInput = z.input<typeof ingestBankTransactionsSchema>;

export const listBankTransactionsQuerySchema = cursorQuerySchema.extend({
  status: z.enum(BANK_TXN_STATUS_VALUES).default('pending'),
});
export type ListBankTransactionsQuery = z.input<typeof listBankTransactionsQuerySchema>;

export const linkBankTransactionSchema = z.discriminatedUnion('kind', [
  /** Saved as a personal expense or income. `clientId` lets the app keep it in its offline store. */
  z.object({
    kind: z.literal('transaction'),
    transaction: createTransactionSchema.extend({ clientId: z.string().trim().min(8).max(64) }),
  }),
  /** A bill I paid for a room (debits only). */
  z.object({
    kind: z.literal('room_expense'),
    roomId: objectIdSchema,
    expense: createRoomExpenseSchema,
  }),
  /**
   * Paying back a share of a room expense. A debit is me paying my own share;
   * a credit is someone paying me their share of an expense I added.
   */
  z.object({
    kind: z.literal('room_payment'),
    roomId: objectIdSchema,
    expenseId: objectIdSchema,
    userId: objectIdSchema,
  }),
]);
export type LinkBankTransactionInput = z.input<typeof linkBankTransactionSchema>;
