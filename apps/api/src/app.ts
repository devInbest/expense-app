import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './core/errorHandler';
import { globalLimiter } from './core/rateLimits';
import { clientInfo } from './core/auth';
import { LOCAL_UPLOAD_DIR, localUploadsEnabled } from './lib/storage';
import localUploadRoutes from './modules/uploads/localUpload.routes';

export const createApp = () => {
  const app = express();

  // Render (and most PaaS) terminate TLS at a proxy; trust it so req.ip and rate limits see the client IP.
  app.set('trust proxy', 1);
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
