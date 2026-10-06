import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { bootstrap } from './seed/bootstrap';

const start = async () => {
  await connectDatabase();
  await bootstrap();
  const server = createApp().listen(env.port, '0.0.0.0', () => {
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
