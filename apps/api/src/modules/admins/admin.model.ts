import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ADMIN_ROLE_VALUES, type AdminDTO, type AdminRole } from '@expense/shared';

export interface AdminAttrs {
  name: string;
  userName: string;
  password: string;
  role: AdminRole;
  isActive: boolean;
  lastLogin?: Date;
  passwordChangedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AdminMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type AdminModel = Model<AdminAttrs, object, AdminMethods>;

const adminSchema = new mongoose.Schema<AdminAttrs, AdminModel, AdminMethods>(
  {
    name: { type: String, required: true, trim: true },
    userName: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLE_VALUES, default: 'support' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

adminSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

adminSchema.method('comparePassword', function comparePassword(this: AdminAttrs, candidate: string) {
  return bcrypt.compare(candidate, this.password);
});

export type AdminDoc = HydratedDocument<AdminAttrs, AdminMethods>;
export const Admin = mongoose.model<AdminAttrs, AdminModel>('Admin', adminSchema);

export const toAdminDTO = (a: AdminAttrs & { _id: unknown }): AdminDTO => ({
  _id: String(a._id),
  name: a.name,
  userName: a.userName,
  role: a.role,
  isActive: a.isActive,
  lastLogin: a.lastLogin ? new Date(a.lastLogin).toISOString() : undefined,
  createdAt: new Date(a.createdAt ?? Date.now()).toISOString(),
});
