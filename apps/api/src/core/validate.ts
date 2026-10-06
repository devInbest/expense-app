import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ApiError } from './ApiError';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodTypeAny, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw ApiError.badRequest(
        result.error.issues[0]?.message ?? 'Validation failed',
        result.error.issues.map((issue) => ({
          field: issue.path.join('.') || source,
          message: issue.message,
        })),
      );
    }
    if (source === 'body') req.body = result.data;
    // req.query / req.params are read-only getters in Express 5.
    else req.validated = { ...(req.validated ?? {}), [source]: result.data };
    next();
  };

/** Typed access to a query parsed by `validate(schema, 'query')`. */
export const query = <S extends ZodTypeAny>(req: Request, _schema: S): z.output<S> =>
  (req.validated?.query ?? {}) as z.output<S>;

/** Parse inline (for handlers that need it outside middleware). */
export const parse = <S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.badRequest(
      result.error.issues[0]?.message ?? 'Validation failed',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
};
