import mongoose, { type InferSchemaType } from 'mongoose';
import {
  BANK_TXN_DIRECTION_VALUES,
  BANK_TXN_LINK_KIND_VALUES,
  BANK_TXN_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  TRANSACTION_TYPE_VALUES,
  type BankTransactionDTO,
} from '@expense/shared';

const bankTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Same payment seen twice (re-scan, second alert) maps to one row. */
    fingerprint: { type: String, required: true },
    direction: { type: String, enum: BANK_TXN_DIRECTION_VALUES, required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    counterparty: { type: String, default: '' },
    bank: { type: String, default: '' },
    accountMask: { type: String, default: '' },
    reference: { type: String, default: '' },
    paymentMethod: { type: String, enum: PAYMENT_METHOD_VALUES, default: 'bank' },
    status: { type: String, enum: BANK_TXN_STATUS_VALUES, default: 'pending' },
    link: {
      type: new mongoose.Schema(
        {
          kind: { type: String, enum: BANK_TXN_LINK_KIND_VALUES, required: true },
          id: { type: String, required: true },
          roomId: { type: String },
          userId: { type: String },
        },
        { _id: false },
      ),
      default: null,
    },
    linkedAt: { type: Date, default: null },
    /** Held while a link is being created so a double tap can't save it twice; expires on its own. */
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

bankTransactionSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
bankTransactionSchema.index({ userId: 1, status: 1, occurredAt: -1, _id: -1 });

export type BankTransactionAttrs = InferSchemaType<typeof bankTransactionSchema>;
export const BankTransaction = mongoose.model('BankTransaction', bankTransactionSchema);

/** The category last picked for a counterparty, suggested the next time it shows up. */
const merchantRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    type: { type: String, enum: TRANSACTION_TYPE_VALUES, required: true },
  },
  { timestamps: true },
);

merchantRuleSchema.index({ userId: 1, key: 1, type: 1 }, { unique: true });

export const MerchantRule = mongoose.model('MerchantRule', merchantRuleSchema);

export const toBankTransactionDTO = (
  t: BankTransactionAttrs & { _id: unknown },
  suggestion?: BankTransactionDTO['suggestion'],
): BankTransactionDTO => ({
  _id: String(t._id),
  direction: t.direction as BankTransactionDTO['direction'],
  amount: t.amount,
  currency: t.currency,
  occurredAt: new Date(t.occurredAt).toISOString(),
  counterparty: t.counterparty ?? '',
  bank: t.bank ?? '',
  accountMask: t.accountMask ?? '',
  reference: t.reference ?? '',
  paymentMethod: t.paymentMethod as BankTransactionDTO['paymentMethod'],
  status: t.status as BankTransactionDTO['status'],
  link: t.link
    ? {
        kind: t.link.kind as NonNullable<BankTransactionDTO['link']>['kind'],
        id: t.link.id,
        roomId: t.link.roomId ?? undefined,
        userId: t.link.userId ?? undefined,
      }
    : null,
  suggestion: suggestion ?? null,
  createdAt: new Date(t.createdAt).toISOString(),
});
