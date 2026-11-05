import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmetModule from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { ensureReady } from './config/ready';
import routes from './routes';
import { errorHandler, notFoundHandler } from './core/errorHandler';
import { globalLimiter } from './core/rateLimits';
import { clientInfo } from './core/auth';
import { LOCAL_UPLOAD_DIR, localUploadsEnabled } from './lib/storage';
import localUploadRoutes from './modules/uploads/localUpload.routes';

type Helmet = (options?: {
  crossOriginResourcePolicy?: { policy?: 'same-origin' | 'same-site' | 'cross-origin' };
}) => RequestHandler;

// Vercel's compiler types this default import as the module namespace, which cannot be called.
// Both the ESM and CJS builds of helmet still export the middleware factory as the default.
const helmet: Helmet =
  typeof helmetModule === 'function' ? (helmetModule as Helmet) : (helmetModule as unknown as { default: Helmet }).default;

export const createApp = () => {
  const app = express();

  // Render and Vercel terminate TLS at a proxy; trust it so req.ip and rate limits see the client IP.
  app.set('trust proxy', 1);
  app.use(async (_req, _res, next) => {
    try {
      await ensureReady();
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.use(
    cors({
      // Native apps send no Origin header; browsers are limited to the admin portal.
      origin: (origin, cb) => cb(null, !origin || origin === env.adminUrl || (!env.isProduction && LOCAL_ORIGIN.test(origin))),
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(clientInfo);
  app.use('/api', globalLimiter);
  if (localUploadsEnabled()) {
    app.use('/api/v1/uploads/local', localUploadRoutes);
    app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { fallthrough: false, maxAge: '7d' }));
  }
  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

// Vercel detects src/app.ts as the Express entry and serves this default export.
const app = createApp();
export default app;
