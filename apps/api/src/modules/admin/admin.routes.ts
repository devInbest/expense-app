import { Router } from 'express';
import mongoose from 'mongoose';
import {
  adminActivityQuerySchema,
  adminEventsQuerySchema,
  adminRoomsQuerySchema,
  appSettingsSchema,
  broadcastSchema,
  createAdminSchema,
  createCategorySchema,
  updateAdminSchema,
  updateCategorySchema,
  type AdminEventsSummaryDTO,
  type AdminRoomRowDTO,
} from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok, paged, toPagination } from '../../core/ApiResponse';
import { ApiError } from '../../core/ApiError';
import { query, validate } from '../../core/validate';
import { requireAdmin } from '../../core/auth';
import { generatePassword } from '../../lib/crypto';
import { logAdmin } from '../activity/activity.service';
import { ActivityLog } from '../activity/activity.model';
import { Admin, toAdminDTO } from '../admins/admin.model';
import { revokeAllSessions } from '../auth/session.service';
import { Category, toCategoryDTO } from '../categories/category.model';
import { uncategorizedId } from '../categories/category.service';
import { AppEvent } from '../events/appEvent.model';
import { notify } from '../notifications/notification.service';
import { Device } from '../notifications/device.model';
import { toExpenseDTO, toMemberDTO, toRoomDTO } from '../rooms/room.dto';
import { Room, RoomExpense, RoomMember } from '../rooms/room.models';
import { updateAppSettings } from '../settings/appSetting.service';
import { Transaction } from '../transactions/transaction.model';
import { loadPublicUsers } from '../users/publicUser';
import { User } from '../users/user.model';
import usersRoutes, { toActivityDTOs } from './admin.users.routes';
import { getDashboard } from './dashboard.service';

const router = Router();
const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.use(requireAdmin());

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    ok(res, await getDashboard(days));
  }),
);

router.use('/users', usersRoutes);

// ---------- Rooms ----------
router.get(
  '/rooms',
  validate(adminRoomsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = query(req, adminRoomsQuerySchema);
    const filter: Record<string, unknown> = {};
    if (q.type) filter.type = q.type;
    if (q.archived) filter.archivedAt = q.archived === 'true' ? { $ne: null } : null;
    if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
    const [total, rooms] = await Promise.all([
      Room.countDocuments(filter),
      Room.find(filter).sort({ lastActivityAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    const ids = rooms.map((r) => r._id);
    const [members, expenses, creators] = await Promise.all([
      RoomMember.aggregate<{ _id: unknown; n: number }>([{ $match: { roomId: { $in: ids }, status: 'active' } }, { $group: { _id: '$roomId', n: { $sum: 1 } } }]),
      RoomExpense.aggregate<{ _id: unknown; n: number; total: number }>([
        { $match: { roomId: { $in: ids }, deletedAt: null } },
        { $group: { _id: '$roomId', n: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      loadPublicUsers(rooms.map((r) => String(r.createdBy))),
    ]);
    const mc = new Map(members.map((m) => [String(m._id), m.n]));
    const ec = new Map(expenses.map((e) => [String(e._id), e]));
    const rows: AdminRoomRowDTO[] = rooms.map((r) => ({
      _id: String(r._id),
      name: r.name,
      type: r.type as AdminRoomRowDTO['type'],
      currency: r.currency,
      memberCount: mc.get(String(r._id)) ?? 0,
      expenseCount: ec.get(String(r._id))?.n ?? 0,
      totalSpent: ec.get(String(r._id))?.total ?? 0,
      createdBy: creators.get(String(r.createdBy))!,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      lastActivityAt: r.lastActivityAt?.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
    paged(res, rows, toPagination(q.page, q.limit, total));
  }),
);

router.get(
  '/rooms/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Room not found');
    const room = await Room.findById(req.params.id).lean();
    if (!room) throw ApiError.notFound('Room not found');
    const members = await RoomMember.find({ roomId: room._id }).sort({ joinedAt: 1 }).lean();
    const users = await loadPublicUsers(members.map((m) => String(m.userId)));
    // Expense details are private money data: only superadmins see them, and it is audited.
    const canSeeExpenses = req.admin!.role === 'superadmin';
    const recent = canSeeExpenses ? await RoomExpense.find({ roomId: room._id, deletedAt: null }).sort({ occurredAt: -1 }).limit(20).lean() : [];
    logAdmin(req, 'admin.viewed_room', { entity: 'room', entityId: room._id, meta: { withExpenses: canSeeExpenses } });
    ok(res, {
      room: toRoomDTO(room, { memberCount: members.filter((m) => m.status === 'active').length }),
      members: members.map((m) => toMemberDTO(m, users.get(String(m.userId))!)),
      recentExpenses: recent.map(toExpenseDTO),
    });
  }),
);

// ---------- Activity ----------
router.get(
  '/activity',
  validate(adminActivityQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = query(req, adminActivityQuerySchema);
    const filter: Record<string, unknown> = {};
    if (q.actorType) filter.actorType = q.actorType;
    if (q.actorId) filter.actorId = q.actorId;
    if (q.action) filter.action = new RegExp(`^${escapeRegex(q.action)}`);
    if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    const [total, logs] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    paged(res, await toActivityDTOs(logs), toPagination(q.page, q.limit, total));
  }),
);

// ---------- App usage ----------
router.get(
  '/events',
  validate(adminEventsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = query(req, adminEventsQuerySchema);
    const match: Record<string, unknown> = {
      at: { $gte: q.from ?? new Date(Date.now() - 30 * 86400_000), ...(q.to ? { $lte: q.to } : {}) },
    };
    if (q.name) match.name = q.name;
    if (q.userId) match.userId = new mongoose.Types.ObjectId(q.userId);
    const [facet] = await AppEvent.aggregate([
      { $match: match },
      {
        $facet: {
          byName: [{ $group: { _id: '$name', count: { $sum: 1 }, users: { $addToSet: '$userId' } } }, { $project: { count: 1, users: { $size: '$users' } } }, { $sort: { count: -1 } }],
          topScreens: [{ $match: { name: 'screen_view' } }, { $group: { _id: '$props.screen', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 20 }],
          byDay: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          features: [
            { $match: { name: 'feature_used' } },
            { $group: { _id: '$props.feature', count: { $sum: 1 }, users: { $addToSet: '$userId' } } },
            { $project: { count: 1, users: { $size: '$users' } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);
    const summary: AdminEventsSummaryDTO = {
      byName: facet.byName.map((r: { _id: string; count: number; users: number }) => ({ name: r._id, count: r.count, users: r.users })),
      topScreens: facet.topScreens.map((r: { _id: string; count: number }) => ({ screen: r._id ?? 'unknown', count: r.count })),
      byDay: facet.byDay.map((r: { _id: string; count: number }) => ({ date: r._id, count: r.count })),
      features: facet.features.map((r: { _id: string; count: number; users: number }) => ({ feature: r._id ?? 'unknown', count: r.count, users: r.users })),
    };
    ok(res, summary);
  }),
);

// ---------- Broadcast ----------
router.post(
  '/broadcast',
  requireAdmin('superadmin'),
  validate(broadcastSchema),
  asyncHandler(async (req, res) => {
    const { title, body, segment, platform } = req.body;
    const now = Date.now();
    const filter: Record<string, unknown> = { status: 'active' };
    if (segment === 'active_7d') filter.lastActiveAt = { $gte: new Date(now - 7 * 86400_000) };
    if (segment === 'inactive_30d') filter.lastActiveAt = { $lt: new Date(now - 30 * 86400_000) };
    let ids = (await User.find(filter).select('_id').lean()).map((u) => String(u._id));
    if (segment === 'platform') {
      if (!platform) throw ApiError.badRequest('Pick a platform');
      const onPlatform = new Set((await Device.distinct('userId', { platform, enabled: true })).map(String));
      ids = ids.filter((id) => onPlatform.has(id));
    }
    let recipients = 0;
    for (let i = 0; i < ids.length; i += 500) {
      recipients += await notify({ userIds: ids.slice(i, i + 500), type: 'broadcast', title, body, pref: 'productUpdates' });
    }
    logAdmin(req, 'admin.broadcast_sent', { meta: { title, segment, platform, recipients } });
    ok(res, { recipients }, `Sent to ${recipients} users`);
  }),
);

// ---------- System categories ----------
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await Category.find({ ownerType: 'system', deletedAt: null }).sort({ type: 1, sortOrder: 1 }).lean();
    ok(res, categories.map(toCategoryDTO));
  }),
);

router.post(
  '/categories',
  requireAdmin('superadmin'),
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const key = `${req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now().toString(36)}`;
    const count = await Category.countDocuments({ ownerType: 'system' });
    const category = await Category.create({ ...req.body, ownerType: 'system', key, sortOrder: count });
    logAdmin(req, 'admin.category_created', { entity: 'category', entityId: category._id });
    created(res, toCategoryDTO(category.toObject()), 'Category created');
  }),
);

router.patch(
  '/categories/:id',
  requireAdmin('superadmin'),
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate({ _id: req.params.id, ownerType: 'system', deletedAt: null }, { $set: req.body }, { new: true }).lean();
    if (!category) throw ApiError.notFound('Category not found');
    logAdmin(req, 'admin.category_updated', { entity: 'category', entityId: category._id });
    ok(res, toCategoryDTO(category), 'Category updated');
  }),
);

router.delete(
  '/categories/:id',
  requireAdmin('superadmin'),
  asyncHandler(async (req, res) => {
    const category = await Category.findOne({ _id: req.params.id, ownerType: 'system', deletedAt: null });
    if (!category) throw ApiError.notFound('Category not found');
    if (category.key === 'uncategorized') throw ApiError.badRequest('The Uncategorized category cannot be deleted');
    const fallback = await uncategorizedId();
    await Promise.all([
      Transaction.updateMany({ categoryId: category._id }, { $set: { categoryId: fallback }, $inc: { version: 1 } }),
      RoomExpense.updateMany({ categoryId: category._id }, { categoryId: fallback }),
    ]);
    category.deletedAt = new Date();
    await category.save();
    logAdmin(req, 'admin.category_deleted', { entity: 'category', entityId: category._id });
    ok(res, null, 'Category deleted; its entries moved to Uncategorized');
  }),
);

// ---------- Admin accounts ----------
const superOnly = requireAdmin('superadmin');

router.get(
  '/admins',
  superOnly,
  asyncHandler(async (_req, res) => {
    const admins = await Admin.find().sort({ createdAt: 1 }).lean();
    ok(res, admins.map(toAdminDTO));
  }),
);

router.post(
  '/admins',
  superOnly,
  validate(createAdminSchema),
  asyncHandler(async (req, res) => {
    if (await Admin.exists({ userName: req.body.userName })) throw ApiError.conflict('That user name is taken');
    const admin = await Admin.create(req.body);
    logAdmin(req, 'admin.admin_created', { entity: 'admin', entityId: admin._id, meta: { role: admin.role } });
    created(res, toAdminDTO(admin.toObject()), 'Admin created');
  }),
);

router.patch(
  '/admins/:id',
  superOnly,
  validate(updateAdminSchema),
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.params.id);
    if (!admin) throw ApiError.notFound('Admin not found');
    const isSelf = String(admin._id) === String(req.admin!._id);
    if (isSelf && (req.body.isActive === false || (req.body.role && req.body.role !== admin.role))) {
      throw ApiError.badRequest('You cannot deactivate or change the role of your own account');
    }
    Object.assign(admin, req.body);
    await admin.save();
    if (req.body.isActive === false) await revokeAllSessions('admin', admin._id, 'deactivated');
    logAdmin(req, 'admin.admin_updated', { entity: 'admin', entityId: admin._id, meta: req.body });
    ok(res, toAdminDTO(admin.toObject()), 'Admin updated');
  }),
);

router.post(
  '/admins/:id/reset-password',
  superOnly,
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.params.id).select('+password');
    if (!admin) throw ApiError.notFound('Admin not found');
    if (String(admin._id) === String(req.admin!._id)) throw ApiError.badRequest('Use change password for your own account');
    const password = generatePassword();
    admin.password = password;
    await admin.save();
    await revokeAllSessions('admin', admin._id, 'password_reset');
    logAdmin(req, 'admin.admin_password_reset', { entity: 'admin', entityId: admin._id });
    ok(res, { password }, 'Password reset');
  }),
);

router.delete(
  '/admins/:id',
  superOnly,
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.params.id);
    if (!admin) throw ApiError.notFound('Admin not found');
    if (String(admin._id) === String(req.admin!._id)) throw ApiError.badRequest('You cannot delete your own account');
    if (admin.role === 'superadmin' && (await Admin.countDocuments({ role: 'superadmin' })) <= 1) {
      throw ApiError.badRequest('At least one superadmin must remain');
    }
    await admin.deleteOne();
    await revokeAllSessions('admin', admin._id, 'deleted');
    logAdmin(req, 'admin.admin_deleted', { entity: 'admin', entityId: admin._id });
    ok(res, null, 'Admin deleted');
  }),
);

// ---------- App settings ----------
router.put(
  '/settings',
  superOnly,
  validate(appSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await updateAppSettings(req.body, req.admin!._id);
    logAdmin(req, 'admin.settings_updated', { meta: req.body });
    ok(res, settings, 'Settings saved');
  }),
);

export default router;
