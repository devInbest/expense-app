import { Router } from 'express';
import { createRecurringSchema, updateRecurringSchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { validate } from '../../core/validate';
import { inTz } from '../../lib/dates';
import { logUser } from '../activity/activity.service';
import { assertCategoryUsable } from '../categories/category.service';
import { RecurringRule, toRecurringDTO } from './recurring.model';

const router = Router();
const MAX_RULES = 50;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rules = await RecurringRule.find({ ownerType: 'user', ownerId: req.user!._id, deletedAt: null }).sort({ nextRunAt: 1 }).lean();
    ok(res, rules.map(toRecurringDTO));
  }),
);

router.post(
  '/',
  validate(createRecurringSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const count = await RecurringRule.countDocuments({ ownerType: 'user', ownerId: user._id, deletedAt: null });
    if (count >= MAX_RULES) throw ApiError.badRequest(`You can have up to ${MAX_RULES} recurring entries`);
    await assertCategoryUsable(user._id, req.body.template.categoryId);
    const rule = await RecurringRule.create({
      ...req.body,
      ownerType: 'user',
      ownerId: user._id,
      anchorDay: inTz(req.body.startDate, user.timezone).date(),
      nextRunAt: req.body.startDate,
    });
    logUser(req, 'recurring.created', { entity: 'recurring', entityId: rule._id });
    created(res, toRecurringDTO(rule.toObject()), 'Recurring entry created');
  }),
);

router.patch(
  '/:id',
  validate(updateRecurringSchema),
  asyncHandler(async (req, res) => {
    const rule = await RecurringRule.findOne({ _id: req.params.id, ownerType: 'user', ownerId: req.user!._id, deletedAt: null });
    if (!rule) throw ApiError.notFound('Recurring entry not found');
    if (req.body.template?.categoryId) await assertCategoryUsable(req.user!._id, req.body.template.categoryId);
    if (req.body.template) rule.set('template', { ...rule.toObject().template, ...req.body.template });
    if (req.body.active !== undefined) {
      rule.active = req.body.active;
      // Resuming a paused rule should not backfill everything missed while paused.
      if (req.body.active && rule.nextRunAt < new Date()) rule.nextRunAt = new Date();
    }
    if (req.body.endDate !== undefined) rule.endDate = req.body.endDate;
    await rule.save();
    ok(res, toRecurringDTO(rule.toObject()), 'Recurring entry updated');
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await RecurringRule.updateOne(
      { _id: req.params.id, ownerType: 'user', ownerId: req.user!._id, deletedAt: null },
      { deletedAt: new Date(), active: false },
    );
    if (!result.matchedCount) throw ApiError.notFound('Recurring entry not found');
    ok(res, null, 'Recurring entry deleted');
  }),
);

export default router;
