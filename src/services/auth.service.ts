import crypto from 'node:crypto';
import type { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import {
  accessTokenExpiresInSeconds,
  hashToken,
  newTokenId,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { RefreshToken, REVOKE_REASONS } from '../models/RefreshToken';
import { User, USER_PROJECTION, type PublicUser } from '../models/User';
import { comparePassword } from '../models/User';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

/** Uniform errors prevent account enumeration via differing login messages. */
const GENERIC_CREDENTIALS_ERROR = 'Email or password is incorrect';

function requestMeta(req?: Request): { userAgent: string | null; ip: string | null } {
  return {
    userAgent: req?.get('user-agent')?.slice(0, 255) ?? null,
    ip: req?.ip ?? null,
  };
}

async function issueTokenPair(
  userId: string,
  email: string,
  familyId: string,
  req?: Request,
): Promise<{ tokens: AuthTokens; refreshTokenId: string }> {
  const jti = newTokenId();
  const refreshToken = signRefreshToken(userId, jti);
  const accessToken = signAccessToken(userId, email);

  await RefreshToken.create({
    userId,
    tokenHash: hashToken(refreshToken),
    jti,
    familyId,
    expiresAt: new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
    ...requestMeta(req),
  });

  return {
    refreshTokenId: jti,
    tokens: {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessTokenExpiresInSeconds(),
      tokenType: 'Bearer',
    },
  };
}

function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) throw new Error(`Unsupported duration: ${duration}`);
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
}

export async function registerUser(
  input: { name: string; email: string; password: string },
  req?: Request,
): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();

  const existing = await User.findOne({ email }).lean();
  if (existing) throw ApiError.conflict('An account with this email already exists', [{ field: 'email' }]);

  let user;
  try {
    user = await User.create({ name: input.name.trim(), email, password: input.password });
  } catch (error) {
    // Lost a race against a concurrent registration.
    if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
      throw ApiError.conflict('An account with this email already exists', [{ field: 'email' }]);
    }
    throw error;
  }

  const familyId = crypto.randomUUID();
  const { tokens } = await issueTokenPair(user.id, user.email, familyId, req);

  user.lastLoginAt = new Date();
  user.lastActiveDate = new Date();
  await user.save();

  return { user: user.toJSON() as PublicUser, tokens };
}

export async function loginUser(
  input: { email: string; password: string },
  req?: Request,
): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();

  // `password` is `select: false`, so request it explicitly.
  const user = await User.findOne({ email }).select('+password');

  // Always run a bcrypt comparison, even when the user is missing, so response
  // timing does not reveal whether an email is registered.
  const hash = user?.password ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordMatches = await comparePassword(input.password, hash).catch(() => false);

  if (!user || !passwordMatches) throw ApiError.unauthorized(GENERIC_CREDENTIALS_ERROR);
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const familyId = crypto.randomUUID();
  const { tokens } = await issueTokenPair(user.id, user.email, familyId, req);

  user.lastLoginAt = new Date();
  user.lastActiveDate = user.lastActiveDate ?? new Date();
  await user.save();

  return { user: user.toJSON() as PublicUser, tokens };
}

export interface RefreshResult {
  user: PublicUser;
  tokens: AuthTokens;
}

/**
 * Refresh-token rotation with reuse detection.
 *
 * Presenting an already-rotated token means the token was captured, so the whole
 * family is revoked and the user must log in again. This is the standard
 * OAuth-family defence and it is the reason `familyId` exists.
 */
export async function refreshSession(refreshToken: string, req?: Request): Promise<RefreshResult> {
  const { payload } = verifyRefreshToken(refreshToken);

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
  if (!stored) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (stored.revokedAt) {
    await RefreshToken.updateMany(
      { familyId: stored.familyId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: REVOKE_REASONS.REUSE_DETECTED } },
    );
    logger.warn('Refresh token reuse detected; revoked token family', {
      userId: stored.userId.toString(),
      familyId: stored.familyId,
    });
    throw ApiError.unauthorized('Refresh token has been revoked. Please sign in again');
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    await RefreshToken.updateOne(
      { _id: stored._id },
      { $set: { revokedAt: new Date(), revokedReason: REVOKE_REASONS.LOGOUT } },
    );
    throw ApiError.unauthorized('Refresh token has expired. Please sign in again');
  }

  if (stored.userId.toString() !== payload.sub) {
    throw ApiError.unauthorized('Refresh token does not match the authenticated user');
  }

  const user = await User.findById(payload.sub, USER_PROJECTION);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const { tokens, refreshTokenId } = await issueTokenPair(user.id, user.email, stored.familyId, req);

  stored.revokedAt = new Date();
  stored.revokedReason = REVOKE_REASONS.ROTATED;
  stored.replacedByJti = refreshTokenId;
  await stored.save();

  return { user: user.toJSON() as PublicUser, tokens };
}

/**
 * Returns the user id encoded in a refresh token, or throws. Used by logout so
 * a client with a dead access token can still revoke its own session.
 */
export function resolveSessionOwner(refreshToken: string): string {
  const { payload } = verifyRefreshToken(refreshToken);
  if (!payload.sub) throw ApiError.unauthorized('Malformed refresh token');
  return payload.sub;
}

export async function logoutSession(refreshToken: string | undefined, userId: string): Promise<void> {
  if (refreshToken) {
    await RefreshToken.updateMany(
      { userId, tokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: REVOKE_REASONS.LOGOUT } },
    );
    return;
  }
  // No token supplied: revoke every active session for the account.
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: REVOKE_REASONS.LOGOUT } },
  );
}

export async function revokeAllSessions(userId: string, reason: string): Promise<void> {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId, USER_PROJECTION).lean();
  if (!user) throw ApiError.notFound('User not found');
  return user as unknown as PublicUser;
}
