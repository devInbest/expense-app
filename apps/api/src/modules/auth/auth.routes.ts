import { Router } from 'express';
import { googleAuthSchema, otpRequestSchema, otpVerifySchema, refreshTokenSchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { validate } from '../../core/validate';
import { appGate, requireUser } from '../../core/auth';
import { authLimiter, otpLimiter } from '../../core/rateLimits';
import { logUser } from '../activity/activity.service';
import { requestOtp } from './otp.service';
import { loginWithGoogle, loginWithPhone, refreshUserTokens } from './auth.service';
import { revokeAllSessions, revokeSession } from './session.service';

const router = Router();

router.use(appGate);

router.post(
  '/otp/request',
  otpLimiter,
  validate(otpRequestSchema),
  asyncHandler(async (req, res) => {
    ok(res, await requestOtp(req.body.phone, 'login', req.ip), 'Code sent');
  }),
);

router.post(
  '/otp/verify',
  authLimiter,
  validate(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const { phone, code, device } = req.body;
    ok(res, await loginWithPhone(phone, code, device, req), 'Signed in');
  }),
);

router.post(
  '/google',
  authLimiter,
  validate(googleAuthSchema),
  asyncHandler(async (req, res) => {
    ok(res, await loginWithGoogle(req.body.idToken, req.body.device, req), 'Signed in');
  }),
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    ok(res, await refreshUserTokens(req.body.refreshToken), 'Token refreshed');
  }),
);

router.post(
  '/logout',
  requireUser,
  asyncHandler(async (req, res) => {
    await revokeSession(req.sessionId);
    logUser(req, 'user.logout');
    ok(res, null, 'Signed out');
  }),
);

router.post(
  '/logout-all',
  requireUser,
  asyncHandler(async (req, res) => {
    await revokeAllSessions('user', req.user!._id, 'logout_all');
    logUser(req, 'user.logout_all');
    ok(res, null, 'Signed out of all devices');
  }),
);

export default router;
