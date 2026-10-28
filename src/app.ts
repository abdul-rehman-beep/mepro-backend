import path from 'node:path';
import fs from 'node:fs';
import express, { type Application, type Request, type Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import { env } from './config/env';
import { logger } from './utils/logger';
import { API_PREFIX, SERVER_VERSION } from './utils/response';
import { isDatabaseReady } from './config/database';
import { globalRateLimiter } from './middleware/rate-limit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import workoutRoutes from './routes/workout.routes';
import yogaRoutes from './routes/yoga.routes';
import nutritionRoutes from './routes/nutrition.routes';
import foodRoutes from './routes/food.routes';
import hydrationRoutes from './routes/hydration.routes';
import progressRoutes from './routes/progress.routes';
import goalRoutes from './routes/goal.routes';
import achievementRoutes from './routes/achievement.routes';
import aiRoutes from './routes/ai.routes';
import notificationRoutes from './routes/notification.routes';
import communityRoutes from './routes/community.routes';
import dashboardRoutes from './routes/dashboard.routes';

import { getModelStatus, isAiAvailable, AI_EMBEDDING_MODEL_ID, AI_MODEL_ID } from './services/ai/model.service';

export function createApp(): Application {
  const app = express();

  // Behind a reverse proxy in production; needed for correct req.ip / rate limits.
  if (env.isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const corsOptions: CorsOptions = {
    origin: env.CLIENT_URL.split(',').map((url) => url.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86_400,
  };

  app.use(
    helmet({
      // The API serves JSON and images, never HTML, so a strict CSP would only
      // get in the way. Cross-origin resource sharing stays enabled for images.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Lightweight request log. Kept out of the test suite to keep output readable.
  if (!env.isTest) {
    app.use((req: Request, _res: Response, next) => {
      const startedAt = Date.now();
      _res.on('finish', () => {
        logger.debug(`${req.method} ${req.originalUrl} ${_res.statusCode} ${Date.now() - startedAt}ms`);
      });
      next();
    });
  }

  /* ------------------------- Static uploads ------------------------- */
  // Served in development from the local filesystem. The URL shape is stable so
  // a later move to S3/Cloudinary only requires changing the base.
  if (fs.existsSync(env.uploadPath)) {
    app.use(
      '/uploads',
      express.static(env.uploadPath, {
        maxAge: '7d',
        index: false,
        dotfiles: 'deny',
        fallthrough: true,
      }),
    );
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
        version: SERVER_VERSION,
        environment: env.NODE_ENV,
        uptimeSeconds: Math.round(process.uptime()),
        database: isDatabaseReady() ? 'connected' : 'disconnected',
        ai: {
          available: isAiAvailable(),
          model: getModelStatus().modelId,
        },
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: `MEPro API v${SERVER_VERSION}`,
      data: {
        name: 'MEPro - Intelligent Fitness & Wellness API',
        version: SERVER_VERSION,
        documentation: `${API_PREFIX}/docs`,
        health: '/health',
        ai: { provider: 'transformers.js (local, Xenova models)', model: AI_MODEL_ID, embedding: AI_EMBEDDING_MODEL_ID },
      },
    });
  });

  /* ------------------------- API routes ------------------------- */
  // Baseline limiter for every API route. Route groups layer tighter limiters on
  // top (see `authRateLimiter` / `aiRateLimiter`). Mounted after the health and
  // root probes so uptime checks are never throttled.
  app.use(`${API_PREFIX}`, globalRateLimiter);

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
  app.use(`${API_PREFIX}/workouts`, workoutRoutes);
  app.use(`${API_PREFIX}/yoga`, yogaRoutes);
  app.use(`${API_PREFIX}/nutrition`, nutritionRoutes);
  app.use(`${API_PREFIX}/foods`, foodRoutes);
  app.use(`${API_PREFIX}/hydration`, hydrationRoutes);
  app.use(`${API_PREFIX}/progress`, progressRoutes);
  app.use(`${API_PREFIX}/goals`, goalRoutes);
  app.use(`${API_PREFIX}/achievements`, achievementRoutes);
  app.use(`${API_PREFIX}/ai`, aiRoutes);
  app.use(`${API_PREFIX}/notifications`, notificationRoutes);
  app.use(`${API_PREFIX}/community`, communityRoutes);

  // 404 then centralised error handling. Order matters.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const UPLOAD_ROOT = path.resolve(env.uploadPath);
export { mongoose };
