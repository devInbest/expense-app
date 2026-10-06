import type { RequestHandler } from 'express';
import { compareVersions, ERROR_CODES, type AdminRole } from '@expense/shared';
import { asyncHandler } from './asyncHandler';
import { ApiError } from './ApiError';
import { verifyAdminAccess, verifyUserAccess } from '../lib/tokens';
import { Session } from '../modules/auth/session.model';
import { User } from '../modules/users/user.model';
import { Admin } from '../modules/admins/admin.model';
import { getAppSettings } from '../modules/settings/appSetting.service';

const ACTIVITY_TOUCH_MS = 5 * 60_000;

const bearer = (header?: string) => {
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Sign in required');
  return header.slice(7);
};

/** Reads the app's platform/version headers so the API can gate old builds. */
export const clientInfo: RequestHandler = (req, _res, next) => {
  const platform = req.get('x-platform') ?? undefined;
  const appVersion = req.get('x-app-version') ?? undefined;
  req.client = { platform, appVersion };
  next();
};

/** Maintenance mode and minimum app version, for customer (mobile) routes only. */
export const appGate = asyncHandler(async (req, _res, next) => {
  const settings = await getAppSettings();
  if (settings.maintenanceMode) {
    throw new ApiError(503, settings.maintenanceMessage || 'We are doing some maintenance. Please try again shortly.', ERROR_CODES.MAINTENANCE);
  }
  const version = req.client?.appVersion;
  if (version && req.client?.platform !== 'web' && compareVersions(version, settings.minAppVersion) < 0) {
    throw new ApiError(426, 'A new version of the app is available. Please update to continue.', ERROR_CODES.UPGRADE_REQUIRED);
  }
  next();
});

export const requireUser = asyncHandler(async (req, _res, next) => {
  const payload = verifyUserAccess(bearer(req.headers.authorization));

  const [session, user] = await Promise.all([
    Session.findOne({ _id: payload.sid, subjectType: 'user' }).select('revokedAt lastUsedAt').lean(),
    User.findById(payload.sub),
  ]);
  if (!session || session.revokedAt) throw ApiError.unauthorized('Session expired, please sign in again', ERROR_CODES.SESSION_REVOKED);
  if (!user || user.status === 'deleted') throw ApiError.unauthorized('Account not found');
  if (user.status === 'blocked') {
    throw ApiError.forbidden('Your account has been suspended. Contact support for help.', ERROR_CODES.ACCOUNT_BLOCKED);
  }

  req.user = user;
  req.sessionId = payload.sid;

  const now = Date.now();
  if (!user.lastActiveAt || now - user.lastActiveAt.getTime() > ACTIVITY_TOUCH_MS) {
    const set: Record<string, unknown> = { lastActiveAt: new Date(now) };
    if (req.client?.platform) set.lastPlatform = req.client.platform;
    if (req.client?.appVersion) set.lastAppVersion = req.client.appVersion;
    void User.updateOne({ _id: user._id }, { $set: set }).exec();
    void Session.updateOne({ _id: payload.sid }, { $set: { lastUsedAt: new Date(now), ...(req.client?.appVersion ? { appVersion: req.client.appVersion } : {}) } }).exec();
  }
  next();
});

/** Users who have not finished onboarding can only reach /me endpoints. */
export const requireOnboarded = asyncHandler(async (req, _res, next) => {
  if (!req.user?.onboarded) throw ApiError.forbidden('Finish setting up your profile first');
  next();
});

export const requireAdmin = (...roles: AdminRole[]): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const payload = verifyAdminAccess(bearer(req.headers.authorization));
    const [session, admin] = await Promise.all([
      Session.findOne({ _id: payload.sid, subjectType: 'admin' }).select('revokedAt').lean(),
      Admin.findById(payload.sub),
    ]);
    if (!session || session.revokedAt) throw ApiError.unauthorized('Session expired, please sign in again', ERROR_CODES.SESSION_REVOKED);
    if (!admin || !admin.isActive) throw ApiError.unauthorized('Admin account not found or inactive');
    if (admin.passwordChangedAt && payload.iat * 1000 < admin.passwordChangedAt.getTime()) {
      throw ApiError.unauthorized('Session expired due to password change');
    }
    if (roles.length && !roles.includes(admin.role)) throw ApiError.forbidden();
    req.admin = admin;
    req.sessionId = payload.sid;
    next();
  });
