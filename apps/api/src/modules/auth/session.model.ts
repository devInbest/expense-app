import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PLATFORM_VALUES } from '@expense/shared';

/** One login on one device. Holds the hash of the current refresh token (rotated on every use). */
const sessionSchema = new mongoose.Schema(
  {
    subjectType: { type: String, enum: ['user', 'admin'], required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    refreshTokenHash: { type: String, required: true },
    previousTokenHash: { type: String },
    rotatedAt: { type: Date },
    deviceId: { type: String, default: 'unknown' },
    deviceName: { type: String },
    platform: { type: String, enum: PLATFORM_VALUES, default: 'web' },
    appVersion: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
  },
  { timestamps: true },
);

sessionSchema.index({ subjectType: 1, subjectId: 1, revokedAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionAttrs = InferSchemaType<typeof sessionSchema>;
export type SessionDoc = HydratedDocument<SessionAttrs>;
export const Session = mongoose.model('Session', sessionSchema);
