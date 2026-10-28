import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { MulterError } from 'multer';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { API_PREFIX } from '../utils/response';

interface MongoServerError extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message?: string }>;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
    code: 'NOT_FOUND',
    errors: [],
  });
}

/** Maps known driver/library errors onto meaningful HTTP statuses. */
function normalise(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((issue) => ({ field: issue.path, message: issue.message }));
    return ApiError.unprocessable('Validation failed', details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${error.path}"`, [{ field: error.path, message: 'Malformed id' }]);
  }

  if (error instanceof MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large'
        : error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file field'
          : `Upload failed: ${error.message}`;
    return ApiError.badRequest(message);
  }

  if (error instanceof Error && 'code' in error) {
    const mongoError = error as MongoServerError;

    // 11000 = duplicate key, 11001 = duplicate with different case sensitivity
    if (mongoError.code === 11000 || mongoError.code === 11001) {
      const field = Object.keys(mongoError.keyPattern ?? {})[0] ?? 'field';
      return ApiError.conflict(`A record with this ${field} already exists`, [{ field }]);
    }

    if (mongoError.name === 'MongoServerSelectionError' || mongoError.name === 'MongoNetworkError') {
      return ApiError.serviceUnavailable('Database is temporarily unavailable');
    }
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('Malformed JSON body');
  }

  return ApiError.internal();
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Once headers are flushed we can only delegate to Express's default handler.
  if (res.headersSent) return next(error);

  const apiError = normalise(error);

  if (apiError.statusCode >= 500) {
    logger.error('Unhandled request error', {
      message: apiError.message,
      path: _req.originalUrl,
      method: _req.method,
      error,
    });
  } else {
    logger.debug('Request rejected', {
      status: apiError.statusCode,
      message: apiError.message,
      path: _req.originalUrl,
    });
  }

  // Never leak stack traces in production.
  const body: { success: false; message: string; code: string; errors: unknown[]; stack?: string } = {
    success: false,
    message: apiError.message,
    code: apiError.code,
    errors: apiError.errors,
  };

  if (!env.isProduction && error instanceof Error && apiError.statusCode >= 500) {
    body.stack = error.stack;
  }

  res.status(apiError.statusCode).json(body);
}

export const API_PREFIX_PATH = API_PREFIX;
