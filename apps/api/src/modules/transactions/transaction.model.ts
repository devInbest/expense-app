import mongoose, { type InferSchemaType } from 'mongoose';
import { PAYMENT_METHOD_VALUES, TRANSACTION_TYPE_VALUES, type TransactionDTO } from '@expense/shared';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Device-generated id: makes offline creates idempotent and lets the app address unsynced rows. */
    clientId: { type: String, required: true },
    type: { type: String, enum: TRANSACTION_TYPE_VALUES, default: 'expense' },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    note: { type: String, default: '' },
    paymentMethod: { type: String, enum: PAYMENT_METHOD_VALUES, default: 'upi' },
    occurredAt: { type: Date, required: true },
    receiptUrl: { type: String },
    tags: { type: [String], default: [] },
    recurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule' },
    version: { type: Number, default: 1 },
    /** Device clock at the last edit; used for last-write-wins between devices. */
    clientUpdatedAt: { type: Date },
    deletedAt: { type: Date, default: null },
    binnedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, clientId: 1 }, { unique: true });
transactionSchema.index({ userId: 1, deletedAt: 1, occurredAt: -1, _id: -1 });
transactionSchema.index({ userId: 1, updatedAt: 1 });
transactionSchema.index({ userId: 1, categoryId: 1 });
transactionSchema.index({ createdAt: -1 });

export type TransactionAttrs = InferSchemaType<typeof transactionSchema>;
export const Transaction = mongoose.model('Transaction', transactionSchema);

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : undefined);

export const toTransactionDTO = (t: TransactionAttrs & { _id: unknown }): TransactionDTO => ({
  _id: String(t._id),
  clientId: t.clientId,
  type: t.type as TransactionDTO['type'],
  amount: t.amount,
  currency: t.currency,
  categoryId: String(t.categoryId),
  note: t.note ?? '',
  paymentMethod: t.paymentMethod as TransactionDTO['paymentMethod'],
  occurredAt: iso(t.occurredAt)!,
  receiptUrl: t.receiptUrl ?? undefined,
  tags: t.tags ?? [],
  recurringId: t.recurringId ? String(t.recurringId) : undefined,
  version: t.version,
  deletedAt: t.deletedAt ? iso(t.deletedAt) : null,
  binnedAt: t.binnedAt ? iso(t.binnedAt) : null,
  createdAt: iso(t.createdAt)!,
  updatedAt: iso(t.updatedAt)!,
});
