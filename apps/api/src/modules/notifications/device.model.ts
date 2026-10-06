import mongoose, { type InferSchemaType } from 'mongoose';
import { PLATFORM_VALUES } from '@expense/shared';

const deviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    expoPushToken: { type: String, required: true },
    platform: { type: String, enum: PLATFORM_VALUES, required: true },
    enabled: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ expoPushToken: 1 });

export type DeviceAttrs = InferSchemaType<typeof deviceSchema>;
export const Device = mongoose.model('Device', deviceSchema);
