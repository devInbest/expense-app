import { z } from 'zod';
import { PAYMENT_METHOD_VALUES, ROOM_ROLE_VALUES, ROOM_TYPE_VALUES, SPLIT_TYPE_VALUES } from '../constants/enums';
import { amountSchema, currencySchema, cursorQuerySchema, dateSchema, noteSchema, objectIdSchema, phoneSchema, upiIdSchema } from './common';

export const roomSettingsSchema = z.object({
  simplifyDebts: z.boolean().optional(),
  membersCanAddExpense: z.boolean().optional(),
  membersCanInvite: z.boolean().optional(),
});
export type RoomSettings = Required<z.infer<typeof roomSettingsSchema>>;

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(60),
  type: z.enum(ROOM_TYPE_VALUES),
  currency: currencySchema.optional(),
  icon: z.string().trim().max(48).default('account-group'),
  settings: roomSettingsSchema.optional(),
});
export type CreateRoomInput = z.input<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().max(48).optional(),
  currency: currencySchema.optional(),
  settings: roomSettingsSchema.optional(),
});
export type UpdateRoomInput = z.input<typeof updateRoomSchema>;

export const createInviteSchema = z.discriminatedUnion('channel', [
  z.object({ channel: z.literal('user'), userId: objectIdSchema }),
  z.object({ channel: z.literal('phone'), phone: phoneSchema }),
]);
export type CreateInviteInput = z.input<typeof createInviteSchema>;

export const joinByCodeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,12}$/, 'Invalid invite code'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ROOM_ROLE_VALUES).exclude(['owner']),
});

export const transferOwnershipSchema = z.object({ userId: objectIdSchema });

export const payerSchema = z.object({ userId: objectIdSchema, amount: amountSchema });

export const splitEntrySchema = z.object({
  userId: objectIdSchema,
  value: z.number().nonnegative().optional(),
});
export const createRoomExpenseSchema = z.object({
  amount: amountSchema,
  categoryId: objectIdSchema.optional(),
  note: noteSchema,
  occurredAt: dateSchema,
  /** Ignored by the API: the person adding the expense is always the payer. Kept for older clients. */
  paidBy: z.array(payerSchema).max(50).optional(),
  splitType: z.enum(SPLIT_TYPE_VALUES).default('equal'),
  /** Required for split rooms; ignored for shared-budget rooms. */
  splits: z.array(splitEntrySchema).max(50).optional(),
  receiptUrl: z.string().url().optional().or(z.literal('')),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('upi'),
  /** Where people who owe on this expense can pay the creator back. Empty clears it. */
  upiId: upiIdSchema.optional().or(z.literal('')),
});
export type CreateRoomExpenseInput = z.input<typeof createRoomExpenseSchema>;

export const updateRoomExpenseSchema = createRoomExpenseSchema.partial();
export type UpdateRoomExpenseInput = z.input<typeof updateRoomExpenseSchema>;

/** `to` is exclusive, matching the app's local month ranges. */
export const roomSpendingQuerySchema = z.object({ from: dateSchema, to: dateSchema });
export type RoomSpendingQuery = z.input<typeof roomSpendingQuerySchema>;

export const markSharePaidSchema = z.object({
  paid: z.boolean(),
  /** Sent by the person who owes after paying through a UPI app; lets them mark their own share paid. */
  upi: z
    .object({
      txnId: z.string().trim().max(64).optional(),
      app: z.string().trim().max(40).optional(),
    })
    .optional(),
});
export type MarkSharePaidInput = z.input<typeof markSharePaidSchema>;

export const listRoomExpensesQuerySchema = cursorQuerySchema.extend({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  memberId: objectIdSchema.optional(),
});