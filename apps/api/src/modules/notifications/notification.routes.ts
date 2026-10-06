import { Router } from 'express';
import { z } from 'zod';
import { objectIdSchema, type NotificationDTO } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { validate } from '../../core/validate';
import { Notification } from './notification.model';

const router = Router();
const PAGE = 30;

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
    const items: NotificationDTO[] = docs.slice(0, PAGE).map((n) => ({
      _id: String(n._id),
      type: n.type as NotificationDTO['type'],
      title: n.title,
      body: n.body,
      data: (n.data as Record<string, unknown>) ?? {},
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));
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

export default router;
