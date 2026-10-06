import mongoose from 'mongoose';
import { UNCATEGORIZED_KEY } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { Category } from './category.model';

/** Categories a user may tag personal transactions with: system ones plus their own. */
export const visibleCategoryFilter = (userId: unknown) => ({
  deletedAt: null,
  $or: [{ ownerType: 'system' }, { ownerType: 'user', ownerId: userId }],
});

export const assertCategoryUsable = async (userId: unknown, categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) throw ApiError.badRequest('Pick a category');
  const ok = await Category.exists({ _id: categoryId, ...visibleCategoryFilter(userId) });
  if (!ok) throw ApiError.badRequest('That category no longer exists. Pick another one.');
};

export const uncategorizedId = async () => {
  const c = await Category.findOne({ ownerType: 'system', key: UNCATEGORIZED_KEY }).select('_id').lean();
  if (!c) throw new Error('System categories are not seeded');
  return c._id;
};
