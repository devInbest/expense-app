import mongoose, { type InferSchemaType } from 'mongoose';
import { LIMITS, PLATFORM_VALUES } from '@expense/shared';

const appEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: String },
  name: { type: String, required: true },
  props: { type: mongoose.Schema.Types.Mixed },
  platform: { type: String, enum: PLATFORM_VALUES },
  appVersion: { type: String },
  at: { type: Date, required: true },
});

appEventSchema.index({ name: 1, at: -1 });
appEventSchema.index({ userId: 1, at: -1 });
appEventSchema.index({ at: 1 }, { expireAfterSeconds: LIMITS.APP_EVENT_TTL_DAYS * 24 * 3600 });

export type AppEventAttrs = InferSchemaType<typeof appEventSchema>;
export const AppEvent = mongoose.model('AppEvent', appEventSchema);
