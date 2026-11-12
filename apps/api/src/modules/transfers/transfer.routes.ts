import { Router } from 'express';
import mongoose from 'mongoose';
import { CASH_ACCOUNT_ID, createTransferSchema, listTransfersQuerySchema, updateTransferSchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { query, validate } from '../../core/validate';
import type { UserDoc } from '../users/user.model';
import { toTransferDTO, Transfer } from './transfer.model';

const router = Router();
const LIST_LIMIT = 500;

/**
 * Ends being set must be cash or one of the user's saved accounts, and the two ends must differ.
 * An end that isn't changing may point at an account removed since, so editing the note still works.
 */
const assertEndpoints = (user: UserDoc, from: string, to: string, changed: string[] = [from, to]) => {
  const ids = new Set([CASH_ACCOUNT_ID, ...(user.accounts ?? []).map((a) => a.id)]);
  if (changed.some((id) => !ids.has(id))) throw ApiError.badRequest('That account no longer exists');
  if (from === to) throw ApiError.badRequest('Pick two different accounts');
};

const findOwn = async (user: UserDoc, id: string) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Transfer not found');
  const transfer = await Transfer.findOne({ _id: id, userId: user._id, deletedAt: null });
  if (!transfer) throw ApiError.notFound('Transfer not found');
  return transfer;
};

router.get(
  '/',
  validate(listTransfersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = query(req, listTransfersQuerySchema);
    const occurredAt: Record<string, Date> = {};
    if (q.from) occurredAt.$gte = q.from;
    if (q.to) occurredAt.$lt = q.to;
    const transfers = await Transfer.find({
      userId: req.user!._id,
      deletedAt: null,
      ...(q.from || q.to ? { occurredAt } : {}),
    })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(LIST_LIMIT)
      .lean();
    ok(res, transfers.map(toTransferDTO));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const transfer = await findOwn(req.user!, String(req.params.id));
    ok(res, toTransferDTO(transfer.toObject()));
  }),
);

router.post(
  '/',
  validate(createTransferSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertEndpoints(user, req.body.fromAccount, req.body.toAccount);
    const transfer = await Transfer.create({ ...req.body, currency: req.body.currency ?? user.defaultCurrency, userId: user._id });
    created(res, toTransferDTO(transfer.toObject()), 'Transfer saved');
  }),
);

router.patch(
  '/:id',
  validate(updateTransferSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const transfer = await findOwn(user, String(req.params.id));
    const changed = [req.body.fromAccount, req.body.toAccount].filter((id): id is string => Boolean(id));
    transfer.set(req.body);
    assertEndpoints(user, transfer.fromAccount, transfer.toAccount, changed);
    await transfer.save();
    ok(res, toTransferDTO(transfer.toObject()), 'Transfer updated');
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const transfer = await findOwn(req.user!, String(req.params.id));
    transfer.deletedAt = new Date();
    await transfer.save();
    ok(res, null, 'Transfer deleted');
  }),
);

export default router;
