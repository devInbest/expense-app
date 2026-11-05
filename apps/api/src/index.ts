import app from './app';
import { env } from './config/env';
import { disconnectDatabase } from './config/database';
import { ensureReady } from './config/ready';

const start = async () => {
  try {
    await ensureReady();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`Expense API running on port ${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start();
