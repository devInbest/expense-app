import { Router } from 'express';
import { adminChangePasswordSchema, adminLoginSchema, refreshTokenSchema, type AdminAuthResult } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { validate } from '../../core/validate';
import { requireAdmin } from '../../core/auth';
import { authLimiter } from '../../core/rateLimits';
import { env } from '../../config/env';
import { signAdminAccess } from '../../lib/tokens';
import { createSession, revokeAllSessions, revokeSession, rotateSession } from '../auth/session.service';
import { logActivity, logAdmin } from '../activity/activity.service';
import { Admin, toAdminDTO } from './admin.model';

const router = Router();

router.post(
  '/login',
  authLimiter,
  validate(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { userName, password } = req.body;
    const admin = await Admin.findOne({ userName }).select('+password');
    if (!admin || !(await admin.comparePassword(password))) {
      logActivity({ actorType: 'system', action: 'admin.login_failed', meta: { userName }, req });
      throw ApiError.unauthorized('Invalid username or password');
    }
    if (!admin.isActive) throw ApiError.unauthorized('Account is deactivated');

    const { session, refreshToken } = await createSession({
      subjectType: 'admin',
      subjectId: admin._id,
      ttlDays: env.jwt.adminRefreshTtlDays,
      req,
    });
    admin.lastLogin = new Date();
    await admin.save();
    logActivity({ actorType: 'admin', actorId: admin._id, action: 'admin.login', req });

    const result: AdminAuthResult = {
      admin: toAdminDTO(admin.toObject()),
      accessToken: signAdminAccess(String(admin._id), String(session._id)),
      refreshToken,
    };
    ok(res, result, 'Signed in');
  }),
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { session, refreshToken } = await rotateSession(req.body.refreshToken, 'admin', env.jwt.adminRefreshTtlDays);
    const admin = await Admin.findById(session.subjectId).select('isActive');
    if (!admin?.isActive) throw ApiError.unauthorized('Admin account not found or inactive');
    ok(res, { accessToken: signAdminAccess(String(admin._id), String(session._id)), refreshToken }, 'Token refreshed');
  }),
);

router.post(
  '/logout',
  requireAdmin(),
  asyncHandler(async (req, res) => {
    await revokeSession(req.sessionId);
    ok(res, null, 'Signed out');
  }),
);

router.get(
  '/me',
  requireAdmin(),
  asyncHandler(async (req, res) => ok(res, toAdminDTO(req.admin!.toObject()))),
);

router.put(
  '/change-password',
  requireAdmin(),
  validate(adminChangePasswordSchema),
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.admin!._id).select('+password');
    if (!admin || !(await admin.comparePassword(req.body.currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    admin.password = req.body.newPassword;
    await admin.save();
    await revokeAllSessions('admin', admin._id, 'password_change');
    logAdmin(req, 'admin.password_changed');
    ok(res, null, 'Password updated. Please sign in again.');
  }),
);

export default router;
