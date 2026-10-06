import mongoose, { type InferSchemaType } from 'mongoose';
import {
  OWNER_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  RECURRING_FREQUENCY_VALUES,
  TRANSACTION_TYPE_VALUES,
  type RecurringRuleDTO,
} from '@expense/shared';

const recurringSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: OWNER_TYPE_VALUES, default: 'user' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    template: {
      type: { type: String, enum: TRANSACTION_TYPE_VALUES, default: 'expense' },
      amount: { type: Number, required: true },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
      note: { type: String, default: '' },
      paymentMethod: { type: String, enum: PAYMENT_METHOD_VALUES, default: 'upi' },
    },
    frequency: { type: String, enum: RECURRING_FREQUENCY_VALUES, required: true },
    interval: { type: Number, default: 1 },
    /** Day-of-month anchor so "31st monthly" lands on the last day of short months, then returns to 31. */
    anchorDay: { type: Number },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

recurringSchema.index({ active: 1, deletedAt: 1, nextRunAt: 1 });
recurringSchema.index({ ownerType: 1, ownerId: 1 });

export type RecurringAttrs = InferSchemaType<typeof recurringSchema>;
export const RecurringRule = mongoose.model('RecurringRule', recurringSchema);

export const toRecurringDTO = (r: RecurringAttrs & { _id: unknown }): RecurringRuleDTO => ({
  _id: String(r._id),
  template: {
    type: r.template!.type as RecurringRuleDTO['template']['type'],
    amount: r.template!.amount,
    categoryId: String(r.template!.categoryId),
    note: r.template!.note ?? '',
    paymentMethod: r.template!.paymentMethod as RecurringRuleDTO['template']['paymentMethod'],
  },
  frequency: r.frequency as RecurringRuleDTO['frequency'],
  interval: r.interval,
  startDate: r.startDate.toISOString(),
  endDate: r.endDate ? r.endDate.toISOString() : null,
  nextRunAt: r.nextRunAt.toISOString(),
  lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : undefined,
  active: r.active,
});
