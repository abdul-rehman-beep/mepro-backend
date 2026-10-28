import type { Request, Response } from 'express';
import * as userService from '../services/user.service';
import * as notificationService from '../services/notification.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { calculateBmi, bmiCategory, HEALTH_DISCLAIMER } from '../utils/health';
import { isoDate } from '../utils/date';
import { toObjectId } from '../services/workout.service';
import { Progress } from '../models/Progress';

export async function getProfile(req: Request, res: Response): Promise<Response> {
  const profile = await userService.getProfile(req.user!.id);
  return sendSuccess(res, profile, 'Profile');
}

export async function updateProfile(req: Request, res: Response): Promise<Response> {
  const profile = await userService.updateProfile(req.user!.id, req.body);
  return sendSuccess(res, profile, 'Profile updated');
}

export async function getOnboardingState(req: Request, res: Response): Promise<Response> {
  const state = await userService.getOnboardingState(req.user!.id);
  return sendSuccess(res, state, 'Onboarding state');
}

export async function completeOnboarding(req: Request, res: Response): Promise<Response> {
  const profile = await userService.completeOnboarding(req.user!.id, req.body);
  return sendSuccess(res, profile, 'Onboarding complete');
}

export async function changePassword(req: Request, res: Response): Promise<Response> {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await userService.changePassword(req.user!.id, currentPassword, newPassword);
  return sendSuccess(
    res,
    { changed: true },
    'Password changed. Please sign in again on your other devices.',
  );
}

export async function updateAvatar(req: Request, res: Response): Promise<Response> {
  const { avatarUrl } = req.body as { avatarUrl: string | null };
  const profile = await userService.updateAvatar(req.user!.id, avatarUrl);
  return sendSuccess(res, profile, 'Profile picture updated');
}

export async function getNotificationSettings(req: Request, res: Response): Promise<Response> {
  const profile = await userService.getProfile(req.user!.id);
  return sendSuccess(res, profile.notificationSettings, 'Notification settings');
}

export async function updateNotificationSettings(req: Request, res: Response): Promise<Response> {
  const settings = await userService.updateNotificationSettings(req.user!.id, req.body);
  return sendSuccess(res, settings, 'Notification settings updated');
}

export async function registerDeviceToken(req: Request, res: Response): Promise<Response> {
  const { token, platform } = req.body as { token: string; platform?: string };
  const tokens = await userService.registerDeviceToken(req.user!.id, token, platform);
  return sendSuccess(res, { registered: true, deviceCount: tokens.length }, 'Device registered');
}

export async function removeDeviceToken(req: Request, res: Response): Promise<Response> {
  const { token } = req.body as { token: string };
  const result = await userService.removeDeviceToken(req.user!.id, token);
  return sendSuccess(res, result, 'Device removed');
}

/**
 * BMI is computed from explicit inputs when supplied, otherwise from the
 * stored profile. The response always carries the disclaimer, and the category
 * is presented as a screening range rather than a diagnosis.
 */
export async function getBmi(req: Request, res: Response): Promise<Response> {
  const query = req.query as { weightKg?: number; heightCm?: number };
  const profile = await userService.getProfile(req.user!.id);

  const weightKg = query.weightKg ?? profile.weightKg;
  const heightCm = query.heightCm ?? profile.heightCm;

  if (!weightKg || !heightCm) {
    throw ApiError.badRequest('Add your height and weight to calculate BMI', [
      { field: !weightKg ? 'weightKg' : 'heightCm', message: 'Missing value' },
    ]);
  }

  const bmi = calculateBmi(weightKg, heightCm);

  return sendSuccess(
    res,
    {
      bmi,
      category: bmiCategory(bmi),
      weightKg,
      heightCm,
      healthyRange: { min: 18.5, max: 24.9 },
      healthyWeightRangeKg: {
        min: Math.round(18.5 * (heightCm / 100) ** 2),
        max: Math.round(24.9 * (heightCm / 100) ** 2),
      },
      isPersonalised: query.weightKg === undefined && query.heightCm === undefined,
      disclaimer: HEALTH_DISCLAIMER,
    },
    'BMI',
  );
}

export async function logWeight(req: Request, res: Response): Promise<Response> {
  const { weightKg, date } = req.body as { weightKg: number; date?: string };
  const day = date ?? isoDate(new Date());

  const profile = await userService.getProfile(req.user!.id);
  const bmi = profile.heightCm ? calculateBmi(weightKg, profile.heightCm) : null;

  await Progress.updateOne(
    { userId: toObjectId(req.user!.id), day },
    { $set: { weightKg, ...(bmi !== null ? { bmi } : {}) }, $setOnInsert: { userId: toObjectId(req.user!.id), day } },
    { upsert: true },
  );

  // Keep the profile weight in sync so targets and the dashboard stay current.
  const updated = await userService.updateProfile(req.user!.id, { weightKg });

  return sendSuccess(
    res,
    { day, weightKg, bmi, profileWeightKg: updated.weightKg, disclaimer: HEALTH_DISCLAIMER },
    'Weight logged',
  );
}

export async function deleteAccount(req: Request, res: Response): Promise<Response> {
  const summary = await userService.getAccountDataSummary(req.user!.id);
  await userService.deleteAccount(req.user!.id);
  return sendSuccess(res, { deleted: true, removedData: summary }, 'Account deleted');
}

export async function getAccountSummary(req: Request, res: Response): Promise<Response> {
  const summary = await userService.getAccountDataSummary(req.user!.id);
  return sendSuccess(res, summary, 'Account summary');
}

export async function seedReminders(req: Request, res: Response): Promise<Response> {
  const result = await notificationService.seedRemindersForUser(req.user!.id);
  return sendSuccess(res, result, 'Reminders scheduled');
}
