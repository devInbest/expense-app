import { Router } from 'express';
import { ingestBankTransactionsSchema, linkBankTransactionSchema, listBankTransactionsQuerySchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { query, validate } from '../../core/validate';
import * as service from './bankTransaction.service';

const router = Router();

router.get(
  '/',
  validate(listBankTransactionsQuerySchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await service.listBankTransactions(req.user!._id, query(req, listBankTransactionsQuerySchema)))),
);

router.post(
  '/ingest',
  validate(ingestBankTransactionsSchema),
  asyncHandler(async (req, res) => ok(res, await service.ingest(req.user!, req.body.items))),
);

router.get('/:id', asyncHandler(async (req, res) => ok(res, await service.getBankTransaction(req.user!._id, String(req.params.id)))));

router.post(
  '/:id/link',
  validate(linkBankTransactionSchema),
  asyncHandler(async (req, res) => ok(res, await service.linkBankTransaction(req.user!, String(req.params.id), req.body, req), 'Saved')),
);

router.post('/:id/ignore', asyncHandler(async (req, res) => ok(res, await service.setIgnored(req.user!._id, String(req.params.id), true), 'Ignored')));
router.post('/:id/restore', asyncHandler(async (req, res) => ok(res, await service.setIgnored(req.user!._id, String(req.params.id), false), 'Moved back to review')));

export default router;
