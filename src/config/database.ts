import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connectionPromise) return connectionPromise;

  mongoose.set('strictQuery', true);

  connectionPromise = mongoose
    .connect(uri, {
      // Fail fast instead of buffering operations for 30s when Mongo is unreachable.
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 20,
      minPoolSize: 2,
      autoIndex: !env.isProduction,
    })
    .then((instance) => {
      logger.info('MongoDB connected', { database: instance.connection.name });
      return instance;
    })
    .catch((error: unknown) => {
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}

/** True when the connection is usable right now (used by /health). */
export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
