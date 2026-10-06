import { Router } from 'express';
import mongoose from 'mongoose';
import { insightsQuerySchema, type InsightsSummaryDTO } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { query, validate } from '../../core/validate';
import { previousRange } from '../../lib/dates';
import { Transaction } from '../transactions/transaction.model';

const router = Router();

router.get(
  '/summary',
  validate(insightsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { from, to } = query(req, insightsQuerySchema);
    const userId = new mongoose.Types.ObjectId(String(user._id));
    const tz = user.timezone || 'Asia/Kolkata';
    const match = { userId, deletedAt: null, binnedAt: null, occurredAt: { $gte: from, $lte: to } };
    const prev = previousRange(from, to);

    const [facet] = await Transaction.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [{ $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }],
          byCategory: [
            { $match: { type: 'expense' } },
            { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
          ],
          // Days are bucketed in the user's timezone, so a 11:30 PM coffee stays on the right day.
          byDay: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: tz } },
                expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
                income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byPaymentMethod: [
            { $match: { type: 'expense' } },
            { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } },
          ],
        },
      },
    ]);
    const [prevRow] = await Transaction.aggregate([
      { $match: { userId, deletedAt: null, binnedAt: null, type: 'expense', occurredAt: { $gte: prev.start, $lte: prev.end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totals = Object.fromEntries((facet.totals as { _id: string; total: number; count: number }[]).map((t) => [t._id, t]));
    const totalExpense = totals.expense?.total ?? 0;
    const totalIncome = totals.income?.total ?? 0;
    const summary: InsightsSummaryDTO = {
      currency: user.defaultCurrency,
      totalExpense,
      totalIncome,
      net: totalIncome - totalExpense,
      count: (totals.expense?.count ?? 0) + (totals.income?.count ?? 0),
      byCategory: facet.byCategory.map((c: { _id: unknown; total: number; count: number }) => ({ categoryId: String(c._id), total: c.total, count: c.count })),
      byDay: facet.byDay.map((d: { _id: string; expense: number; income: number }) => ({ date: d._id, expense: d.expense, income: d.income })),
      byPaymentMethod: facet.byPaymentMethod.map((p: { _id: string; total: number }) => ({ paymentMethod: p._id as InsightsSummaryDTO['byPaymentMethod'][number]['paymentMethod'], total: p.total })),
      previousPeriodExpense: prevRow?.total ?? 0,
    };
    ok(res, summary);
  }),
);

export default router;
