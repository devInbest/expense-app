import { Router } from 'express';
import {
  completeOnboardingSchema,
  deleteAccountSchema,
  linkGoogleSchema,
  linkPhoneVerifySchema,
  otpRequestSchema,
  registerPushTokenSchema,
  updateProfileSchema,
} from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { parse, validate } from '../../core/validate';
import { otpLimiter } from '../../core/rateLimits';
import { logUser } from '../activity/activity.service';
import { requestOtp } from '../auth/otp.service';
import { listActiveSessions, revokeSession } from '../auth/session.service';
import { Session } from '../auth/session.model';
import { Device } from '../notifications/device.model';
import { toUserDTO } from './user.model';
import { assertPhoneAvailable, completeOnboarding, deleteAccount, linkGoogle, linkPhone, updateProfile } from './user.service';

const router = Router();

router.get('/', asyncHandler(async (req, res) => ok(res, toUserDTO(req.user!))));

router.patch(
  '/',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await updateProfile(req.user!, req.body);
    logUser(req, 'user.profile_updated', { meta: { fields: Object.keys(req.body) } });
    ok(res, toUserDTO(user), 'Profile updated');
  }),
);

router.post(
  '/onboarding',
  validate(completeOnboardingSchema),
  asyncHandler(async (req, res) => {
    const user = await completeOnboarding(req.user!, req.body);
    logUser(req, 'user.onboarded', { meta: { currency: req.body.defaultCurrency } });
    ok(res, toUserDTO(user), 'Welcome aboard');
  }),
);

router.get(
  '/sessions',
  asyncHandler(async (req, res) => ok(res, await listActiveSessions('user', req.user!._id, req.sessionId))),
);

router.delete(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    const session = await Session.findOne({ _id: req.params.id, subjectType: 'user', subjectId: req.user!._id });
    if (!session) throw ApiError.notFound('Session not found');
    await revokeSession(session._id, 'revoked_by_user');
    await Device.deleteOne({ userId: req.user!._id, deviceId: session.deviceId });
    logUser(req, 'user.session_revoked', { meta: { deviceId: session.deviceId } });
    ok(res, null, 'Device signed out');
  }),
);

router.post(
  '/devices',
  validate(registerPushTokenSchema),
  asyncHandler(async (req, res) => {
    const { deviceId, expoPushToken, platform } = req.body;
    // A token belongs to one install; if another account used this phone before, detach it.
    await Device.deleteMany({ expoPushToken, userId: { $ne: req.user!._id } });
    await Device.updateOne(
      { userId: req.user!._id, deviceId },
      { $set: { expoPushToken, platform, enabled: true, lastSeenAt: new Date() } },
      { upsert: true },
    );
    ok(res, null, 'Device registered');
  }),
);

router.delete(
  '/devices/:deviceId',
  asyncHandler(async (req, res) => {
    await Device.deleteOne({ userId: req.user!._id, deviceId: req.params.deviceId });
    ok(res, null, 'Device removed');
  }),
);

router.post(
  '/phone/request',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = parse(otpRequestSchema, req.body);
    await assertPhoneAvailable(phone, req.user!._id);
    ok(res, await requestOtp(phone, 'change_phone', req.ip), 'Code sent');
  }),
);

router.post(
  '/phone/verify',
  validate(linkPhoneVerifySchema),
  asyncHandler(async (req, res) => {
    const user = await linkPhone(req.user!, req.body.phone, req.body.code, req);
    ok(res, toUserDTO(user), 'Phone number verified');
  }),
);

router.post(
  '/google',
  validate(linkGoogleSchema),
  asyncHandler(async (req, res) => {
    const user = await linkGoogle(req.user!, req.body.idToken, req);
    ok(res, toUserDTO(user), 'Google account linked');
  }),
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    parse(deleteAccountSchema, req.query);
    await deleteAccount(req.user!, req);
    ok(res, null, 'Your account has been deleted');
  }),
);

export default router;
