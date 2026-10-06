import { z } from 'zod';
import { ADMIN_ROLE_VALUES, OTP_PURPOSE_VALUES, PLATFORM_VALUES } from '../constants/enums';
import { LIMITS } from '../constants/limits';
import { phoneSchema } from './common';

export const deviceInfoSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  platform: z.enum(PLATFORM_VALUES),
  appVersion: z.string().trim().max(32).optional(),
  deviceName: z.string().trim().max(128).optional(),
});
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(OTP_PURPOSE_VALUES).default('login'),
});
export type OtpRequestInput = z.input<typeof otpRequestSchema>;

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${LIMITS.OTP_LENGTH}}$`), `Enter the ${LIMITS.OTP_LENGTH}-digit code`);

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  device: deviceInfoSchema.optional(),
});
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;

export const googleAuthSchema = z.object({
  idToken: z.string().min(10),
  device: deviceInfoSchema.optional(),
});
export type GoogleAuthInput = z.input<typeof googleAuthSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const linkPhoneVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const linkGoogleSchema = z.object({ idToken: z.string().min(10) });

export const adminLoginSchema = z.object({
  userName: z.string().trim().min(1, 'User name is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const createAdminSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  userName: z.string().trim().min(3, 'User name is required').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ADMIN_ROLE_VALUES).default('support'),
});
export type CreateAdminInput = z.input<typeof createAdminSchema>;

export const updateAdminSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(ADMIN_ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
});
