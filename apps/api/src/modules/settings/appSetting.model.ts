import mongoose, { type InferSchemaType } from 'mongoose';

// App-wide settings stored as a single document (key: "app").
const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'app' },
    themeColor: { type: String, trim: true },
    minAppVersion: { type: String, default: '1.0.0' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

export type AppSettingAttrs = InferSchemaType<typeof appSettingSchema>;
export const AppSetting = mongoose.model('AppSetting', appSettingSchema);
