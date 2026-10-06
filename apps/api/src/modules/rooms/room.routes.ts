import { Router } from 'express';
import mongoose from 'mongoose';
import {
  createBudgetSchema,
  createInviteSchema,
  createRoomExpenseSchema,
  createRoomSchema,
  joinByCodeSchema,
  listRoomExpensesQuerySchema,
  markSharePaidSchema,
  roomSpendingQuerySchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
  updateRoomExpenseSchema,
  updateRoomSchema,
  type RoomBudgetSummaryDTO,
} from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { created, ok } from '../../core/ApiResponse';
import { query, validate } from '../../core/validate';
import { logUser } from '../activity/activity.service';
import { Budget, toBudgetDTO } from '../budgets/budget.model';
import { checkBudgetAlerts, computeProgress } from '../budgets/budget.service';
import { loadPublicUsers } from '../users/publicUser';
import { loadRoomForMember } from './access';
import { computeRoomBalances, roomSpendingForUser, roomSpendingItemsForUser } from './balance.service';
import { toMemberDTO } from './room.dto';
import { RoomExpense, RoomMember } from './room.models';
import * as rooms from './room.service';
import * as invites from './invite.service';
import * as expenses from './expense.service';
import * as settlements from './settlement.service';

const router = Router();
const p = (v: string | string[] | undefined) => String(v);

// ---------- Rooms ----------
router.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await rooms.listRooms(req.user!._id, req.query.includeArchived === 'true'))),
);

router.post(
  '/',
  validate(createRoomSchema),
  asyncHandler(async (req, res) => created(res, await rooms.createRoom(req.user!, req.body, req), 'Room created')),
);

router.get(
  '/join/:code',
  asyncHandler(async (req, res) => ok(res, await rooms.previewByCode(p(req.params.code), req.user!._id))),
);

router.post(
  '/join',
  validate(joinByCodeSchema),
  asyncHandler(async (req, res) => ok(res, await rooms.joinByCode(req.body.code, req.user!, req), 'Joined room')),
);

router.get(
  '/spending',
  validate(roomSpendingQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { from, to } = query(req, roomSpendingQuerySchema);
    const user = req.user!;
    ok(res, await roomSpendingForUser(user._id, user.defaultCurrency, from, to, user.timezone || 'Asia/Kolkata'));
  }),
);

router.get(
  '/spending/items',
  validate(roomSpendingQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { from, to } = query(req, roomSpendingQuerySchema);
    ok(res, await roomSpendingItemsForUser(req.user!._id, req.user!.defaultCurrency, from, to));
  }),
);

router.get('/:id', asyncHandler(async (req, res) => ok(res, await rooms.getRoomDetail(p(req.params.id), req.user!._id))));

router.patch(
  '/:id',
  validate(updateRoomSchema),
  asyncHandler(async (req, res) => ok(res, await rooms.updateRoom(p(req.params.id), req.user!, req.body, req), 'Room updated')),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await rooms.deleteRoom(p(req.params.id), req.user!, req);
    ok(res, null, 'Room deleted');
  }),
);

router.post('/:id/archive', asyncHandler(async (req, res) => ok(res, await rooms.setArchived(p(req.params.id), req.user!, true, req), 'Room archived')));
router.post('/:id/unarchive', asyncHandler(async (req, res) => ok(res, await rooms.setArchived(p(req.params.id), req.user!, false, req), 'Room restored')));
router.post('/:id/invite-code', asyncHandler(async (req, res) => ok(res, await rooms.regenerateInviteCode(p(req.params.id), req.user!), 'Invite link reset')));

router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    await rooms.leaveRoom(p(req.params.id), req.user!, req);
    ok(res, null, 'You left the room');
  }),
);

router.post(
  '/:id/transfer',
  validate(transferOwnershipSchema),
  asyncHandler(async (req, res) => ok(res, await rooms.transferOwnership(p(req.params.id), req.user!, req.body.userId, req), 'Ownership transferred')),
);

// ---------- Members ----------
router.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const { room } = await loadRoomForMember(p(req.params.id), req.user!._id, { allowFormer: true });
    const members = await RoomMember.find({ roomId: room._id }).sort({ joinedAt: 1 }).lean();
    const users = await loadPublicUsers(
      members.map((m) => String(m.userId)),
      { withUpi: true },
    );
    ok(res, members.map((m) => toMemberDTO(m, users.get(String(m.userId))!)));
  }),
);

router.patch(
  '/:id/members/:userId',
  validate(updateMemberRoleSchema),
  asyncHandler(async (req, res) =>
    ok(res, await rooms.updateMemberRole(p(req.params.id), req.user!, p(req.params.userId), req.body.role, req), 'Role updated'),
  ),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    await rooms.removeMember(p(req.params.id), req.user!, p(req.params.userId), req);
    ok(res, null, 'Member removed');
  }),
);

// ---------- Invites ----------
router.get('/:id/invites', asyncHandler(async (req, res) => ok(res, await invites.listRoomInvites(p(req.params.id), req.user!._id))));

router.post(
  '/:id/invites',
  validate(createInviteSchema),
  asyncHandler(async (req, res) => created(res, await invites.createInvite(p(req.params.id), req.user!, req.body, req), 'Invite sent')),
);

router.delete(
  '/:id/invites/:inviteId',
  asyncHandler(async (req, res) => {
    await invites.revokeInvite(p(req.params.id), p(req.params.inviteId), req.user!);
    ok(res, null, 'Invite revoked');
  }),
);

// ---------- Expenses ----------
router.get(
  '/:id/expenses',
  validate(listRoomExpensesQuerySchema, 'query'),
  asyncHandler(async (req, res) =>
    ok(res, await expenses.listExpenses(p(req.params.id), req.user!._id, query(req, listRoomExpensesQuerySchema))),
  ),
);

router.post(
  '/:id/expenses',
  validate(createRoomExpenseSchema),
  asyncHandler(async (req, res) => created(res, await expenses.addExpense(p(req.params.id), req.user!, req.body, req), 'Expense added')),
);

router.get(
  '/:id/expenses/:expenseId',
  asyncHandler(async (req, res) => ok(res, await expenses.getExpense(p(req.params.id), p(req.params.expenseId), req.user!._id))),
);

router.post(
  '/:id/expenses/:expenseId/shares/:userId/paid',
  validate(markSharePaidSchema),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await expenses.markSharePaid(p(req.params.id), p(req.params.expenseId), p(req.params.userId), req.user!, req.body.paid, req, req.body.upi),
      req.body.paid ? 'Marked as paid' : 'Marked as unpaid',
    ),
  ),
);

router.patch(
  '/:id/expenses/:expenseId',
  validate(updateRoomExpenseSchema),
  asyncHandler(async (req, res) =>
    ok(res, await expenses.updateExpense(p(req.params.id), p(req.params.expenseId), req.user!, req.body, req), 'Expense updated'),
  ),
);

router.delete(
  '/:id/expenses/:expenseId',
  asyncHandler(async (req, res) => {
    await expenses.deleteExpense(p(req.params.id), p(req.params.expenseId), req.user!, req);
    ok(res, null, 'Expense deleted');
  }),
);

// ---------- Balances / budget ----------
router.get(
  '/:id/balances',
  asyncHandler(async (req, res) => {
    const { room } = await loadRoomForMember(p(req.params.id), req.user!._id, { allowFormer: true });
    ok(res, await computeRoomBalances(room.toObject()));
  }),
);

router.get(
  '/:id/budget-summary',
  asyncHandler(async (req, res) => {
    const { room } = await loadRoomForMember(p(req.params.id), req.user!._id, { allowFormer: true });
    const budgetDoc = await Budget.findOne({ ownerType: 'room', ownerId: room._id, deletedAt: null, categoryId: null }).lean();
    const budget = budgetDoc ? await computeProgress(budgetDoc, req.user!.timezone) : null;
    const range = budget ? { occurredAt: { $gte: new Date(budget.periodStart), $lte: new Date(budget.periodEnd) } } : {};
    const match = { roomId: new mongoose.Types.ObjectId(String(room._id)), deletedAt: null, ...range };
    const [byMember, byCategory, total] = await Promise.all([
      RoomExpense.aggregate([{ $match: match }, { $unwind: '$paidBy' }, { $group: { _id: '$paidBy.userId', paid: { $sum: '$paidBy.amount' } } }, { $sort: { paid: -1 } }]),
      RoomExpense.aggregate([{ $match: match }, { $group: { _id: '$categoryId', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
      RoomExpense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    const summary: RoomBudgetSummaryDTO = {
      currency: room.currency,
      budget,
      totalSpent: total[0]?.total ?? 0,
      byMember: byMember.map((m) => ({ userId: String(m._id), paid: m.paid })),
      byCategory: byCategory.map((c) => ({ categoryId: c._id ? String(c._id) : '', total: c.total })),
    };
    ok(res, summary);
  }),
);

router.post(
  '/:id/budget',
  validate(createBudgetSchema),
  asyncHandler(async (req, res) => {
    const { room } = await loadRoomForMember(p(req.params.id), req.user!._id, { roles: ['owner', 'admin'], write: true });
    const budget = await Budget.findOneAndUpdate(
      { ownerType: 'room', ownerId: room._id, categoryId: null, deletedAt: null },
      { $set: { ...req.body, categoryId: null, ownerType: 'room', ownerId: room._id, notifiedThresholds: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    logUser(req, 'room.budget_set', { entity: 'budget', entityId: budget!._id, roomId: room._id, meta: { amount: req.body.amount } });
    checkBudgetAlerts('room', String(room._id)).catch(() => undefined);
    ok(res, toBudgetDTO(budget!), 'Room budget saved');
  }),
);

// ---------- Settlements ----------
router.get('/:id/settlements', asyncHandler(async (req, res) => ok(res, await settlements.listSettlements(p(req.params.id), req.user!._id))));

router.post(
  '/:id/settlements/:settlementId/confirm',
  asyncHandler(async (req, res) =>
    ok(res, await settlements.confirmSettlement(p(req.params.id), p(req.params.settlementId), req.user!, req), 'Payment confirmed'),
  ),
);

router.delete(
  '/:id/settlements/:settlementId',
  asyncHandler(async (req, res) => {
    await settlements.deleteSettlement(p(req.params.id), p(req.params.settlementId), req.user!, req);
    ok(res, null, 'Payment deleted');
  }),
);

export default router;
