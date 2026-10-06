import type { PublicUserDTO, RoomDTO, RoomExpenseDTO, RoomMemberDTO, SettlementDTO } from '@expense/shared';
import type { RoomAttrs, RoomExpenseAttrs, RoomMemberAttrs, SettlementAttrs } from './room.models';

type WithId<T> = T & { _id: unknown };

export const toRoomDTO = (r: WithId<RoomAttrs>, extra: Partial<RoomDTO> = {}): RoomDTO => ({
  _id: String(r._id),
  name: r.name,
  type: r.type as RoomDTO['type'],
  currency: r.currency,
  icon: r.icon,
  settings: {
    simplifyDebts: r.settings?.simplifyDebts ?? true,
    membersCanAddExpense: r.settings?.membersCanAddExpense ?? true,
    membersCanInvite: r.settings?.membersCanInvite ?? true,
  },
  createdBy: String(r.createdBy),
  archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
  hasExpenses: Boolean(r.hasExpenses),
  createdAt: new Date(r.createdAt).toISOString(),
  ...extra,
});

export const toMemberDTO = (m: WithId<RoomMemberAttrs>, user: PublicUserDTO): RoomMemberDTO => ({
  _id: String(m._id),
  user,
  role: m.role as RoomMemberDTO['role'],
  status: m.status as RoomMemberDTO['status'],
  joinedAt: new Date(m.joinedAt).toISOString(),
  leftAt: m.leftAt ? m.leftAt.toISOString() : undefined,
});

type ExpenseLike = Omit<WithId<RoomExpenseAttrs>, 'paidBy' | 'splits'> & {
  paidBy: { userId: unknown; amount: number }[];
  splits: { userId: unknown; share?: number | null; amount: number; paidAt?: Date | null; paidViaUpi?: boolean | null; upiTxnId?: string | null }[];
};

export const toExpenseDTO = (e: ExpenseLike): RoomExpenseDTO => ({
  _id: String(e._id),
  roomId: String(e.roomId),
  amount: e.amount,
  categoryId: e.categoryId ? String(e.categoryId) : undefined,
  note: e.note ?? '',
  occurredAt: e.occurredAt.toISOString(),
  paidBy: e.paidBy.map((p) => ({ userId: String(p.userId), amount: p.amount })),
  splitType: e.splitType as RoomExpenseDTO['splitType'],
  splits: e.splits.map((s) => ({
    userId: String(s.userId),
    share: s.share ?? 1,
    amount: s.amount,
    paidAt: s.paidAt ? s.paidAt.toISOString() : null,
    paidViaUpi: s.paidAt ? Boolean(s.paidViaUpi) : undefined,
    upiTxnId: s.paidAt ? (s.upiTxnId ?? null) : null,
  })),
  settledAt: e.settledAt ? e.settledAt.toISOString() : null,
  receiptUrl: e.receiptUrl ?? undefined,
  paymentMethod: (e.paymentMethod ?? 'upi') as RoomExpenseDTO['paymentMethod'],
  upiId: e.upiId ?? undefined,
  createdBy: String(e.createdBy),
  updatedBy: e.updatedBy ? String(e.updatedBy) : undefined,
  createdAt: new Date(e.createdAt).toISOString(),
  updatedAt: new Date(e.updatedAt).toISOString(),
});

export const toSettlementDTO = (s: WithId<SettlementAttrs>): SettlementDTO => ({
  _id: String(s._id),
  roomId: String(s.roomId),
  fromUserId: String(s.fromUserId),
  toUserId: String(s.toUserId),
  amount: s.amount,
  method: s.method as SettlementDTO['method'],
  note: s.note ?? '',
  settledAt: new Date(s.settledAt).toISOString(),
  recordedBy: String(s.recordedBy),
  confirmedAt: s.confirmedAt ? s.confirmedAt.toISOString() : null,
  confirmedBy: s.confirmedBy ? String(s.confirmedBy) : null,
  expenseId: s.expenseId ? String(s.expenseId) : undefined,
  createdAt: new Date(s.createdAt).toISOString(),
});
