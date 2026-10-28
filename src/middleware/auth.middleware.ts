import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import { User, USER_PROJECTION } from '../models/User';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      requestId?: string;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

/**
 * Verifies the access token and loads the user.
 *
 * The user id is *always* taken from the validated token — never from a body,
 * query or header value the client controls.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) throw ApiError.unauthorized('Authentication token is missing');

    const { payload } = verifyAccessToken(token);
    const userId = payload.sub;
    if (!userId) throw ApiError.unauthorized('Malformed token');

    const user = await User.findById(userId, USER_PROJECTION).lean();
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

    req.user = { id: user._id.toString(), email: user.email };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Access token expired'));
    }
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/** Populates req.user when a valid token exists, but never rejects. Used by optional routes. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) return next();
  try {
    const { payload } = verifyAccessToken(token);
    if (payload.sub) {
      const user = await User.findById(payload.sub, USER_PROJECTION).lean();
      if (user?.isActive) req.user = { id: user._id.toString(), email: user.email };
    }
  } catch {
    // An invalid token on an optional route is simply treated as anonymous.
  }
  return next();
}
