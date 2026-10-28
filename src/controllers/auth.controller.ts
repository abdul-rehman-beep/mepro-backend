import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';
import { sendCreated, sendSuccess } from '../utils/response';
import type { RegisterInput, LoginInput } from '../types/api.types';

/** Reads the refresh token from the body or the httpOnly cookie. */
function readRefreshToken(req: Request): string | undefined {
  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  if (fromBody) return fromBody;
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.refreshToken;
}

export async function register(req: Request, res: Response): Promise<Response> {
  const result = await authService.registerUser(req.body as RegisterInput, req);
  return sendCreated(res, result, 'Account created successfully');
}

export async function login(req: Request, res: Response): Promise<Response> {
  const result = await authService.loginUser(req.body as LoginInput, req);
  return sendSuccess(res, result, 'Signed in successfully');
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  const token = readRefreshToken(req);
  const result = await authService.refreshSession(token ?? '', req);
  return sendSuccess(res, result, 'Session refreshed');
}

export async function logout(req: Request, res: Response): Promise<Response> {
  // Logout is mounted behind `optionalAuth`, not `requireAuth`, so a client
  // whose access token already expired can still clear its session. When there
  // is no valid access token we fall back to the subject of the refresh token.
  const token = readRefreshToken(req);
  let userId = req.user?.id;

  if (!userId && token) {
    try {
      userId = authService.resolveSessionOwner(token);
    } catch {
      // An unparseable refresh token is not an error here: there is nothing
      // left to revoke, and the client still wants its cookie cleared.
      userId = undefined;
    }
  }

  if (userId) {
    await authService.logoutSession(token, userId);
  }

  res.clearCookie('refreshToken', { path: '/' });
  return sendSuccess(res, { loggedOut: true }, 'Signed out successfully');
}

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getCurrentUser(req.user!.id);
  return sendSuccess(res, user, 'Current user');
}

export async function changePassword(req: Request, res: Response): Promise<Response> {
  await userService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  // Rotating the session family signs out every other device, which is the
  // expected behaviour after a credential change.
  await authService.revokeAllSessions(req.user!.id, 'password_changed');
  res.clearCookie('refreshToken', { path: '/' });
  return sendSuccess(res, { changed: true }, 'Password updated. Please sign in again.');
}
