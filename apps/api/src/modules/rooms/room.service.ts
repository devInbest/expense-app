import type { Request } from 'express';
import { ERROR_CODES, LIMITS, type CreateRoomInput, type RoomDTO, type RoomPreviewDTO, type UpdateRoomInput } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { randomCode } from '../../lib/crypto';
import { logActivity } from '../activity/activity.service';
import { notifyLater } from '../notifications/notification.service';
import { loadPublicUsers } from '../users/publicUser';
import type { UserDoc } from '../users/user.model';
import { activeMemberIds, isManager, loadRoomForMember } from './access';
import { Budget } from '../budgets/budget.model';
import { Category } from '../categories/category.model';
import { RecurringRule } from '../recurring/recurring.model';
import { computeRoomBalances, netBalanceFor, netBalancesForUser } from './balance.service';
import { toMemberDTO, toRoomDTO } from './room.dto';
import { Room, RoomExpense, RoomInvite, RoomMember, Settlement } from './room.models';

const uniqueInviteCode = async () => {
  for (let i = 0; i < 5; i += 1) {
    const code = randomCode(8);
    if (!(await Room.exists({ inviteCode: code }))) return code;
  }
  throw new Error('Could not allocate an invite code');
};

export const createRoom = async (user: UserDoc, input: CreateRoomInput, req: Request) => {
  const room = await Room.create({
    name: input.name,
    type: input.type,
    currency: input.currency ?? user.defaultCurrency,
    icon: input.icon,
    settings: input.settings,
    createdBy: user._id,
    inviteCode: await uniqueInviteCode(),
  });
  await RoomMember.create({ roomId: room._id, userId: user._id, role: 'owner' });
  logActivity({ actorType: 'user', actorId: user._id, action: 'room.created', entity: 'room', entityId: room._id, roomId: room._id, meta: { type: room.type }, req });
  return getRoomDetail(String(room._id), user._id);
};

export const listRooms = async (userId: unknown, includeArchived: boolean): Promise<RoomDTO[]> => {
  const memberships = await RoomMember.find({ userId, status: 'active' }).lean();
  const roleByRoom = new Map(memberships.map((m) => [String(m.roomId), m.role]));
  const rooms = await Room.find({
    _id: { $in: memberships.map((m) => m.roomId) },
    ...(includeArchived ? {} : { archivedAt: null }),
  })
    .sort({ lastActivityAt: -1 })
    .lean();

  const counts = await RoomMember.aggregate<{ _id: unknown; n: number }>([
    { $match: { roomId: { $in: rooms.map((r) => r._id) }, status: 'active' } },
    { $group: { _id: '$roomId', n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  const balances = await netBalancesForUser(rooms.filter((r) => r.type === 'split').map((r) => r._id), userId);

  return rooms.map((r) =>
    toRoomDTO(r, {
      myRole: roleByRoom.get(String(r._id)) as RoomDTO['myRole'],
      memberCount: countMap.get(String(r._id)) ?? 0,
      myBalance: r.type === 'split' ? (balances.net.get(String(r._id)) ?? 0) : undefined,
      myPaid: r.type === 'split' ? (balances.settled.get(String(r._id)) ?? 0) : undefined,
      inviteCode: undefined,
    }),
  );
};

export const getRoomDetail = async (roomId: string, userId: unknown): Promise<RoomDTO> => {
  const { room, member } = await loadRoomForMember(roomId, userId, { allowFormer: true });
  const members = await RoomMember.find({ roomId: room._id }).sort({ joinedAt: 1 }).lean();
  const users = await loadPublicUsers(
    members.map((m) => String(m.userId)),
    { withUpi: true },
  );
  const canSeeCode = member.status === 'active' && (isManager(member.role) || room.settings?.membersCanInvite);
  return toRoomDTO(room.toObject(), {
    myRole: member.role as RoomDTO['myRole'],
    inviteCode: canSeeCode ? room.inviteCode : undefined,
    memberCount: members.filter((m) => m.status === 'active').length,
    myBalance: room.type === 'split' ? await netBalanceFor(room._id, String(userId)) : undefined,
    members: members.map((m) => toMemberDTO(m, users.get(String(m.userId))!)),
  });
};

export const updateRoom = async (roomId: string, user: UserDoc, input: UpdateRoomInput, req: Request) => {
  const { room } = await loadRoomForMember(roomId, user._id, { roles: ['owner', 'admin'], write: true });
  if (input.currency && input.currency !== room.currency) {
    throw ApiError.badRequest('Room currency cannot be changed', undefined, ERROR_CODES.CURRENCY_LOCKED);
  }
  if (input.name !== undefined) room.name = input.name;
  if (input.icon !== undefined) room.icon = input.icon;
  if (input.settings) room.settings = { ...room.settings, ...input.settings } as typeof room.settings;
  await room.save();
  logActivity({ actorType: 'user', actorId: user._id, action: 'room.updated', entity: 'room', entityId: room._id, roomId: room._id, meta: { fields: Object.keys(input) }, req });
  return getRoomDetail(roomId, user._id);
};

export const setArchived = async (roomId: string, user: UserDoc, archived: boolean, req: Request) => {
  const { room } = await loadRoomForMember(roomId, user._id, { roles: ['owner'] });
  room.archivedAt = archived ? new Date() : null;
  await room.save();
  logActivity({ actorType: 'user', actorId: user._id, action: archived ? 'room.archived' : 'room.unarchived', entity: 'room', entityId: room._id, roomId: room._id, req });
  return getRoomDetail(roomId, user._id);
};

/**
 * Owner-only, permanent, and only for archived rooms. Split rooms must be fully settled first so nobody loses track of money
 * they're owed. Activity logs and past notifications are kept.
 */
export const deleteRoom = async (roomId: string, user: UserDoc, req: Request) => {
  const { room } = await loadRoomForMember(roomId, user._id, { roles: ['owner'] });
  if (!room.archivedAt) throw ApiError.badRequest('Archive the room before deleting it');
  if (room.type === 'split') {
    const { net } = await computeRoomBalances(room.toObject());
    if (Object.values(net).some((v) => v !== 0)) {
      throw ApiError.badRequest('Settle all balances before deleting this room', undefined, ERROR_CODES.UNSETTLED_BALANCE);
    }
  }

  const notifyIds = (await activeMemberIds(room._id)).filter((id) => id !== String(user._id));
  const ownedBy = { ownerType: 'room', ownerId: room._id };
  await room.deleteOne();
  await Promise.all([
    RoomMember.deleteMany({ roomId: room._id }),
    RoomInvite.deleteMany({ roomId: room._id }),
    RoomExpense.deleteMany({ roomId: room._id }),
    Settlement.deleteMany({ roomId: room._id }),
    Budget.deleteMany(ownedBy),
    Category.deleteMany(ownedBy),
    RecurringRule.deleteMany(ownedBy),
  ]);

  notifyLater({
    userIds: notifyIds,
    type: 'room_deleted',
    title: room.name,
    body: `${user.name || 'The owner'} deleted the room "${room.name}"`,
    pref: 'roomActivity',
  });
  logActivity({ actorType: 'user', actorId: user._id, action: 'room.deleted', entity: 'room', entityId: room._id, roomId: room._id, meta: { name: room.name, type: room.type }, req });
};

export const regenerateInviteCode = async (roomId: string, user: UserDoc) => {
  const { room } = await loadRoomForMember(roomId, user._id, { roles: ['owner', 'admin'], write: true });
  room.inviteCode = await uniqueInviteCode();
  await room.save();
  return getRoomDetail(roomId, user._id);
};

export const previewByCode = async (code: string, userId: unknown): Promise<RoomPreviewDTO> => {
  const room = await Room.findOne({ inviteCode: code.toUpperCase(), archivedAt: null }).lean();
  if (!room) throw ApiError.notFound('This invite link is invalid or has been reset');
  const [memberCount, me] = await Promise.all([
    RoomMember.countDocuments({ roomId: room._id, status: 'active' }),
    RoomMember.findOne({ roomId: room._id, userId, status: 'active' }).lean(),
  ]);
  return { _id: String(room._id), name: room.name, type: room.type as RoomPreviewDTO['type'], icon: room.icon, memberCount, alreadyMember: Boolean(me) };
};

/** Adds (or re-activates) a membership. Shared by join-by-code and accepting an invite. */
export const addMember = async (roomId: unknown, user: UserDoc, via: string, req?: Request) => {
  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound('Room not found');
  if (room.archivedAt) throw ApiError.badRequest('This room is archived', undefined, ERROR_CODES.ROOM_ARCHIVED);

  const existing = await RoomMember.findOne({ roomId, userId: user._id });
  if (existing?.status === 'active') return room;

  const count = await RoomMember.countDocuments({ roomId, status: 'active' });
  if (count >= LIMITS.MAX_ROOM_MEMBERS) throw ApiError.badRequest(`Rooms can have at most ${LIMITS.MAX_ROOM_MEMBERS} members`);

  if (existing) {
    existing.status = 'active';
    existing.role = 'member';
    existing.joinedAt = new Date();
    existing.leftAt = undefined;
    await existing.save();
  } else {
    await RoomMember.create({ roomId, userId: user._id, role: 'member' });
  }
  await RoomInvite.updateMany(
    { roomId, targetUserId: user._id, status: 'pending' },
    { status: 'accepted', respondedAt: new Date() },
  );
  room.lastActivityAt = new Date();
  await room.save();

  const others = (await activeMemberIds(roomId)).filter((id) => id !== String(user._id));
  notifyLater({
    userIds: others,
    type: 'room_joined',
    title: room.name,
    body: `${user.name || 'Someone'} joined the room`,
    data: { roomId: String(room._id) },
    pref: 'roomActivity',
  });
  logActivity({ actorType: 'user', actorId: user._id, action: 'room.joined', entity: 'room', entityId: room._id, roomId: room._id, meta: { via }, req });
  return room;
};

export const joinByCode = async (code: string, user: UserDoc, req: Request) => {
  const room = await Room.findOne({ inviteCode: code.toUpperCase() });
  if (!room) throw ApiError.notFound('This invite link is invalid or has been reset');
  await addMember(room._id, user, 'code', req);
  return getRoomDetail(String(room._id), user._id);
};

const assertSettled = async (roomId: unknown, userId: string, message: string) => {
  const balance = await netBalanceFor(roomId, userId);
  if (balance !== 0) throw ApiError.badRequest(message, undefined, ERROR_CODES.UNSETTLED_BALANCE);
};

export const leaveRoom = async (roomId: string, user: UserDoc, req: Request) => {
  const { room, member } = await loadRoomForMember(roomId, user._id);
  const others = (await activeMemberIds(room._id)).filter((id) => id !== String(user._id));

  if (member.role === 'owner' && others.length > 0) {
    throw ApiError.badRequest('Transfer ownership to another member before leaving', undefined, ERROR_CODES.OWNER_MUST_TRANSFER);
  }
  if (room.type === 'split') await assertSettled(room._id, String(user._id), 'Settle up your balance before leaving this room');

  member.status = 'left';
  member.leftAt = new Date();
  await member.save();
  if (others.length === 0) {
    room.archivedAt = new Date();
    await room.save();
  }
  logActivity({ actorType: 'user', actorId: user._id, action: 'room.left', entity: 'room', entityId: room._id, roomId: room._id, req });
};

export const removeMember = async (roomId: string, actor: UserDoc, targetUserId: string, req: Request) => {
  const { room, member: me } = await loadRoomForMember(roomId, actor._id, { roles: ['owner', 'admin'] });
  if (String(actor._id) === targetUserId) throw ApiError.badRequest('Use "Leave room" to remove yourself');
  const target = await RoomMember.findOne({ roomId: room._id, userId: targetUserId, status: 'active' });
  if (!target) throw ApiError.notFound('Member not found');
  if (target.role === 'owner') throw ApiError.forbidden('The owner cannot be removed');
  if (target.role === 'admin' && me.role !== 'owner') throw ApiError.forbidden('Only the owner can remove an admin');

  // Unlike leaving, removal is allowed with an open balance: the person stays in the ledger as "left".
  target.status = 'removed';
  target.leftAt = new Date();
  target.removedBy = actor._id;
  await target.save();

  notifyLater({
    userIds: [targetUserId],
    type: 'member_removed',
    title: room.name,
    body: `You were removed from ${room.name}`,
    data: { roomId: String(room._id) },
  });
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.member_removed', entity: 'user', entityId: targetUserId, roomId: room._id, req });
};

export const updateMemberRole = async (roomId: string, actor: UserDoc, targetUserId: string, role: 'admin' | 'member', req: Request) => {
  const { room } = await loadRoomForMember(roomId, actor._id, { roles: ['owner'] });
  const target = await RoomMember.findOne({ roomId: room._id, userId: targetUserId, status: 'active' });
  if (!target) throw ApiError.notFound('Member not found');
  if (target.role === 'owner') throw ApiError.badRequest('Use transfer ownership to change the owner');
  target.role = role;
  await target.save();
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.role_changed', entity: 'user', entityId: targetUserId, roomId: room._id, meta: { role }, req });
  const users = await loadPublicUsers([targetUserId]);
  return toMemberDTO(target.toObject(), users.get(targetUserId)!);
};

export const transferOwnership = async (roomId: string, actor: UserDoc, targetUserId: string, req: Request) => {
  const { room, member: me } = await loadRoomForMember(roomId, actor._id, { roles: ['owner'] });
  const target = await RoomMember.findOne({ roomId: room._id, userId: targetUserId, status: 'active' });
  if (!target || String(target.userId) === String(actor._id)) throw ApiError.badRequest('Pick another active member');
  target.role = 'owner';
  me.role = 'admin';
  await Promise.all([target.save(), me.save()]);
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.ownership_transferred', entity: 'user', entityId: targetUserId, roomId: room._id, req });
  return getRoomDetail(roomId, actor._id);
};

/** Account deletion: hand rooms to the longest-standing admin (then member); archive empty rooms. */
export const removeUserFromAllRooms = async (userId: string) => {
  const memberships = await RoomMember.find({ userId, status: 'active' });
  for (const m of memberships) {
    if (m.role === 'owner') {
      const successor =
        (await RoomMember.findOne({ roomId: m.roomId, status: 'active', role: 'admin', userId: { $ne: userId } }).sort({ joinedAt: 1 })) ??
        (await RoomMember.findOne({ roomId: m.roomId, status: 'active', userId: { $ne: userId } }).sort({ joinedAt: 1 }));
      if (successor) {
        successor.role = 'owner';
        await successor.save();
      } else {
        await Room.updateOne({ _id: m.roomId }, { archivedAt: new Date() });
      }
    }
    m.status = 'left';
    m.leftAt = new Date();
    await m.save();
  }
};
