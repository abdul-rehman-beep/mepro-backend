import type { Request, Response } from 'express';
import { User } from '../models/User';
import { Goal } from '../models/Goal';
import { sendSuccess } from '../utils/response';
import * as progressService from '../services/progress.service';
import * as nutritionService from '../services/nutrition.service';
import * as workoutService from '../services/workout.service';
import * as achievementService from '../services/achievement.service';
import * as notificationService from '../services/notification.service';
import * as recommendationService from '../services/ai/recommendation.service';
import { syncAll as syncGoals } from './goal.controller';
import { HEALTH_DISCLAIMER } from '../utils/health';
import { getValidatedQuery } from '../middleware/validation.middleware';

/**
 * Single aggregated endpoint for the home screen.
 *
 * The spec is explicit that the dashboard should not fan out into six separate
 * requests. This handler runs its sub-queries in parallel and returns one
 * payload; the mobile client then holds it in TanStack Query with a staleTime so
 * returning to the dashboard costs nothing.
 */
export async function getDashboard(req: Request, res: Response): Promise<Response> {
  const userId = req.user!.id;
  const { includeAi = true } = getValidatedQuery<{ includeAi?: boolean }>(req);
  const today = progressService.todayKey();

  // Keep auto-sourced goals current before reporting them.
  await syncGoals(userId).catch(() => undefined);

  const [
    user,
    nutrition,
    hydration,
    activity,
    series,
    streak,
    goals,
    achievementSummary,
    notifications,
    activeSession,
    recommendations,
  ] = await Promise.all([
    User.findById(userId, 'name dailyCalorieTarget dailyWaterTargetMl bmi bmiCategory streak longestStreak totalWorkouts achievementPoints onboardingCompleted preferredWorkoutMinutes targets').lean(),
    nutritionService.getDailyNutrition(userId, today),
    nutritionService.getHydrationToday(userId, today),
    progressService.getActivityTotals(userId, today),
    progressService.getDailySeries(userId, 7),
    progressService.getStreak(userId),
    Goal.find({ userId, status: 'active' }).sort({ createdAt: -1 }).limit(5).lean(),
    achievementService.getAchievementSummary(userId),
    notificationService.listNotifications(userId, { limit: 1 }),
    workoutService.getActiveSession(userId),
    includeAi ? recommendationService.getRecommendations(userId) : Promise.resolve(null),
  ]);

  const greeting = getGreeting();
  const firstName = (user?.name ?? 'there').trim().split(/\s+/)[0];

  // Today's progress percentages, all clamped to 0-100 for the rings.
  const calorieTarget = user?.dailyCalorieTarget ?? 2000;
  const waterTarget = user?.dailyWaterTargetMl ?? 2000;
  const workoutTarget = user?.preferredWorkoutMinutes ?? 30;

  return sendSuccess(
    res,
    {
      greeting,
      userName: firstName,
      date: today,
      streak: {
        current: streak.current,
        longest: streak.longest,
        activeToday: streak.activeToday,
      },
      today: {
        calories: {
          target: calorieTarget,
          consumed: nutrition.consumed,
          burned: nutrition.burned,
          remaining: nutrition.remaining,
          percent: clampPercent((nutrition.consumed / Math.max(1, calorieTarget)) * 100),
        },
        water: {
          targetMl: waterTarget,
          totalMl: hydration.totalMl,
          percent: hydration.percent,
          remainingMl: hydration.remainingMl,
        },
        workout: {
          targetMinutes: workoutTarget,
          minutes: activity.workoutMinutes,
          sessions: activity.workoutCount + activity.yogaCount,
          caloriesBurned: activity.caloriesBurned,
          percent: clampPercent((activity.workoutMinutes / Math.max(1, workoutTarget)) * 100),
        },
        nutrition: {
          proteinG: nutrition.proteinG,
          carbsG: nutrition.carbsG,
          fatG: nutrition.fatG,
          fiberG: nutrition.fiberG,
          mealsLogged: nutrition.mealsLogged,
        },
        bmi: {
          value: user?.bmi ?? null,
          category: user?.bmiCategory ?? null,
        },
      },
      week: series,
      goals,
      achievementSummary,
      notifications: { unreadCount: notifications.unreadCount },
      activeSession,
      recommendation: recommendations?.primary ?? null,
      recommendationProvider: recommendations?.provider ?? 'rules',
      disclaimer: HEALTH_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    },
    'Dashboard',
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
