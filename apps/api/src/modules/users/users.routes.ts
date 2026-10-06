import { Router } from 'express';
import { userSearchQuerySchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { query, validate } from '../../core/validate';
import { PUBLIC_USER_FIELDS, toPublicUser } from './publicUser';
import { User } from './user.model';

const router = Router();

/**
 * Exact-match lookup only (full phone number or username), so the endpoint cannot be used
 * to browse or enumerate the user base.
 */
router.get(
  '/search',
  validate(userSearchQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { q } = query(req, userSearchQuerySchema);
    const filter = q.startsWith('+') ? { phone: q } : { username: q };
    const users = await User.find({ ...filter, status: 'active', onboarded: true, _id: { $ne: req.user!._id } })
      .select(PUBLIC_USER_FIELDS)
      .limit(5)
      .lean();
    ok(res, users.map((u) => toPublicUser(u)));
  }),
);

export default router;
