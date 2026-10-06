import type { Request } from 'express';
import { formatMoney } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { logActivity } from '../activity/activity.service';
import { notifyLater } from '../notifications/notification.service';
import type { UserDoc } from '../users/user.model';
import { isManager, loadRoomForMember } from './access';
import { toSettlementDTO } from './room.dto';
import { Settlement } from './room.models';

export const listSettlements = async (roomId: string, userId: unknown) => {
  const { room } = await loadRoomForMember(roomId, userId, { allowFormer: true });
  const docs = await Settlement.find({ roomId: room._id, deletedAt: null }).sort({ settledAt: -1 }).limit(200).lean();
  return docs.map(toSettlementDTO);
};

export const confirmSettlement = async (roomId: string, settlementId: string, actor: UserDoc, req: Request) => {
  const { room } = await loadRoomForMember(roomId, actor._id, { allowFormer: true });
  const settlement = await Settlement.findOne({ _id: settlementId, roomId: room._id, deletedAt: null });
  if (!settlement) throw ApiError.notFound('Payment not found');
  if (String(settlement.toUserId) !== String(actor._id)) throw ApiError.forbidden('Only the person who received the money can confirm it');
  if (!settlement.confirmedAt) {
    settlement.confirmedAt = new Date();
    settlement.confirmedBy = actor._id;
    await settlement.save();
    notifyLater({
      userIds: [String(settlement.recordedBy)].filter((id) => id !== String(actor._id)),
      type: 'settlement_confirmed',
      title: room.name,
      body: `${actor.name} confirmed receiving ${formatMoney(settlement.amount, room.currency)}`,
      data: { roomId: String(room._id), settlementId: String(settlement._id) },
      pref: 'roomActivity',
    });
    logActivity({ actorType: 'user', actorId: actor._id, action: 'room.settlement_confirmed', entity: 'settlement', entityId: settlement._id, roomId: room._id, req });
  }
  return toSettlementDTO(settlement.toObject());
};

export const deleteSettlement = async (roomId: string, settlementId: string, actor: UserDoc, req: Request) => {
  const { room, member } = await loadRoomForMember(roomId, actor._id, { allowFormer: true, write: true });
  const settlement = await Settlement.findOne({ _id: settlementId, roomId: room._id, deletedAt: null });
  if (!settlement) throw ApiError.notFound('Payment not found');
  const isRecorder = String(settlement.recordedBy) === String(actor._id);
  if (!isRecorder && !(member.status === 'active' && isManager(member.role))) throw ApiError.forbidden();
  if (settlement.expenseId) throw ApiError.badRequest('This payment came from marking an expense as paid. Undo it from that expense.');
  settlement.deletedAt = new Date();
  await settlement.save();
  logActivity({ actorType: 'user', actorId: actor._id, action: 'room.settlement_deleted', entity: 'settlement', entityId: settlement._id, roomId: room._id, meta: { amount: settlement.amount }, req });
};
