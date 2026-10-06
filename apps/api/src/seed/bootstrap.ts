import mongoose from 'mongoose';
import { DEFAULT_CATEGORIES } from '@expense/shared';
import { env } from '../config/env';
import { Admin } from '../modules/admins/admin.model';
import { Category } from '../modules/categories/category.model';

/** Creates the superadmin login when no superadmin exists yet. */
export const ensureSuperAdmin = async () => {
  if (await Admin.exists({ role: 'superadmin' })) return;
  await Admin.create({
    name: 'Super Admin',
    userName: env.superadmin.userName,
    password: env.superadmin.password,
    role: 'superadmin',
  });
  console.log(`Created superadmin: ${env.superadmin.userName}${env.isProduction ? '' : ` / ${env.superadmin.password}`}`);
};

/** Upserts the built-in categories by key; admin edits to name/icon/color are preserved. */
export const ensureSystemCategories = async () => {
  const ops = DEFAULT_CATEGORIES.map((c, index) => ({
    updateOne: {
      filter: { ownerType: 'system', key: c.key },
      update: {
        $setOnInsert: { name: c.name, icon: c.icon, color: c.color, type: c.type, ownerType: 'system' as const, key: c.key, sortOrder: index },
      },
      upsert: true,
    },
  }));
  const result = await Category.bulkWrite(ops);
  if (result.upsertedCount) console.log(`Seeded ${result.upsertedCount} system categories`);
};

/**
 * The previous starter kit kept staff in the `users` collection with a userName + password.
 * Those records are moved to `admins` once so the `users` collection only holds app customers.
 */
export const migrateLegacyStaffUsers = async () => {
  const users = mongoose.connection.collection('users');
  // A leftover unique index on userName would reject every customer after the first (missing = null).
  const indexes = await users.indexes().catch(() => []);
  for (const name of ['userName_1', 'role_1']) {
    if (indexes.some((i) => i.name === name)) await users.dropIndex(name);
  }
  const legacy = await users.find({ userName: { $exists: true }, password: { $exists: true } }).toArray();
  if (legacy.length === 0) return;
  for (const u of legacy) {
    const exists = await Admin.exists({ userName: u.userName });
    if (!exists) {
      await mongoose.connection.collection('admins').insertOne({
        name: u.name || u.userName,
        userName: u.userName,
        password: u.password,
        role: u.role === 'superadmin' ? 'superadmin' : 'support',
        isActive: u.isActive !== false,
        createdAt: u.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
    }
    await users.deleteOne({ _id: u._id });
  }
  console.log(`Moved ${legacy.length} legacy staff account(s) to admins`);
};

export const bootstrap = async () => {
  await migrateLegacyStaffUsers();
  await ensureSuperAdmin();
  await ensureSystemCategories();
};
