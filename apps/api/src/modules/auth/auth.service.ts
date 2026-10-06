import type { Request } from 'express';
import { ERROR_CODES, type AuthResult, type DeviceInfo } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { env } from '../../config/env';
import { verifyGoogleIdToken } from '../../lib/google';
import { signUserAccess } from '../../lib/tokens';
import { logActivity } from '../activity/activity.service';
import { linkPhoneInvitesToUser } from '../rooms/invite.service';
import { User, toUserDTO, type UserDoc } from '../users/user.model';
import { verifyOtp } from './otp.service';
import { createSession, rotateSession } from './session.service';

const assertCanSignIn = (user: UserDoc) => {
  if (user.status === 'blocked') {
    throw ApiError.forbidden('Your account has been suspended. Contact support for help.', ERROR_CODES.ACCOUNT_BLOCKED);
  }
};

export const issueTokens = async (user: UserDoc, isNewUser: boolean, device: DeviceInfo | undefined, req: Request): Promise<AuthResult> => {
  const { session, refreshToken } = await createSession({
    subjectType: 'user',
    subjectId: user._id,
    ttlDays: env.jwt.refreshTtlDays,
    device,
    req,
  });
  user.lastActiveAt = new Date();
  if (device?.platform) user.lastPlatform = device.platform;
  if (device?.appVersion) user.lastAppVersion = device.appVersion;
  await user.save();
  return {
    user: toUserDTO(user),
    accessToken: signUserAccess(String(user._id), String(session._id)),
    refreshToken,
    isNewUser,
  };
};

export const loginWithPhone = async (phone: string, code: string, device: DeviceInfo | undefined, req: Request) => {
  await verifyOtp(phone, 'login', code);

  let user = await User.findOne({ phone, status: { $ne: 'deleted' } });
  const isNewUser = !user;
  if (!user) {
    user = await User.create({ phone, phoneVerified: true });
    logActivity({ actorType: 'user', actorId: user._id, action: 'user.signup', meta: { method: 'phone' }, req });
  } else if (!user.phoneVerified) {
    user.phoneVerified = true;
  }
  assertCanSignIn(user);

  await linkPhoneInvitesToUser(String(user._id), phone);
  logActivity({ actorType: 'user', actorId: user._id, action: 'user.login', meta: { method: 'phone', platform: device?.platform }, req });
  return issueTokens(user, isNewUser, device, req);
};

/**
 * Google accounts are matched by Google's stable subject id only. We never auto-link by email:
 * profile emails are unverified, so matching on them would allow account takeover.
 */
export const loginWithGoogle = async (idToken: string, device: DeviceInfo | undefined, req: Request) => {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await User.findOne({ googleId: profile.googleId, status: { $ne: 'deleted' } });
  const isNewUser = !user;
  if (!user) {
    user = await User.create({
      googleId: profile.googleId,
      email: profile.emailVerified ? profile.email : undefined,
      name: profile.name ?? '',
      avatarUrl: profile.picture,
    });
    logActivity({ actorType: 'user', actorId: user._id, action: 'user.signup', meta: { method: 'google' }, req });
  }
  assertCanSignIn(user);

  logActivity({ actorType: 'user', actorId: user._id, action: 'user.login', meta: { method: 'google', platform: device?.platform }, req });
  return issueTokens(user, isNewUser, device, req);
};

export const refreshUserTokens = async (refreshToken: string) => {
  const { session, refreshToken: next } = await rotateSession(refreshToken, 'user', env.jwt.refreshTtlDays);
  const user = await User.findById(session.subjectId).select('status');
  if (!user || user.status === 'deleted') throw ApiError.unauthorized('Account not found');
  assertCanSignIn(user);
  return { accessToken: signUserAccess(String(user._id), String(session._id)), refreshToken: next };
};
