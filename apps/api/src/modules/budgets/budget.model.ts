import mongoose, { type InferSchemaType } from 'mongoose';
import { BUDGET_PERIOD_VALUES, OWNER_TYPE_VALUES, type BudgetDTO } from '@expense/shared';

const budgetSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: OWNER_TYPE_VALUES, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    period: { type: String, enum: BUDGET_PERIOD_VALUES, default: 'monthly' },
    amount: { type: Number, required: true, min: 1 },
    startDate: { type: Date },
    endDate: { type: Date },
    alertThresholds: { type: [Number], default: [80, 100] },
    rollover: { type: Boolean, default: false },
    /** "<periodStartISO>:<threshold>" markers so each alert fires once per period. */
    notifiedThresholds: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

budgetSchema.index({ ownerType: 1, ownerId: 1, deletedAt: 1 });

export type BudgetAttrs = InferSchemaType<typeof budgetSchema>;
export const Budget = mongoose.model('Budget', budgetSchema);

export const toBudgetDTO = (b: BudgetAttrs & { _id: unknown }): BudgetDTO => ({
  _id: String(b._id),
  ownerType: b.ownerType as BudgetDTO['ownerType'],
  ownerId: String(b.ownerId),
  categoryId: b.categoryId ? String(b.categoryId) : null,
  period: b.period as BudgetDTO['period'],
  amount: b.amount,
  startDate: b.startDate ? b.startDate.toISOString() : undefined,
  endDate: b.endDate ? b.endDate.toISOString() : undefined,
  alertThresholds: b.alertThresholds,
  rollover: b.rollover,
});
