import type { Response } from 'express';
import type { PagePagination } from '@expense/shared';

export const ok = <T>(res: Response, data: T, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, data: data ?? null });

export const created = <T>(res: Response, data: T, message = 'Created') => ok(res, data, message, 201);

export const paged = <T>(res: Response, data: T[], pagination: PagePagination, message = 'Success') =>
  res.status(200).json({ success: true, message, data, pagination });

export const toPagination = (page: number, limit: number, total: number): PagePagination => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
});
