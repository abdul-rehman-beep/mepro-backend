import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Fails fast at boot when a secret is missing rather than at the first request.
 * In production we refuse to boot on placeholder secrets.
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : ['1', 'true', 'yes'].includes(value.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),

  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

  CLIENT_URL: z.string().default('http://localhost:8081'),
  UPLOAD_DIR: z.string().default('uploads'),

  /** Primary text/intent model used by the assistant. */
  AI_MODEL: z.string().default('Xenova/nli-deberta-v3-xsmall'),
  /** Compact sentence-transformer used for semantic similarity + retrieval. */
  AI_EMBEDDING_MODEL: z.string().default('Xenova/all-MiniLM-L6-v2'),
  /** Optional instruction-tuned generator. Disabled unless explicitly enabled. */
  AI_GENERATION_MODEL: z.string().default(''),
  AI_ENABLED: booleanish.default(true),
  AI_GENERATION_ENABLED: booleanish.default(false),
  /** Hard ceiling for a single inference call before we fall back to rules. */
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  /** Where the onnxruntime cache is written; keeps the app dir clean. */
  AI_CACHE_DIR: z.string().default('.cache/models'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;

const PLACEHOLDER = /change[-_ ]?me|your[-_ ]?secret|placeholder|changethis/i;

if (raw.NODE_ENV === 'production') {
  if (PLACEHOLDER.test(raw.JWT_ACCESS_SECRET) || raw.JWT_ACCESS_SECRET === raw.JWT_REFRESH_SECRET) {
    throw new Error('Refusing to start in production with placeholder or identical JWT secrets.');
  }
}

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  isDevelopment: raw.NODE_ENV === 'development',
  /** Absolute path so uploads resolve the same regardless of process cwd. */
  uploadPath: path.isAbsolute(raw.UPLOAD_DIR)
    ? raw.UPLOAD_DIR
    : path.resolve(process.cwd(), raw.UPLOAD_DIR),
  aiCachePath: path.isAbsolute(raw.AI_CACHE_DIR)
    ? raw.AI_CACHE_DIR
    : path.resolve(process.cwd(), raw.AI_CACHE_DIR),
} as const;

export type Env = typeof env;
