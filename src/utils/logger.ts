/* eslint-disable no-console */
import { env } from '../config/env';

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[env.LOG_LEVEL];

/** Never log secrets, even by accident. */
const REDACT = /(password|token|secret|authorization|refreshToken|accessToken|apiKey)/i;

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: env.isProduction ? undefined : value.stack };
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACT.test(key) ? '[redacted]' : sanitize(val);
  }
  return output;
}

function emit(level: Level, message: string, meta?: unknown): void {
  if (LEVELS[level] > threshold) return;
  const line = { level, time: new Date().toISOString(), message, ...(meta ? { meta: sanitize(meta) } : {}) };
  const stream = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (env.isProduction) {
    stream(JSON.stringify(line));
  } else {
    const { time, ...rest } = line;
    stream(`${new Date(time).toISOString().slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${message}`, {
      ...(rest.meta ? { meta: rest.meta } : {}),
    });
  }
}

export const logger = {
  error: (message: string, meta?: unknown) => emit('error', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  debug: (message: string, meta?: unknown) => emit('debug', message, meta),
};
