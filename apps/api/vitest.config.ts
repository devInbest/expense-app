import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      SMS_PROVIDER: 'console',
      JWT_SECRET: 'test-secret',
      ADMIN_JWT_SECRET: 'test-admin-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      SUPERADMIN_USERNAME: 'superadmin',
      SUPERADMIN_PASSWORD: 'super123',
      // Keep a developer's real bucket in .env out of tests (dotenv won't override keys that are already set).
      STORAGE_BUCKET: '',
      STORAGE_ACCESS_KEY_ID: '',
      STORAGE_SECRET_ACCESS_KEY: '',
    },
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
