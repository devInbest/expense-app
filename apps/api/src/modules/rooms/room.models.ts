import mongoose, { type InferSchemaType } from 'mongoose';
import {
  INVITE_CHANNEL_VALUES,
  INVITE_STATUS_VALUES,
  MEMBER_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  ROOM_ROLE_VALUES,
  ROOM_TYPE_VALUES,
  SPLIT_TYPE_VALUES,
} from '@expense/shared';

const { ObjectId } = mongoose.Schema.Types;

// ---------- Room ----------
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ROOM_TYPE_VALUES, required: true },
    currency: { type: String, required: true },
    icon: { type: String, default: 'account-group' },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    inviteCode: { type: String, required: true },
    settings: {
      simplifyDebts: { type: Boolean, default: true },
      membersCanAddExpense: { type: Boolean, default: true },
      membersCanInvite: { type: Boolean, default: true },
    },
    /** Set once the first expense exists; currency is locked afterwards. */
    hasExpenses: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
roomSchema.index({ inviteCode: 1 }, { unique: true });
roomSchema.index({ createdAt: -1 });

export type RoomAttrs = InferSchemaType<typeof roomSchema>;
export const Room = mongoose.model('Room', roomSchema);

// ---------- Member ----------
const memberSchema = new mongoose.Schema(
  {
    roomId: { type: ObjectId, ref: 'Room', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROOM_ROLE_VALUES, default: 'member' },
    status: { type: String, enum: MEMBER_STATUS_VALUES, default: 'active' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    removedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
memberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
memberSchema.index({ userId: 1, status: 1 });

export type RoomMemberAttrs = InferSchemaType<typeof memberSchema>;
export const RoomMember = mongoose.model('RoomMember', memberSchema);

// ---------- Invite ----------
const inviteSchema = new mongoose.Schema(
  {
    roomId: { type: ObjectId, ref: 'Room', required: true },
    invitedBy: { type: ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: INVITE_CHANNEL_VALUES, required: true },
    targetUserId: { type: ObjectId, ref: 'User' },
    phone: { type: String },
    status: { type: String, enum: INVITE_STATUS_VALUES, default: 'pending' },
    remindedAt: { type: Date },
    respondedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
inviteSchema.index({ targetUserId: 1, status: 1 });
inviteSchema.index({ phone: 1, status: 1 });
inviteSchema.index({ roomId: 1, status: 1 });
inviteSchema.index({ status: 1, expiresAt: 1 });

export type RoomInviteAttrs = InferSchemaType<typeof inviteSchema>;
export const RoomInvite = mongoose.model('RoomInvite', inviteSchema);

// ---------- Expense ----------
const roomExpenseSchema = new mongoose.Schema(
  {
    roomId: { type: ObjectId, ref: 'Room', required: true },
    amount: { type: Number, required: true, min: 1 },
    categoryId: { type: ObjectId, ref: 'Category' },
    note: { type: String, default: '' },
    occurredAt: { type: Date, required: true },
    paidBy: [{ _id: false, userId: { type: ObjectId, required: true }, amount: { type: Number, required: true } }],
    splitType: { type: String, enum: SPLIT_TYPE_VALUES, default: 'equal' },
    splits: [
      {
        _id: false,
        userId: { type: ObjectId, required: true },
        share: { type: Number, default: 1 },
        amount: { type: Number, required: true },
        paidAt: { type: Date, default: null },
        paidViaUpi: { type: Boolean, default: false },
        upiTxnId: { type: String, default: null },
      },
    ],
    settledAt: { type: Date, default: null },
    receiptUrl: { type: String },
    paymentMethod: { type: String, enum: PAYMENT_METHOD_VALUES, default: 'upi' },
    upiId: { type: String },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    updatedBy: { type: ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
roomExpenseSchema.index({ roomId: 1, deletedAt: 1, occurredAt: -1, _id: -1 });
roomExpenseSchema.index({ createdAt: -1 });

export type RoomExpenseAttrs = InferSchemaType<typeof roomExpenseSchema>;
export const RoomExpense = mongoose.model('RoomExpense', roomExpenseSchema);

// ---------- Settlement ----------
const settlementSchema = new mongoose.Schema(
  {
    roomId: { type: ObjectId, ref: 'Room', required: true },
    fromUserId: { type: ObjectId, ref: 'User', required: true },
    toUserId: { type: ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHOD_VALUES, default: 'upi' },
    note: { type: String, default: '' },
    settledAt: { type: Date, default: Date.now },
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: ObjectId, ref: 'User', default: null },
    expenseId: { type: ObjectId, ref: 'RoomExpense' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
settlementSchema.index({ roomId: 1, deletedAt: 1, settledAt: -1 });
settlementSchema.index({ expenseId: 1, fromUserId: 1 }, { sparse: true });
settlementSchema.index({ createdAt: -1 });

export type SettlementAttrs = InferSchemaType<typeof settlementSchema>;
export const Settlement = mongoose.model('Settlement', settlementSchema);
