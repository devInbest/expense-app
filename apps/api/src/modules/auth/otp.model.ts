import mongoose, { type InferSchemaType } from 'mongoose';
import { OTP_PURPOSE_VALUES } from '@expense/shared';

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    purpose: { type: String, enum: OTP_PURPOSE_VALUES, default: 'login' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    ip: { type: String },
    consumedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ phone: 1, purpose: 1, createdAt: -1 });
// Kept for an hour past expiry so hourly send limits can be counted.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export type OtpAttrs = InferSchemaType<typeof otpSchema>;
export const OtpRequest = mongoose.model('OtpRequest', otpSchema);
