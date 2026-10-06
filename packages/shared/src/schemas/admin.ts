import { z } from 'zod';
import { ACTOR_TYPE_VALUES, PLATFORM_VALUES, ROOM_TYPE_VALUES, USER_STATUS_VALUES } from '../constants/enums';
import { LIMITS } from '../constants/limits';
import { dateSchema, objectIdSchema, pageQuerySchema } from './common';

export const adminUsersQuerySchema = pageQuerySchema.extend({
  status: z.enum(USER_STATUS_VALUES).optional(),
  sort: z.enum(['createdAt', 'lastActiveAt', 'name']).default('createdAt'),
});
export type AdminUsersQuery = z.input<typeof adminUsersQuerySchema>;

export const adminRoomsQuerySchema = pageQuerySchema.extend({
  type: z.enum(ROOM_TYPE_VALUES).optional(),
  archived: z.enum(['true', 'false']).optional(),
});
export type AdminRoomsQuery = z.input<typeof adminRoomsQuerySchema>;

export const adminActivityQuerySchema = pageQuerySchema.extend({
  actorType: z.enum(ACTOR_TYPE_VALUES).optional(),
  actorId: objectIdSchema.optional(),
  action: z.string().trim().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type AdminActivityQuery = z.input<typeof adminActivityQuerySchema>;

export const adminEventsQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  name: z.string().trim().optional(),
  userId: objectIdSchema.optional(),
});
export type AdminEventsQuery = z.input<typeof adminEventsQuerySchema>;

export const blockUserSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason').max(300),
});

export const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240),
  segment: z.enum(['all', 'active_7d', 'inactive_30d', 'platform']).default('all'),
  platform: z.enum(PLATFORM_VALUES).optional(),
});
export type BroadcastInput = z.input<typeof broadcastSchema>;

export const appSettingsSchema = z.object({
  themeColor: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Theme key must be a lowercase slug')
    .optional(),
  minAppVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, 'Use a version like 1.2.0')
    .optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(240).optional(),
});
export type AppSettingsInput = z.input<typeof appSettingsSchema>;

export const appEventSchema = z.object({
  name: z.string().trim().min(1).max(64),
  sessionId: z.string().trim().min(1).max(64),
  at: dateSchema,
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const trackEventsSchema = z.object({
  platform: z.enum(PLATFORM_VALUES),
  appVersion: z.string().trim().max(32).optional(),
  events: z.array(appEventSchema).min(1).max(LIMITS.MAX_EVENTS_BATCH),
});
export type TrackEventsInput = z.input<typeof trackEventsSchema>;
