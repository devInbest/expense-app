import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ERROR_CODES, SplitError } from '@expense/shared';
import { ApiError } from './ApiError';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const send = (status: number, message: string, code: string, errors?: unknown) =>
    res.status(status).json({ success: false, message, code, ...(errors ? { errors } : {}) });

  if (err instanceof ApiError) return send(err.statusCode, err.message, err.code, err.errors);
  if (err instanceof SplitError) return send(400, err.message, ERROR_CODES.SPLIT_INVALID);

  if (err?.name === 'ValidationError') {
    const errors = Object.values(err.errors as Record<string, { path: string; message: string }>).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return send(400, errors[0]?.message ?? 'Validation failed', ERROR_CODES.VALIDATION, errors);
  }
  if (err?.name === 'CastError') return send(400, 'Invalid id', ERROR_CODES.VALIDATION);
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return send(409, `${field} already exists`, ERROR_CODES.CONFLICT);
  }
  if (err?.name === 'TokenExpiredError') return send(401, 'Token expired', ERROR_CODES.TOKEN_EXPIRED);
  if (err?.name === 'JsonWebTokenError') return send(401, 'Invalid token', ERROR_CODES.UNAUTHORIZED);
  if (err?.type === 'entity.parse.failed') return send(400, 'Malformed JSON body', ERROR_CODES.VALIDATION);

  console.error('Unhandled error:', err);
  return send(500, env.isProduction ? 'Internal server error' : String(err?.message ?? err), ERROR_CODES.INTERNAL);
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found`, code: ERROR_CODES.NOT_FOUND });
};
