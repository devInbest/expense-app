import { Router } from 'express';
import { trackEventsSchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { validate } from '../../core/validate';
import { AppEvent } from './appEvent.model';

const router = Router();
const MAX_SKEW_MS = 7 * 86400_000;

router.post(
  '/',
  validate(trackEventsSchema),
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const { platform, appVersion, events } = req.body;
    // Device clocks drift; clamp to now and drop events queued for over a week.
    const docs = events
      .filter((e: { at: Date }) => now - e.at.getTime() < MAX_SKEW_MS)
      .map((e: { name: string; sessionId: string; at: Date; props?: Record<string, unknown> }) => ({
        userId: req.user!._id,
        sessionId: e.sessionId,
        name: e.name,
        props: e.props,
        platform,
        appVersion,
        at: e.at.getTime() > now ? new Date(now) : e.at,
      }));
    if (docs.length) await AppEvent.insertMany(docs, { ordered: false });
    ok(res, null, 'Tracked');
  }),
);

export default router;
