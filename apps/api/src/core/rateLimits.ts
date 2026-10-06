import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ERROR_CODES } from '@expense/shared';
import { env } from '../config/env';

const handler = (message: string) => ({ success: false, message, code: ERROR_CODES.RATE_LIMITED });

export const globalLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: handler('Too many requests, please slow down'),
  skip: () => env.isTest,
});

/** Per-IP cap on OTP sends; per-phone limits are enforced in the OTP service. */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: handler('Too many code requests from this network, try again later'),
  skip: () => env.isTest,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: handler('Too many sign-in attempts, try again later'),
  skip: () => env.isTest,
});

/** Writes are keyed by user when signed in, so one abusive account cannot hide behind shared IPs. */
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip ?? '')),
  message: handler('You are doing that too fast'),
  skip: (req) => env.isTest || req.method === 'GET',
});
