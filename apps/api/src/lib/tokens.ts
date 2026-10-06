import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { randomToken } from './crypto';

export interface AccessPayload {
  sub: string;
  sid: string;
  iat: number;
}

// Customer and admin tokens use different secrets and audiences, so one can never pass as the other.
const APP_AUDIENCE = 'expense-app';
const ADMIN_AUDIENCE = 'expense-admin';

export const signUserAccess = (userId: string, sessionId: string) =>
  jwt.sign({ sid: sessionId }, env.jwt.secret, {
    subject: userId,
    audience: APP_AUDIENCE,
    expiresIn: env.jwt.accessExpiresIn,
  });

export const verifyUserAccess = (token: string) =>
  jwt.verify(token, env.jwt.secret, { audience: APP_AUDIENCE }) as AccessPayload;

export const signAdminAccess = (adminId: string, sessionId: string) =>
  jwt.sign({ sid: sessionId }, env.jwt.adminSecret, {
    subject: adminId,
    audience: ADMIN_AUDIENCE,
    expiresIn: env.jwt.accessExpiresIn,
  });

export const verifyAdminAccess = (token: string) =>
  jwt.verify(token, env.jwt.adminSecret, { audience: ADMIN_AUDIENCE }) as AccessPayload;

/** Opaque refresh token: "<sessionId>.<random>". Only its HMAC is stored. */
export const createRefreshToken = (sessionId: string) => `${sessionId}.${randomToken(32)}`;

export const parseRefreshToken = (token: string): { sessionId: string } | null => {
  const [sessionId, secret] = token.split('.');
  if (!sessionId || !secret || !/^[a-f\d]{24}$/i.test(sessionId)) return null;
  return { sessionId };
};
