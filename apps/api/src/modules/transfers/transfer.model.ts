import mongoose, { type InferSchemaType } from 'mongoose';
import type { TransferDTO } from '@expense/shared';

const transferSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    /** `cash` or a saved account id from `User.accounts`. */
    fromAccount: { type: String, required: true },
    toAccount: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    note: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

transferSchema.index({ userId: 1, deletedAt: 1, occurredAt: -1 });

export type TransferAttrs = InferSchemaType<typeof transferSchema>;
export const Transfer = mongoose.model('Transfer', transferSchema);

export const toTransferDTO = (t: TransferAttrs & { _id: unknown }): TransferDTO => ({
  _id: String(t._id),
  amount: t.amount,
  currency: t.currency,
  fromAccount: t.fromAccount,
  toAccount: t.toAccount,
  occurredAt: new Date(t.occurredAt).toISOString(),
  note: t.note ?? '',
  createdAt: new Date(t.createdAt as Date).toISOString(),
  updatedAt: new Date(t.updatedAt as Date).toISOString(),
});
