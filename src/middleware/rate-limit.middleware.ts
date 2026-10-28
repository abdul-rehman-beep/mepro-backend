import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter kept in process memory.
 *
 * Deliberately simple: the spec targets a single-instance academic deployment.
 * `src/utils/redisStore.ts` documents the swap point if this is ever scaled out.
 */
export function createRateLimiter(options: { windowMs: number; max: number; message?: string }): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, message = 'Too many requests, please slow down' } = options;

  // Periodic sweep so the map cannot grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);
  sweeper.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    // Test env keeps limiter behaviour but never blocks, so suites stay fast.
    if (env.isTest) return next();

    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      return next();
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(ApiError.tooMany(message, [{ retryAfterSeconds: retryAfter }]));
    }

    return next();
  };
}

export const globalRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
});

/** Tight limiter for credential endpoints to blunt brute-force attempts. */
export const authRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts. Please try again later',
});

/** AI endpoints are CPU-bound, so they get their own budget. */
export const aiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX,
  message: 'AI request limit reached. Please try again shortly',
});
