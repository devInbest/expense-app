import mongoose, { type InferSchemaType } from 'mongoose';
import { CATEGORY_OWNER_TYPE_VALUES, TRANSACTION_TYPE_VALUES, type CategoryDTO } from '@expense/shared';

const categorySchema = new mongoose.Schema(
  {
    key: { type: String },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: 'tag-outline' },
    color: { type: String, default: '#64748B' },
    type: { type: String, enum: TRANSACTION_TYPE_VALUES, default: 'expense' },
    ownerType: { type: String, enum: CATEGORY_OWNER_TYPE_VALUES, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

categorySchema.index({ ownerType: 1, ownerId: 1, deletedAt: 1 });
categorySchema.index({ key: 1 }, { unique: true, partialFilterExpression: { ownerType: 'system' } });

export type CategoryAttrs = InferSchemaType<typeof categorySchema>;
export const Category = mongoose.model('Category', categorySchema);

export const toCategoryDTO = (c: CategoryAttrs & { _id: unknown }): CategoryDTO => ({
  _id: String(c._id),
  key: c.key ?? undefined,
  name: c.name,
  icon: c.icon,
  color: c.color,
  type: c.type as CategoryDTO['type'],
  ownerType: c.ownerType as CategoryDTO['ownerType'],
});
