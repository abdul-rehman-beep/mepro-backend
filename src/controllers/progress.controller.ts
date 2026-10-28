import type { Request, Response } from 'express';
import * as progressService from '../services/progress.service';
import * as workoutService from '../services/workout.service';
import * as nutritionService from '../services/nutrition.service';
import * as achievementService from '../services/achievement.service';
import { sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import { isoDate } from '../utils/date';

export async function getOverview(req: Request, res: Response): Promise<Response> {
  const { days } = getValidatedQuery<{ days: number }>(req);
  const [series, weight, streak, workoutStats] = await Promise.all([
    progressService.getDailySeries(req.user!.id, days),
    progressService.getWeightHistory(req.user!.id, 90),
    progressService.getStreak(req.user!.id),
    workoutService.getWorkoutStats(req.user!.id),
  ]);

  return sendSuccess(
    res,
    {
      range: { days, from: series[0]?.day ?? null, to: series.at(-1)?.day ?? null },
      series,
      weightHistory: weight,
      streak,
      workoutStats,
    },
    'Progress',
  );
}

export async function getDaily(req: Request, res: Response): Promise<Response> {
  const series = await progressService.getDailySeries(req.user!.id, 1);
  return sendSuccess(res, series[0] ?? null, 'Today progress');
}

export async function getWeekly(req: Request, res: Response): Promise<Response> {
  const { weeks } = getValidatedQuery<{ weeks: number }>(req);
  const summaries = await progressService.getWeeklyProgress(req.user!.id, weeks);
  return sendSuccess(res, summaries, 'Weekly progress');
}

export async function getMonthly(req: Request, res: Response): Promise<Response> {
  const { months } = getValidatedQuery<{ months: number }>(req);
  const summaries = await progressService.getMonthlyProgress(req.user!.id, months);
  return sendSuccess(res, summaries, 'Monthly progress');
}

export async function getStreak(req: Request, res: Response): Promise<Response> {
  const streak = await progressService.getStreak(req.user!.id);
  return sendSuccess(res, streak, 'Streak');
}

/** Resyncs the denormalised counters on the user document. */
export async function sync(req: Request, res: Response): Promise<Response> {
  const streak = await progressService.syncStreak(req.user!.id);
  const achievements = await achievementService.evaluateAchievements(req.user!.id);
  return sendSuccess(res, { streak, newAchievements: achievements }, 'Progress synced');
}

export async function getSummary(req: Request, res: Response): Promise<Response> {
  const [streak, achievementSummary, nutritionHistory, hydrationHistory] = await Promise.all([
    progressService.getStreak(req.user!.id),
    achievementService.getAchievementSummary(req.user!.id),
    nutritionService.getNutritionHistory(req.user!.id, { startDate: isoDate(new Date(Date.now() - 29 * 86_400_000)) }),
    nutritionService.getHydrationHistory(req.user!.id, 7),
  ]);

  return sendSuccess(
    res,
    { streak, achievements: achievementSummary, nutritionHistory, hydrationHistory },
    'Progress summary',
  );
}
