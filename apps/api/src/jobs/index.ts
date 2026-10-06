import { Budget } from '../modules/budgets/budget.model';
import { checkBudgetAlerts } from '../modules/budgets/budget.service';
import { runRecurringRules } from '../modules/recurring/recurring.service';
import { expireInvites } from '../modules/rooms/invite.service';
import { refreshDailyStats } from '../modules/stats/stats.service';

/**
 * Budget alerts are normally checked when an expense is written. This sweep catches the rest:
 * expenses created by recurring rules and threshold changes.
 */
const sweepBudgetAlerts = async () => {
  const owners = await Budget.aggregate<{ _id: { ownerType: 'user' | 'room'; ownerId: unknown } }>([
    { $match: { deletedAt: null } },
    { $group: { _id: { ownerType: '$ownerType', ownerId: '$ownerId' } } },
  ]);
  for (const { _id } of owners) {
    await checkBudgetAlerts(_id.ownerType, String(_id.ownerId)).catch((err) => console.error('Budget sweep failed:', err.message));
  }
  return owners.length;
};

export const JOBS: Record<string, () => Promise<unknown>> = {
  recurring: runRecurringRules,
  budgets: sweepBudgetAlerts,
  invites: expireInvites,
  stats: refreshDailyStats,
};

export const runAllJobs = async () => {
  for (const [name, job] of Object.entries(JOBS)) {
    const started = Date.now();
    try {
      const result = await job();
      console.log(`[job:${name}] done in ${Date.now() - started}ms`, result ?? '');
    } catch (err) {
      console.error(`[job:${name}] failed:`, err);
    }
  }
};
