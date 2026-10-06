import type { Request } from 'express';
import mongoose from 'mongoose';
import { buildInviteLink, ERROR_CODES, LIMITS, type CreateInviteInput, type RoomInviteDTO } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { env } from '../../config/env';
import { sendSms } from '../../lib/sms';
import { logActivity } from '../activity/activity.service';
import { notifyLater } from '../notifications/notification.service';
import { loadPublicUsers } from '../users/publicUser';
import { User, type UserDoc } from '../users/user.model';
import { isManager, loadRoomForMember } from './access';
import { Room, RoomInvite, RoomMember, type RoomInviteAttrs } from './room.models';
import { addMember } from './room.service';

const inviteExpiry = () => new Date(Date.now() + LIMITS.INVITE_TTL_DAYS * 86400_000);

const toInviteDTOs = async (invites: (RoomInviteAttrs & { _id: unknown })[]): Promise<RoomInviteDTO[]> => {
  const rooms = await Room.find({ _id: { $in: invites.map((i) => i.roomId) } }).select('name type icon currency').lean();
  const roomMap = new Map(rooms.map((r) => [String(r._id), r]));
  const users = await loadPublicUsers(invites.flatMap((i) => [String(i.invitedBy), ...(i.targetUserId ? [String(i.targetUserId)] : [])]));
  return invites
    .filter((i) => roomMap.has(String(i.roomId)))
    .map((i) => {
      const r = roomMap.get(String(i.roomId))!;
      return {
        _id: String(i._id),
        room: { _id: String(r._id), name: r.name, type: r.type as RoomInviteDTO['room']['type'], icon: r.icon, currency: r.currency },
        invitedBy: users.get(String(i.invitedBy))!,
        channel: i.channel as RoomInviteDTO['channel'],
        phone: i.phone ?? undefined,
        targetUser: i.targetUserId ? users.get(String(i.targetUserId)) : undefined,
        status: i.status as RoomInviteDTO['status'],
        expiresAt: i.expiresAt.toISOString(),
        createdAt: new Date(i.createdAt).toISOString(),
      };
    });
};

export const createInvite = async (roomId: string, actor: UserDoc, input: CreateInviteInput, req: Request): Promise<RoomInviteDTO> => {
  const { room, member } = await loadRoomForMember(roomId, actor._id, { write: true });
  if (!isManager(member.role) && !room.settings?.membersCanInvite) {
    throw ApiError.forbidden('Only room admins can invite people to this room');
  }

  // A phone number that already belongs to a user becomes a normal in-app invite.
  let targetUser: UserDoc | null = null;
  if (input.channel === 'user') {
    targetUser = await User.findOne({ _id: input.userId, status: 'active' });
    if (!targetUser) throw ApiError.notFound('User not found');
  } else {
    targetUser = await User.findOne({ phone: input.phone, status: 'active' });
  }
  if (targetUser && String(targetUser._id) === String(actor._id)) throw ApiError.badRequest('You are already in this room');

  if (targetUser) {
    const already = await RoomMember.exists({ roomId: room._id, userId: targetUser._id, status: 'active' });
    if (already) throw ApiError.conflict(`${targetUser.name || 'This person'} is already a member`);
  }

  const phone = input.channel === 'phone' ? input.phone : undefined;
  const dedupe = targetUser ? { targetUserId: targetUser._id } : { phone };
  let invite = await RoomInvite.findOne({ roomId: room._id, status: 'pending', ...dedupe });

  if (invite) {
    // Re-inviting the same person is a reminder, not a second invite.
    invite.remindedAt = new Date();
    invite.expiresAt = inviteExpiry();
    await invite.save();
  } else {
    invite = await RoomInvite.create({
      roomId: room._id,
      invitedBy: actor._id,
      channel: targetUser ? 'user' : 'phone',
      targetUserId: targetUser?._id,
      phone: targetUser ? undefined : phone,
      expiresAt: inviteExpiry(),
    });
  }

  if (targetUser) {
    notifyLater({
      userIds: [String(targetUser._id)],
      type: 'room_invite',
      title: 'Room invite',
      body: `${actor.name || 'Someone'} invited you to join ${room.name}`,
      data: { inviteId: String(invite._id), roomId: String(room._id) },
    });
  } else if (phone) {
    const link = buildInviteLink(env.appLinkBase, room.inviteCode);
    sendSms({
      to: phone,
      text: `${actor.name || 'A friend'} invited you to "${room.name}" on Expense App to track shared expenses. Join: ${link}`,
      templateId: env.sms.inviteTemplateId || undefined,
      vars: { name: actor.name || 'A friend', room: room.name, link },
    }).catch((err) => console.error('Invite SMS failed:', err.message));
  }

  logActivity({
    actorType: 'user',
    actorId: actor._id,
    action: invite.remindedAt ? 'room.invite_reminded' : 'room.invite_sent',
    entity: 'invite',
    entityId: invite._id,
    roomId: room._id,
    meta: { channel: invite.channel },
    req,
  });
  return (await toInviteDTOs([invite.toObject()]))[0];
};

export const listRoomInvites = async (roomId: string, userId: unknown) => {
  const { room } = await loadRoomForMember(roomId, userId);
  const invites = await RoomInvite.find({ roomId: room._id, status: 'pending', expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  return toInviteDTOs(invites);
};

export const revokeInvite = async (roomId: string, inviteId: string, actor: UserDoc) => {
  const { room, member } = await loadRoomForMember(roomId, actor._id);
  const invite = await RoomInvite.findOne({ _id: inviteId, roomId: room._id, status: 'pending' });
  if (!invite) throw ApiError.notFound('Invite not found');
  if (!isManager(member.role) && String(invite.invitedBy) !== String(actor._id)) throw ApiError.forbidden();
  invite.status = 'revoked';
  await invite.save();
};

export const myInvites = async (userId: unknown) => {
  const invites = await RoomInvite.find({ targetUserId: userId, status: 'pending', expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  return toInviteDTOs(invites);
};

const loadOwnInvite = async (inviteId: string, userId: unknown) => {
  if (!mongoose.isValidObjectId(inviteId)) throw ApiError.notFound('Invite not found');
  const invite = await RoomInvite.findOne({ _id: inviteId, targetUserId: userId });
  if (!invite) throw ApiError.notFound('Invite not found');
  if (invite.status !== 'pending' || invite.expiresAt < new Date()) {
    throw ApiError.badRequest('This invite is no longer valid', undefined, ERROR_CODES.INVITE_INVALID);
  }
  return invite;
};

export const acceptInvite = async (inviteId: string, user: UserDoc, req: Request) => {
  const invite = await loadOwnInvite(inviteId, user._id);
  await addMember(invite.roomId, user, 'invite', req);
  invite.status = 'accepted';
  invite.respondedAt = new Date();
  await invite.save();
  return invite.roomId;
};

export const declineInvite = async (inviteId: string, user: UserDoc) => {
  const invite = await loadOwnInvite(inviteId, user._id);
  invite.status = 'declined';
  invite.respondedAt = new Date();
  await invite.save();
};

/** When a phone number signs up or is verified, invites sent to it show up in that user's inbox. */
export const linkPhoneInvitesToUser = async (userId: string, phone: string) => {
  await RoomInvite.updateMany(
    { phone, status: 'pending', targetUserId: { $exists: false } },
    { $set: { targetUserId: userId, channel: 'user' } },
  );
};

export const expireInvites = async () => {
  const { modifiedCount } = await RoomInvite.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { status: 'expired' },
  );
  return modifiedCount;
};
