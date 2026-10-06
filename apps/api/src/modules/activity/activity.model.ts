import mongoose, { type InferSchemaType } from 'mongoose';
import { ACTOR_TYPE_VALUES, LIMITS } from '@expense/shared';

const activitySchema = new mongoose.Schema(
  {
    actorType: { type: String, enum: ACTOR_TYPE_VALUES, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    action: { type: String, required: true },
    entity: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    /** For user-facing history (e.g. a room's audit trail). */
    roomId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ actorType: 1, actorId: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ roomId: 1, createdAt: -1 });
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: LIMITS.ACTIVITY_LOG_TTL_DAYS * 24 * 3600 });

export type ActivityAttrs = InferSchemaType<typeof activitySchema>;
export const ActivityLog = mongoose.model('ActivityLog', activitySchema);
