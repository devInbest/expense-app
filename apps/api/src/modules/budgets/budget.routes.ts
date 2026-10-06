import { Router } from 'express';
import { createBudgetSchema, updateBudgetSchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { validate } from '../../core/validate';
import { logUser } from '../activity/activity.service';
import { Budget, toBudgetDTO } from './budget.model';
import { checkBudgetAlerts, listBudgetProgress } from './budget.service';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await listBudgetProgress('user', req.user!._id, req.user!.timezone))),
);

router.post(
  '/',
  validate(createBudgetSchema),
  asyncHandler(async (req, res) => {
    const categoryId = req.body.categoryId ?? null;
    // One active budget per category (or overall) and period keeps progress unambiguous.
    const dup = await Budget.exists({ ownerType: 'user', ownerId: req.user!._id, categoryId, period: req.body.period, deletedAt: null });
    if (dup) throw ApiError.conflict('You already have a budget for this category and period');
    const budget = await Budget.create({ ...req.body, categoryId, ownerType: 'user', ownerId: req.user!._id });
    logUser(req, 'budget.created', { entity: 'budget', entityId: budget._id });
    checkBudgetAlerts('user', String(req.user!._id)).catch(() => undefined);
    created(res, toBudgetDTO(budget.toObject()), 'Budget created');
  }),
);

router.patch(
  '/:id',
  validate(updateBudgetSchema),
  asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({ _id: req.params.id, ownerType: 'user', ownerId: req.user!._id, deletedAt: null });
    if (!budget) throw ApiError.notFound('Budget not found');
    Object.assign(budget, req.body);
    // Raising the limit or thresholds re-arms alerts for the current period.
    budget.notifiedThresholds = [];
    await budget.save();
    ok(res, toBudgetDTO(budget.toObject()), 'Budget updated');
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Budget.updateOne(
      { _id: req.params.id, ownerType: 'user', ownerId: req.user!._id, deletedAt: null },
      { deletedAt: new Date() },
    );
    if (!result.matchedCount) throw ApiError.notFound('Budget not found');
    ok(res, null, 'Budget deleted');
  }),
);

export default router;
