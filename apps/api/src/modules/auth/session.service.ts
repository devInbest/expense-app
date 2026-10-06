import type { Request } from 'express';
import mongoose from 'mongoose';
import type { DeviceInfo, SessionDTO } from '@expense/shared';
import { ERROR_CODES } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { hmac, safeEqual } from '../../lib/crypto';
import { createRefreshToken, parseRefreshToken } from '../../lib/tokens';
import { Session, type SessionDoc } from './session.model';

type SubjectType = 'user' | 'admin';

/** Two parallel refreshes from one app (e.g. resume + push tap) must not look like token theft. */
const REUSE_GRACE_MS = 15_000;
const MAX_ADMIN_SESSIONS = 5;

export const createSession = async (opts: {
  subjectType: SubjectType;
  subjectId: unknown;
  ttlDays: number;
  device?: DeviceInfo;
  req?: Request;
}): Promise<{ session: SessionDoc; refreshToken: string }> => {
  const _id = new mongoose.Types.ObjectId();
  const refreshToken = createRefreshToken(String(_id));

  // Re-login on the same device replaces the old session instead of piling up.
  if (opts.device?.deviceId) {
    await Session.updateMany(
      { subjectType: opts.subjectType, subjectId: opts.subjectId, deviceId: opts.device.deviceId, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'relogin' },
    );
  }

  const session = await Session.create({
    _id,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    refreshTokenHash: hmac(refreshToken),
    deviceId: opts.device?.deviceId ?? 'web',
    deviceName: opts.device?.deviceName,
    platform: opts.device?.platform ?? 'web',
    appVersion: opts.device?.appVersion,
    ip: opts.req?.ip,
    userAgent: opts.req?.get('user-agent')?.slice(0, 256),
    expiresAt: new Date(Date.now() + opts.ttlDays * 86400_000),
  });

  if (opts.subjectType === 'admin') {
    const extra = await Session.find({ subjectType: 'admin', subjectId: opts.subjectId, revokedAt: null })
      .sort({ createdAt: -1 })
      .skip(MAX_ADMIN_SESSIONS)
      .select('_id');
    if (extra.length) {
      await Session.updateMany({ _id: { $in: extra.map((s) => s._id) } }, { revokedAt: new Date(), revokedReason: 'limit' });
    }
  }

  return { session, refreshToken };
};

/** Exchanges a refresh token for a new one. Replaying an already-rotated token revokes the session. */
export const rotateSession = async (
  refreshToken: string,
  subjectType: SubjectType,
  ttlDays: number,
): Promise<{ session: SessionDoc; refreshToken: string }> => {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) throw ApiError.unauthorized('Invalid refresh token');

  const session = await Session.findOne({ _id: parsed.sessionId, subjectType });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired, please sign in again', ERROR_CODES.SESSION_REVOKED);
  }

  const presented = hmac(refreshToken);
  if (!safeEqual(presented, session.refreshTokenHash)) {
    const isPrevious = session.previousTokenHash && safeEqual(presented, session.previousTokenHash);
    const withinGrace = session.rotatedAt && Date.now() - session.rotatedAt.getTime() < REUSE_GRACE_MS;
    if (isPrevious && withinGrace) throw ApiError.unauthorized('Token already refreshed');

    session.revokedAt = new Date();
    session.revokedReason = 'refresh_token_reuse';
    await session.save();
    throw ApiError.unauthorized('Session expired, please sign in again', ERROR_CODES.SESSION_REVOKED);
  }

  const next = createRefreshToken(String(session._id));
  session.previousTokenHash = session.refreshTokenHash;
  session.refreshTokenHash = hmac(next);
  session.rotatedAt = new Date();
  session.lastUsedAt = new Date();
  session.expiresAt = new Date(Date.now() + ttlDays * 86400_000);
  await session.save();

  return { session, refreshToken: next };
};

export const revokeSession = (sessionId: unknown, reason = 'logout') =>
  Session.updateOne({ _id: sessionId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });

export const revokeAllSessions = (subjectType: SubjectType, subjectId: unknown, reason: string, exceptSessionId?: string) =>
  Session.updateMany(
    {
      subjectType,
      subjectId,
      revokedAt: null,
      ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}),
    },
    { revokedAt: new Date(), revokedReason: reason },
  );

export const listActiveSessions = async (subjectType: SubjectType, subjectId: unknown, currentId?: string): Promise<SessionDTO[]> => {
  const sessions = await Session.find({ subjectType, subjectId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .lean();
  return sessions.map((s) => ({
    _id: String(s._id),
    deviceId: s.deviceId,
    deviceName: s.deviceName ?? undefined,
    platform: s.platform as SessionDTO['platform'],
    appVersion: s.appVersion ?? undefined,
    ip: s.ip ?? undefined,
    lastUsedAt: new Date(s.lastUsedAt).toISOString(),
    createdAt: new Date(s.createdAt).toISOString(),
    current: currentId ? String(s._id) === currentId : undefined,
  }));
};
