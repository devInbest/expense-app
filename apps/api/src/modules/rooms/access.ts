import mongoose from 'mongoose';
import { ERROR_CODES, type RoomRole } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { Room, RoomMember } from './room.models';

export const isManager = (role?: string | null) => role === 'owner' || role === 'admin';

/**
 * Loads a room the user belongs to. Non-members get 404 (not 403) so room ids cannot be probed.
 * `allowFormer` lets people who left still read history and settle what they owe.
 */
export const loadRoomForMember = async (
  roomId: string,
  userId: unknown,
  opts: { roles?: RoomRole[]; allowFormer?: boolean; write?: boolean } = {},
) => {
  if (!mongoose.isValidObjectId(roomId)) throw ApiError.notFound('Room not found');
  const [room, member] = await Promise.all([
    Room.findById(roomId),
    RoomMember.findOne({ roomId, userId }),
  ]);
  if (!room || !member) throw ApiError.notFound('Room not found');
  if (member.status !== 'active' && !opts.allowFormer) throw ApiError.notFound('Room not found');
  if (opts.roles && (member.status !== 'active' || !opts.roles.includes(member.role as RoomRole))) {
    throw ApiError.forbidden('Only room admins can do that');
  }
  if (opts.write && room.archivedAt) {
    throw ApiError.badRequest('This room is archived. Unarchive it to make changes.', undefined, ERROR_CODES.ROOM_ARCHIVED);
  }
  return { room, member };
};

export const activeMemberIds = async (roomId: unknown): Promise<string[]> =>
  (await RoomMember.find({ roomId, status: 'active' }).select('userId').lean()).map((m) => String(m.userId));

export const allMemberIds = async (roomId: unknown): Promise<string[]> =>
  (await RoomMember.find({ roomId }).select('userId').lean()).map((m) => String(m.userId));
