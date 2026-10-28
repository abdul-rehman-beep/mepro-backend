import fs from 'node:fs';
import os from 'node:os';
import mongoose from 'mongoose';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import { warmupModels } from './services/ai/model.service';
import { processScheduledNotifications } from './services/notification.service';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const SCHEDULED_NOTIFICATION_INTERVAL_MS = 60_000;

/** Resolve the LAN IP so the printed hint matches what a phone needs. */
function lanAddress(): string {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return 'localhost';
}

async function start(): Promise<void> {
  try {
    fs.mkdirSync(env.uploadPath, { recursive: true });
  } catch (error) {
    logger.warn('Could not create upload directory', { path: env.uploadPath, error });
  }

  await connectDatabase();

  // Surface post-connect failures instead of letting them be swallowed.
  mongoose.connection.on('error', (error: unknown) => {
    logger.error('MongoDB connection error', { error });
  });

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`MEPro API listening on http://localhost:${env.PORT}`, {
      env: env.NODE_ENV,
      apiPrefix: '/api',
      lan: `http://${lanAddress()}:${env.PORT}`,
    });
  });

  server.on('error', (error) => {
    logger.error('HTTP server error', { error });
    process.exit(1);
  });

  // Model download + initialisation happens in the background. The server is
  // already accepting requests, so a slow or failed download never blocks boot.
  if (env.AI_ENABLED) {
    logger.info('Warming up AI models in the background');
    warmupModels();
  }

  const scheduler = setInterval(() => {
    processScheduledNotifications().catch((error) => {
      logger.warn('Scheduled notification run failed', { error });
    });
  }, SCHEDULED_NOTIFICATION_INTERVAL_MS);
  scheduler.unref();

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    clearInterval(scheduler);

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async () => {
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    void shutdown('uncaughtException');
  });
}

start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
