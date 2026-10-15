import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { objectIdSchema, type NotificationDTO } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { validate } from '../../core/validate';
import { Notification } from './notification.model';

const router = Router();
const PAGE = 30;

type NotificationDoc = { _id: unknown; type: string; title: string; body: string; data?: unknown; readAt?: Date | null; createdAt: Date };

const toDTO = (n: NotificationDoc): NotificationDTO => ({
  _id: String(n._id),
  type: n.type as NotificationDTO['type'],
  title: n.title,
  body: n.body,
  data: (n.data as Record<string, unknown>) ?? {},
  readAt: n.readAt ? n.readAt.toISOString() : null,
  createdAt: n.createdAt.toISOString(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!._id;
    const cursor = typeof req.query.cursor === 'string' && /^[a-f\d]{24}$/i.test(req.query.cursor) ? req.query.cursor : null;
    const docs = await Notification.find({ userId, ...(cursor ? { _id: { $lt: cursor } } : {}) })
      .sort({ _id: -1 })
      .limit(PAGE + 1)
      .lean();
    const unread = await Notification.countDocuments({ userId, readAt: null });
    const items = docs.slice(0, PAGE).map(toDTO);
    ok(res, { items, nextCursor: docs.length > PAGE ? items[items.length - 1]._id : null, unread });
  }),
);

router.post(
  '/read',
  validate(z.object({ ids: z.array(objectIdSchema).max(100).optional() })),
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { userId: req.user!._id, readAt: null };
    if (req.body.ids?.length) filter._id = { $in: req.body.ids };
    await Notification.updateMany(filter, { readAt: new Date() });
    ok(res, null, 'Marked as read');
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Notification not found');
    const doc = await Notification.findOne({ _id: req.params.id, userId: req.user!._id }).lean();
    if (!doc) throw ApiError.notFound('Notification not found');
    ok(res, toDTO(doc));
  }),
);

export default router;
