import { z } from 'zod';
import {
  BUDGET_PERIOD_VALUES,
  PAYMENT_METHOD_VALUES,
  RECURRING_FREQUENCY_VALUES,
  TRANSACTION_TYPE_VALUES,
} from '../constants/enums';
import { LIMITS } from '../constants/limits';
import {
  amountSchema,
  currencySchema,
  cursorQuerySchema,
  dateSchema,
  hexColorSchema,
  noteSchema,
  objectIdSchema,
} from './common';

// ---------- Categories ----------
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  icon: z.string().trim().min(1).max(48).default('tag-outline'),
  color: hexColorSchema.default('#64748B'),
  type: z.enum(TRANSACTION_TYPE_VALUES).default('expense'),
});
export type CreateCategoryInput = z.input<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().omit({ type: true });

export const deleteCategoryQuerySchema = z.object({
  reassignTo: objectIdSchema.optional(),
});

// ---------- Transactions ----------
const transactionFields = {
  type: z.enum(TRANSACTION_TYPE_VALUES).default('expense'),
  amount: amountSchema,
  currency: currencySchema.optional(),
  categoryId: objectIdSchema,
  note: noteSchema,
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('upi'),
  occurredAt: dateSchema,
  receiptUrl: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
};

export const createTransactionSchema = z.object({
  clientId: z.string().trim().min(8).max(64).optional(),
  ...transactionFields,
});
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object(transactionFields).partial();
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;

export const listTransactionsQuerySchema = cursorQuerySchema.extend({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  type: z.enum(TRANSACTION_TYPE_VALUES).optional(),
  categoryId: objectIdSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
  q: z.string().trim().max(64).optional(),
});
export type ListTransactionsQuery = z.input<typeof listTransactionsQuerySchema>;

/** One offline mutation. `clientUpdatedAt` drives last-write-wins conflict resolution. */
export const syncChangeSchema = z.object({
  clientId: z.string().trim().min(8).max(64),
  deleted: z.boolean().default(false),
  binned: z.boolean().optional(),
  clientUpdatedAt: dateSchema,
  data: z.object(transactionFields).partial().optional(),
});
export type SyncChange = z.input<typeof syncChangeSchema>;

export const syncPushSchema = z.object({
  changes: z.array(syncChangeSchema).max(LIMITS.MAX_SYNC_BATCH),
});
export type SyncPushInput = z.input<typeof syncPushSchema>;

export const syncPullQuerySchema = z.object({
  since: dateSchema.optional(),
});

// ---------- Budgets ----------
export const createBudgetSchema = z
  .object({
    categoryId: objectIdSchema.nullable().optional(),
    period: z.enum(BUDGET_PERIOD_VALUES).default('monthly'),
    amount: amountSchema,
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    alertThresholds: z
      .array(z.number().int().min(1).max(200))
      .max(5)
      .default([...LIMITS.BUDGET_ALERT_THRESHOLDS]),
    rollover: z.boolean().default(false),
  })
  .refine((b) => b.period !== 'custom' || (b.startDate && b.endDate), {
    message: 'Custom budgets need a start and end date',
    path: ['endDate'],
  });
export type CreateBudgetInput = z.input<typeof createBudgetSchema>;

export const updateBudgetSchema = z.object({
  amount: amountSchema.optional(),
  alertThresholds: z.array(z.number().int().min(1).max(200)).max(5).optional(),
  rollover: z.boolean().optional(),
  endDate: dateSchema.optional(),
});

// ---------- Recurring ----------
export const recurringTemplateSchema = z.object({
  type: z.enum(TRANSACTION_TYPE_VALUES).default('expense'),
  amount: amountSchema,
  categoryId: objectIdSchema,
  note: noteSchema,
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('upi'),
});

export const createRecurringSchema = z.object({
  template: recurringTemplateSchema,
  frequency: z.enum(RECURRING_FREQUENCY_VALUES),
  interval: z.number().int().min(1).max(12).default(1),
  startDate: dateSchema,
  endDate: dateSchema.optional(),
});
export type CreateRecurringInput = z.input<typeof createRecurringSchema>;

export const updateRecurringSchema = z.object({
  template: recurringTemplateSchema.partial().optional(),
  active: z.boolean().optional(),
  endDate: dateSchema.nullable().optional(),
});

// ---------- Insights / export ----------
export const insightsQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  type: z.enum(TRANSACTION_TYPE_VALUES).default('expense'),
});
export type InsightsQuery = z.input<typeof insightsQuerySchema>;

export const exportQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
});
export type ExportQuery = z.input<typeof exportQuerySchema>;

export const signUploadSchema = z.object({
  purpose: z.enum(['receipt', 'avatar']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().positive().max(5 * 1024 * 1024, 'Image must be under 5 MB'),
});
export type SignUploadInput = z.infer<typeof signUploadSchema>;
