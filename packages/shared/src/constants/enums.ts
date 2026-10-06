const values = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [T[keyof T], ...T[keyof T][]];

export const USER_STATUS = { ACTIVE: 'active', BLOCKED: 'blocked', DELETED: 'deleted' } as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];
export const USER_STATUS_VALUES = values(USER_STATUS);

export const ADMIN_ROLES = { SUPERADMIN: 'superadmin', SUPPORT: 'support' } as const;
export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];
export const ADMIN_ROLE_VALUES = values(ADMIN_ROLES);

export const PLATFORMS = { IOS: 'ios', ANDROID: 'android', WEB: 'web' } as const;
export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];
export const PLATFORM_VALUES = values(PLATFORMS);

export const TRANSACTION_TYPES = { EXPENSE: 'expense', INCOME: 'income' } as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];
export const TRANSACTION_TYPE_VALUES = values(TRANSACTION_TYPES);

export const PAYMENT_METHODS = {
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  BANK: 'bank',
  OTHER: 'other',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
export const PAYMENT_METHOD_VALUES = values(PAYMENT_METHODS);

export const CATEGORY_OWNER_TYPES = { SYSTEM: 'system', USER: 'user', ROOM: 'room' } as const;
export type CategoryOwnerType = (typeof CATEGORY_OWNER_TYPES)[keyof typeof CATEGORY_OWNER_TYPES];
export const CATEGORY_OWNER_TYPE_VALUES = values(CATEGORY_OWNER_TYPES);

export const OWNER_TYPES = { USER: 'user', ROOM: 'room' } as const;
export type OwnerType = (typeof OWNER_TYPES)[keyof typeof OWNER_TYPES];
export const OWNER_TYPE_VALUES = values(OWNER_TYPES);

export const BUDGET_PERIODS = { WEEKLY: 'weekly', MONTHLY: 'monthly', CUSTOM: 'custom' } as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[keyof typeof BUDGET_PERIODS];
export const BUDGET_PERIOD_VALUES = values(BUDGET_PERIODS);

export const RECURRING_FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[keyof typeof RECURRING_FREQUENCIES];
export const RECURRING_FREQUENCY_VALUES = values(RECURRING_FREQUENCIES);

export const ROOM_TYPES = { SPLIT: 'split', SHARED_BUDGET: 'shared_budget' } as const;
export type RoomType = (typeof ROOM_TYPES)[keyof typeof ROOM_TYPES];
export const ROOM_TYPE_VALUES = values(ROOM_TYPES);

export const ROOM_ROLES = { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member' } as const;
export type RoomRole = (typeof ROOM_ROLES)[keyof typeof ROOM_ROLES];
export const ROOM_ROLE_VALUES = values(ROOM_ROLES);

export const MEMBER_STATUS = { ACTIVE: 'active', LEFT: 'left', REMOVED: 'removed' } as const;
export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];
export const MEMBER_STATUS_VALUES = values(MEMBER_STATUS);

export const INVITE_CHANNELS = { USER: 'user', PHONE: 'phone', LINK: 'link' } as const;
export type InviteChannel = (typeof INVITE_CHANNELS)[keyof typeof INVITE_CHANNELS];
export const INVITE_CHANNEL_VALUES = values(INVITE_CHANNELS);

export const INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;
export type InviteStatus = (typeof INVITE_STATUS)[keyof typeof INVITE_STATUS];
export const INVITE_STATUS_VALUES = values(INVITE_STATUS);

export const SPLIT_TYPES = {
  EQUAL: 'equal',
  EXACT: 'exact',
  PERCENT: 'percent',
  SHARES: 'shares',
} as const;
export type SplitType = (typeof SPLIT_TYPES)[keyof typeof SPLIT_TYPES];
export const SPLIT_TYPE_VALUES = values(SPLIT_TYPES);

export const OTP_PURPOSES = { LOGIN: 'login', CHANGE_PHONE: 'change_phone' } as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[keyof typeof OTP_PURPOSES];
export const OTP_PURPOSE_VALUES = values(OTP_PURPOSES);

export const NOTIFICATION_TYPES = {
  ROOM_INVITE: 'room_invite',
  ROOM_JOINED: 'room_joined',
  ROOM_EXPENSE_ADDED: 'room_expense_added',
  ROOM_EXPENSE_UPDATED: 'room_expense_updated',
  ROOM_EXPENSE_DELETED: 'room_expense_deleted',
  SETTLEMENT_RECORDED: 'settlement_recorded',
  SETTLEMENT_CONFIRMED: 'settlement_confirmed',
  BUDGET_THRESHOLD: 'budget_threshold',
  RECURRING_CREATED: 'recurring_created',
  MEMBER_REMOVED: 'member_removed',
  ROOM_DELETED: 'room_deleted',
  BROADCAST: 'broadcast',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
export const NOTIFICATION_TYPE_VALUES = values(NOTIFICATION_TYPES);

export const ACTOR_TYPES = { USER: 'user', ADMIN: 'admin', SYSTEM: 'system' } as const;
export type ActorType = (typeof ACTOR_TYPES)[keyof typeof ACTOR_TYPES];
export const ACTOR_TYPE_VALUES = values(ACTOR_TYPES);

export const APP_EVENT_NAMES = {
  APP_OPEN: 'app_open',
  APP_BACKGROUND: 'app_background',
  SCREEN_VIEW: 'screen_view',
  FEATURE_USED: 'feature_used',
} as const;
