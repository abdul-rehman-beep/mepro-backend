import crypto from 'node:crypto';
import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './ApiError';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export interface DecodedToken<TPayload> {
  payload: TPayload;
  jti: string;
  expiresAt: number;
  issuedAt: number;
}

/**
 * `jsonwebtoken` accepts durations like "15m"/"30d"; these helpers keep the
 * arithmetic in one place so we can read expiry without trusting the client.
 */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) throw new Error(`Unsupported duration format: ${duration}`);
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

function sign(payload: Record<string, unknown>, secret: string, expiresIn: string) {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, options);
}

function decode<TPayload>(token: string, secret: string): DecodedToken<TPayload> {
  const verifyOptions: VerifyOptions = { algorithms: ['HS256'] };
  const decoded = jwt.verify(token, secret, verifyOptions) as jwt.JwtPayload & { sub: string };

  if (typeof decoded.exp !== 'number' || typeof decoded.iat !== 'number') {
    throw ApiError.unauthorized('Malformed token');
  }

  return {
    payload: decoded as unknown as TPayload,
    jti: typeof decoded.jti === 'string' ? decoded.jti : '',
    expiresAt: decoded.exp,
    issuedAt: decoded.iat,
  };
}

export function signAccessToken(userId: string, email: string): string {
  return sign({ sub: userId, email, type: 'access' }, env.JWT_ACCESS_SECRET, env.ACCESS_TOKEN_EXPIRES_IN);
}

export function signRefreshToken(userId: string, jti: string): string {
  return sign({ sub: userId, jti, type: 'refresh' }, env.JWT_REFRESH_SECRET, env.REFRESH_TOKEN_EXPIRES_IN);
}

export function verifyAccessToken(token: string): DecodedToken<AccessTokenPayload> {
  const result = decode<AccessTokenPayload>(token, env.JWT_ACCESS_SECRET);
  if (result.payload.type !== 'access') throw ApiError.unauthorized('Invalid token type');
  return result;
}

export function verifyRefreshToken(token: string): DecodedToken<RefreshTokenPayload> {
  const result = decode<RefreshTokenPayload>(token, env.JWT_REFRESH_SECRET);
  if (result.payload.type !== 'refresh') throw ApiError.unauthorized('Invalid token type');
  if (!result.jti) throw ApiError.unauthorized('Malformed refresh token');
  return result;
}

/**
 * Refresh tokens are stored as SHA-256 hashes so a database leak cannot be
 * replayed against the API. SHA-256 (not bcrypt) is correct here: the input is
 * already high-entropy random data, so we need speed for the lookup, not
 * password-style key stretching.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newTokenId(): string {
  return crypto.randomUUID();
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function accessTokenExpiresInSeconds(): number {
  return durationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN);
}
