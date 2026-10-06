import { z } from 'zod';
import { PLATFORM_VALUES } from '../constants/enums';
import { currencySchema, phoneSchema, upiIdSchema } from './common';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/, 'Use 3-24 letters, numbers, dots or underscores');

export const notificationPrefsSchema = z.object({
  roomActivity: z.boolean().optional(),
  budgetAlerts: z.boolean().optional(),
  recurringReminders: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
});
export type NotificationPrefs = Required<z.infer<typeof notificationPrefsSchema>>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80).optional(),
  username: usernameSchema.optional(),
  email: z.string().trim().toLowerCase().email('Invalid email').optional().or(z.literal('')),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  defaultCurrency: currencySchema.optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  notificationPrefs: notificationPrefsSchema.optional(),
  /** Shown to room members so they can pay this user back. Empty clears it. */
  upiId: upiIdSchema.optional().or(z.literal('')),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const completeOnboardingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  defaultCurrency: currencySchema,
  timezone: z.string().trim().min(1).max(64),
  locale: z.string().trim().min(2).max(16).optional(),
});
export type CompleteOnboardingInput = z.input<typeof completeOnboardingSchema>;

export const registerPushTokenSchema = z.object({
  expoPushToken: z.string().trim().min(10),
  deviceId: z.string().trim().min(1).max(128),
  platform: z.enum(PLATFORM_VALUES),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const userSearchQuerySchema = z.object({
  q: z.union([phoneSchema, usernameSchema]),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Type DELETE to confirm' }) }),
});
