import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { DEFAULT_CURRENCY, USER_STATUS_VALUES, type UserDTO } from '@expense/shared';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    username: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    phoneVerified: { type: Boolean, default: false },
    email: { type: String, trim: true, lowercase: true },
    googleId: { type: String },
    avatarUrl: { type: String },
    upiId: { type: String, trim: true },
    defaultCurrency: { type: String, default: DEFAULT_CURRENCY },
    timezone: { type: String, default: 'Asia/Kolkata' },
    locale: { type: String, default: 'en-IN' },
    status: { type: String, enum: USER_STATUS_VALUES, default: 'active', index: true },
    onboarded: { type: Boolean, default: false },
    blockedReason: { type: String },
    blockedAt: { type: Date },
    deletedAt: { type: Date },
    lastActiveAt: { type: Date, index: true },
    lastPlatform: { type: String },
    lastAppVersion: { type: String },
    notificationPrefs: {
      roomActivity: { type: Boolean, default: true },
      budgetAlerts: { type: Boolean, default: true },
      recurringReminders: { type: Boolean, default: true },
      productUpdates: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

// Partial indexes: identifiers are unique only when present (deleted users have them unset).
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;

export const User = mongoose.model('User', userSchema);

export const toUserDTO = (u: UserDoc | (UserAttrs & { _id: unknown })): UserDTO => ({
  _id: String(u._id),
  name: u.name ?? '',
  username: u.username ?? undefined,
  phone: u.phone ?? undefined,
  phoneVerified: Boolean(u.phoneVerified),
  email: u.email ?? undefined,
  hasGoogle: Boolean(u.googleId),
  avatarUrl: u.avatarUrl ?? undefined,
  defaultCurrency: u.defaultCurrency ?? DEFAULT_CURRENCY,
  timezone: u.timezone ?? 'Asia/Kolkata',
  locale: u.locale ?? 'en-IN',
  status: u.status as UserDTO['status'],
  onboarded: Boolean(u.onboarded),
  notificationPrefs: {
    roomActivity: u.notificationPrefs?.roomActivity ?? true,
    budgetAlerts: u.notificationPrefs?.budgetAlerts ?? true,
    recurringReminders: u.notificationPrefs?.recurringReminders ?? true,
    productUpdates: u.notificationPrefs?.productUpdates ?? true,
  },
  upiId: u.upiId ?? undefined,
  createdAt: new Date(u.createdAt as Date).toISOString(),
});
