import { Router } from 'express';
import mongoose from 'mongoose';
import {
  adminUsersQuerySchema,
  blockUserSchema,
  pageQuerySchema,
  type ActivityLogDTO,
  type AdminUserDetailDTO,
  type AdminUserRowDTO,
} from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok, paged, toPagination } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { query, validate } from '../../core/validate';
import { requireAdmin } from '../../core/auth';
import { logAdmin } from '../activity/activity.service';
import { ActivityLog } from '../activity/activity.model';
import { listActiveSessions, revokeAllSessions } from '../auth/session.service';
import { AppEvent } from '../events/appEvent.model';
import { Room, RoomMember } from '../rooms/room.models';
import { Transaction, toTransactionDTO } from '../transactions/transaction.model';
import { User, toUserDTO } from '../users/user.model';

const router = Router();
const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadUser = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('User not found');
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const toActivityDTOs = async (logs: { _id: unknown; actorType: string; actorId?: unknown; action: string; entity?: string | null; entityId?: unknown; meta?: unknown; ip?: string | null; createdAt: Date }[]): Promise<ActivityLogDTO[]> => {
  const userIds = logs.filter((l) => l.actorType === 'user' && l.actorId).map((l) => l.actorId);
  const adminIds = logs.filter((l) => l.actorType === 'admin' && l.actorId).map((l) => l.actorId);
  const [users, admins] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name phone status').lean(),
    mongoose.connection.collection('admins').find({ _id: { $in: adminIds as mongoose.Types.ObjectId[] } }).project({ name: 1 }).toArray(),
  ]);
  const names = new Map<string, string>([
    ...users.map((u) => [String(u._id), u.status === 'deleted' ? 'Deleted user' : u.name || u.phone || 'User'] as [string, string]),
    ...admins.map((a) => [String(a._id), `${a.name} (admin)`] as [string, string]),
  ]);
  return logs.map((l) => ({
    _id: String(l._id),
    actorType: l.actorType as ActivityLogDTO['actorType'],
    actorId: l.actorId ? String(l.actorId) : undefined,
    actorName: l.actorId ? names.get(String(l.actorId)) : 'System',
    action: l.action,
    entity: l.entity ?? undefined,
    entityId: l.entityId ? String(l.entityId) : undefined,
    meta: (l.meta as Record<string, unknown>) ?? undefined,
    ip: l.ip ?? undefined,
    createdAt: l.createdAt.toISOString(),
  }));
};

router.get(
  '/',
  validate(adminUsersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = query(req, adminUsersQuerySchema);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { username: rx }, { email: rx }];
    }
    const sort: Record<string, 1 | -1> = q.sort === 'name' ? { name: 1 } : { [q.sort]: -1 };
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    const ids = users.map((u) => u._id);
    const [txCounts, roomCounts] = await Promise.all([
      Transaction.aggregate<{ _id: unknown; n: number }>([{ $match: { userId: { $in: ids }, deletedAt: null } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      RoomMember.aggregate<{ _id: unknown; n: number }>([{ $match: { userId: { $in: ids }, status: 'active' } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
    ]);
    const tx = new Map(txCounts.map((c) => [String(c._id), c.n]));
    const rc = new Map(roomCounts.map((c) => [String(c._id), c.n]));
    const rows: AdminUserRowDTO[] = users.map((u) => ({
      _id: String(u._id),
      name: u.status === 'deleted' ? 'Deleted user' : u.name,
      username: u.username ?? undefined,
      phone: u.phone ?? undefined,
      email: u.email ?? undefined,
      hasGoogle: Boolean(u.googleId),
      status: u.status as AdminUserRowDTO['status'],
      lastActiveAt: u.lastActiveAt?.toISOString(),
      createdAt: u.createdAt.toISOString(),
      transactionCount: tx.get(String(u._id)) ?? 0,
      roomCount: rc.get(String(u._id)) ?? 0,
    }));
    paged(res, rows, toPagination(q.page, q.limit, total));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await loadUser(String(req.params.id));
    const since = new Date(Date.now() - 30 * 86400_000);
    const [sessions, memberships, txStats, lastTx, appOpens, screenViews, categories] = await Promise.all([
      listActiveSessions('user', user._id),
      RoomMember.find({ userId: user._id }).lean(),
      Transaction.aggregate<{ _id: string; total: number; n: number }>([
        { $match: { userId: user._id, deletedAt: null } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, n: { $sum: 1 } } },
      ]),
      Transaction.findOne({ userId: user._id, deletedAt: null }).sort({ createdAt: -1 }).select('createdAt').lean(),
      AppEvent.countDocuments({ userId: user._id, name: 'app_open', at: { $gte: since } }),
      AppEvent.countDocuments({ userId: user._id, name: 'screen_view', at: { $gte: since } }),
      Transaction.distinct('categoryId', { userId: user._id, deletedAt: null }),
    ]);
    const rooms = await Room.find({ _id: { $in: memberships.map((m) => m.roomId) } }).select('name type currency').lean();
    const memberMap = new Map(memberships.map((m) => [String(m.roomId), m]));
    const byType = Object.fromEntries(txStats.map((t) => [t._id, t]));

    const detail: AdminUserDetailDTO = {
      user: {
        ...toUserDTO(user),
        lastActiveAt: user.lastActiveAt?.toISOString(),
        blockedReason: user.blockedReason ?? undefined,
        blockedAt: user.blockedAt?.toISOString(),
      },
      sessions,
      rooms: rooms.map((r) => ({
        _id: String(r._id),
        name: r.name,
        type: r.type as AdminUserDetailDTO['rooms'][number]['type'],
        currency: r.currency,
        role: memberMap.get(String(r._id))!.role as AdminUserDetailDTO['rooms'][number]['role'],
        status: memberMap.get(String(r._id))!.status as AdminUserDetailDTO['rooms'][number]['status'],
      })),
      stats: {
        transactionCount: (byType.expense?.n ?? 0) + (byType.income?.n ?? 0),
        totalExpense: byType.expense?.total ?? 0,
        totalIncome: byType.income?.total ?? 0,
        lastTransactionAt: lastTx?.createdAt?.toISOString(),
        appOpens30d: appOpens,
        screenViews30d: screenViews,
        categoriesUsed: categories.length,
      },
    };
    logAdmin(req, 'admin.viewed_user', { entity: 'user', entityId: user._id });
    ok(res, detail);
  }),
);

router.get(
  '/:id/activity',
  validate(pageQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = await loadUser(String(req.params.id));
    const q = query(req, pageQuerySchema);
    const filter = { actorType: 'user', actorId: user._id };
    const [total, logs] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    paged(res, await toActivityDTOs(logs), toPagination(q.page, q.limit, total));
  }),
);

/** Individual money records are private: superadmin only, and every view is audited. */
router.get(
  '/:id/transactions',
  requireAdmin('superadmin'),
  validate(pageQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = await loadUser(String(req.params.id));
    const q = query(req, pageQuerySchema);
    const filter = { userId: user._id, deletedAt: null };
    const [total, rows] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter).sort({ occurredAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    logAdmin(req, 'admin.viewed_user_transactions', { entity: 'user', entityId: user._id, meta: { page: q.page } });
    paged(res, rows.map(toTransactionDTO), toPagination(q.page, q.limit, total));
  }),
);

router.post(
  '/:id/block',
  validate(blockUserSchema),
  asyncHandler(async (req, res) => {
    const user = await loadUser(String(req.params.id));
    if (user.status === 'deleted') throw ApiError.badRequest('This account is deleted');
    user.status = 'blocked';
    user.blockedReason = req.body.reason;
    user.blockedAt = new Date();
    await user.save();
    await revokeAllSessions('user', user._id, 'blocked_by_admin');
    logAdmin(req, 'admin.user_blocked', { entity: 'user', entityId: user._id, meta: { reason: req.body.reason } });
    ok(res, null, 'User blocked');
  }),
);

router.post(
  '/:id/unblock',
  asyncHandler(async (req, res) => {
    const user = await loadUser(String(req.params.id));
    if (user.status !== 'blocked') throw ApiError.badRequest('User is not blocked');
    user.status = 'active';
    user.blockedReason = undefined;
    user.blockedAt = undefined;
    await user.save();
    logAdmin(req, 'admin.user_unblocked', { entity: 'user', entityId: user._id });
    ok(res, null, 'User unblocked');
  }),
);

router.post(
  '/:id/revoke-sessions',
  asyncHandler(async (req, res) => {
    const user = await loadUser(String(req.params.id));
    await revokeAllSessions('user', user._id, 'revoked_by_admin');
    logAdmin(req, 'admin.user_sessions_revoked', { entity: 'user', entityId: user._id });
    ok(res, null, 'All sessions signed out');
  }),
);

export default router;
