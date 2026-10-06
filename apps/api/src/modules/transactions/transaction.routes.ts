import { Router } from 'express';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  syncPullQuerySchema,
  syncPushSchema,
  updateTransactionSchema,
} from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok } from '../../core/ApiResponse';
import { query, validate } from '../../core/validate';
import * as service from './transaction.service';

const router = Router();

router.get(
  '/',
  validate(listTransactionsQuerySchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await service.listTransactions(req.user!._id, query(req, listTransactionsQuerySchema)))),
);

router.post(
  '/sync',
  validate(syncPushSchema),
  asyncHandler(async (req, res) => ok(res, await service.pushChanges(req.user!, req.body.changes, req), 'Synced')),
);

router.get(
  '/sync',
  validate(syncPullQuerySchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await service.pullChanges(req.user!._id, query(req, syncPullQuerySchema).since))),
);

router.get('/:id', asyncHandler(async (req, res) => ok(res, await service.getTransaction(req.user!._id, String(req.params.id)))));

router.post(
  '/',
  validate(createTransactionSchema),
  asyncHandler(async (req, res) => created(res, await service.createTransaction(req.user!, req.body, req), 'Saved')),
);

router.post('/:id/bin', asyncHandler(async (req, res) => ok(res, await service.setBinned(req.user!, String(req.params.id), true, req), 'Moved to bin')));
router.post('/:id/restore', asyncHandler(async (req, res) => ok(res, await service.setBinned(req.user!, String(req.params.id), false, req), 'Restored')));

router.patch(
  '/:id',
  validate(updateTransactionSchema),
  asyncHandler(async (req, res) => ok(res, await service.updateTransaction(req.user!, String(req.params.id), req.body, req), 'Updated')),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.deleteTransaction(req.user!, String(req.params.id), req);
    ok(res, null, 'Deleted');
  }),
);

export default router;
