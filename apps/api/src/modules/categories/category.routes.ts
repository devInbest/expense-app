import { Router } from 'express';
import { createCategorySchema, deleteCategoryQuerySchema, updateCategorySchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { parse, validate } from '../../core/validate';
import { logUser } from '../activity/activity.service';
import { Budget } from '../budgets/budget.model';
import { RecurringRule } from '../recurring/recurring.model';
import { Transaction } from '../transactions/transaction.model';
import { Category, toCategoryDTO } from './category.model';
import { uncategorizedId, visibleCategoryFilter } from './category.service';

const router = Router();
const MAX_CUSTOM = 50;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await Category.find(visibleCategoryFilter(req.user!._id)).sort({ ownerType: 1, sortOrder: 1, name: 1 }).lean();
    ok(res, categories.map(toCategoryDTO));
  }),
);

router.post(
  '/',
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const count = await Category.countDocuments({ ownerType: 'user', ownerId: req.user!._id, deletedAt: null });
    if (count >= MAX_CUSTOM) throw ApiError.badRequest(`You can have up to ${MAX_CUSTOM} custom categories`);
    const category = await Category.create({ ...req.body, ownerType: 'user', ownerId: req.user!._id });
    logUser(req, 'category.created', { entity: 'category', entityId: category._id });
    created(res, toCategoryDTO(category.toObject()), 'Category created');
  }),
);

router.patch(
  '/:id',
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, ownerType: 'user', ownerId: req.user!._id, deletedAt: null },
      { $set: req.body },
      { new: true },
    ).lean();
    if (!category) throw ApiError.notFound('Category not found');
    ok(res, toCategoryDTO(category), 'Category updated');
  }),
);

/**
 * Deleting a category moves its transactions and recurring rules to `reassignTo`
 * (or "Uncategorized") so history and totals are never lost. Budgets on it are removed.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { reassignTo } = parse(deleteCategoryQuerySchema, req.query);
    const userId = req.user!._id;
    const category = await Category.findOne({ _id: req.params.id, ownerType: 'user', ownerId: userId, deletedAt: null });
    if (!category) throw ApiError.notFound('Category not found');

    const target = reassignTo ? await Category.findOne({ _id: reassignTo, ...visibleCategoryFilter(userId) }).lean() : null;
    if (reassignTo && (!target || String(target._id) === String(category._id))) throw ApiError.badRequest('Pick a different category to move transactions to');
    const targetId = target?._id ?? (await uncategorizedId());

    await Promise.all([
      Transaction.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: targetId }, $inc: { version: 1 } }),
      RecurringRule.updateMany({ ownerType: 'user', ownerId: userId, 'template.categoryId': category._id }, { 'template.categoryId': targetId }),
      Budget.updateMany({ ownerType: 'user', ownerId: userId, categoryId: category._id, deletedAt: null }, { deletedAt: new Date() }),
    ]);
    category.deletedAt = new Date();
    await category.save();
    logUser(req, 'category.deleted', { entity: 'category', entityId: category._id });
    ok(res, null, 'Category deleted');
  }),
);

export default router;
