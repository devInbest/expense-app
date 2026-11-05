import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { asyncHandler } from './core/asyncHandler';
import { ApiError } from './core/ApiError';
import { ok } from './core/ApiResponse';
import { appGate, requireOnboarded, requireUser } from './core/auth';
import { writeLimiter } from './core/rateLimits';
import { runAllJobs } from './jobs';
import authRoutes from './modules/auth/auth.routes';
import meRoutes from './modules/users/me.routes';
import usersRoutes from './modules/users/users.routes';
import categoryRoutes from './modules/categories/category.routes';
import transactionRoutes from './modules/transactions/transaction.routes';
import bankTransactionRoutes from './modules/bank/bankTransaction.routes';
import budgetRoutes from './modules/budgets/budget.routes';
import recurringRoutes from './modules/recurring/recurring.routes';
import insightsRoutes from './modules/insights/insights.routes';
import exportRoutes from './modules/exports/export.routes';
import roomRoutes from './modules/rooms/room.routes';
import inviteRoutes from './modules/rooms/invite.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import uploadRoutes from './modules/uploads/upload.routes';
import eventRoutes from './modules/events/event.routes';
import adminAuthRoutes from './modules/admins/adminAuth.routes';
import adminRoutes from './modules/admin/admin.routes';
import { getAppSettings } from './modules/settings/appSetting.service';

const router = Router();

const cronAuthorized = (authorization: string | undefined) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

router.get('/health', (_req, res) => {
  ok(res, { status: 'ok', timestamp: new Date().toISOString() }, 'Expense API is running');
});

// Vercel Cron calls this every 15 minutes with Authorization: Bearer CRON_SECRET.
router.get(
  '/cron',
  asyncHandler(async (req, res) => {
    if (!cronAuthorized(req.headers.authorization)) throw ApiError.unauthorized();
    await runAllJobs();
    ok(res, { ran: true });
  }),
);

// Public: the admin login page and the app's splash screen read theme / min version before sign-in.
router.get('/app-settings', asyncHandler(async (_req, res) => ok(res, await getAppSettings())));

// ---------- Admin portal ----------
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', adminRoutes);

// ---------- Mobile app ----------
router.use('/auth', authRoutes);

const app = Router();
app.use(appGate, requireUser, writeLimiter);
app.use('/me', meRoutes);
app.use('/events', eventRoutes);
app.use(requireOnboarded);
app.use('/users', usersRoutes);
app.use('/categories', categoryRoutes);
app.use('/transactions', transactionRoutes);
app.use('/bank-transactions', bankTransactionRoutes);
app.use('/budgets', budgetRoutes);
app.use('/recurring', recurringRoutes);
app.use('/insights', insightsRoutes);
app.use('/exports', exportRoutes);
app.use('/rooms', roomRoutes);
app.use('/invites', inviteRoutes);
app.use('/notifications', notificationRoutes);
app.use('/uploads', uploadRoutes);
router.use(app);

export default router;
