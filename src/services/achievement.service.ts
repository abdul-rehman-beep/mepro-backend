import mongoose from 'mongoose';
import { Achievement, UserAchievement, type AchievementTrigger } from '../models/Achievement';
import { WorkoutSession } from '../models/WorkoutSession';
import { FoodLog } from '../models/FoodLog';
import { WaterLog } from '../models/WaterLog';
import { Goal } from '../models/Goal';
import { Progress } from '../models/Progress';
import { User } from '../models/User';
import { Meal } from '../models/Meal';
import { isoDate } from '../utils/date';
import { getStreak } from './progress.service';
import { createNotification } from './notification.service';

export interface EarnedAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  points: number;
  earnedAt: Date;
}

export interface AchievementWithStatus {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  points: number;
  category: string;
  threshold: number;
  progress: number;
  progressPercent: number;
  earned: boolean;
  earnedAt: Date | null;
}

/** Counters each trigger is measured against. Computed lazily and only for the
 *  triggers present in the catalogue. */
async function computeUserCounters(
  userId: string,
  userIdObject: mongoose.Types.ObjectId,
  triggers: AchievementTrigger[],
): Promise<Record<string, number>> {
  const needs = {
    workouts: triggers.includes('workout_count'),
    yoga: triggers.includes('yoga_count'),
    water: triggers.includes('water_total'),
    food: triggers.includes('food_log_count'),
    meals: triggers.includes('first_meal_plan'),
    goals: triggers.includes('goal_completed'),
    weights: triggers.includes('weight_logged'),
    sessions: triggers.includes('first_workout') || triggers.includes('first_yoga'),
  };

  const [workouts, yoga, water, food, meals, goals, weights, sessions, streak] = await Promise.all([
    needs.workouts
      ? WorkoutSession.countDocuments({ userId, status: 'completed', category: { $ne: 'yoga' } })
      : Promise.resolve(0),
    needs.yoga
      ? WorkoutSession.countDocuments({ userId, status: 'completed', category: 'yoga' })
      : Promise.resolve(0),
    needs.water ? WaterLog.aggregate<{ total: number }>([
        { $match: { userId: userIdObject } },
        { $group: { _id: null, total: { $sum: '$amountMl' } } },
      ]).then((rows) => Math.round(rows[0]?.total ?? 0))
      : Promise.resolve(0),
    needs.food ? FoodLog.countDocuments({ userId }) : Promise.resolve(0),
    needs.meals ? Meal.countDocuments({ userId }) : Promise.resolve(0),
    needs.goals ? Goal.countDocuments({ userId, status: 'completed' }) : Promise.resolve(0),
    needs.weights ? Progress.countDocuments({ userId, weightKg: { $ne: null } }) : Promise.resolve(0),
    needs.sessions
      ? WorkoutSession.countDocuments({ userId, status: 'completed' })
      : Promise.resolve(0),
    triggers.includes('streak_days') ? getStreak(userId).then((info) => info.longest) : Promise.resolve(0),
  ]);

  return { workout_count: workouts, yoga_count: yoga, water_total: water, food_log_count: food, first_meal_plan: meals, goal_completed: goals, weight_logged: weights, first_workout: sessions > 0 ? 1 : 0, first_yoga: yoga > 0 ? 1 : 0, streak_days: streak };
}

/**
 * Evaluates the achievement catalogue against the user's current counters and
 * awards anything newly earned.
 *
 * Safe to call on every relevant write: awarding is idempotent thanks to the
 * unique (userId, key) index, so a concurrent double-call cannot duplicate.
 */
export async function evaluateAchievements(userId: string): Promise<EarnedAchievement[]> {
  const userIdObject = new mongoose.Types.ObjectId(String(userId));
  const user = await User.findById(userId).select('achievementPoints onboardingCompleted').lean();
  if (!user) return [];

  const catalogue = await Achievement.find({ isActive: true }).lean();
  if (catalogue.length === 0) return [];

  const triggers = [...new Set(catalogue.map((item) => item.trigger as AchievementTrigger))];
  const counters = await computeUserCounters(userId, userIdObject, triggers);

  // `profile_complete` and `early_bird` need data outside the counter set.
  if (triggers.includes('profile_complete')) {
    const full = await User.findById(userId)
      .select('name age gender heightCm weightKg fitnessLevel goals dietPreference onboardingCompleted')
      .lean();
    counters.profile_complete =
      full?.onboardingCompleted && full.age && full.gender && full.heightCm && full.weightKg && full.fitnessLevel && full.dietPreference
        ? 1
        : 0;
  }

  if (triggers.includes('early_bird')) {
    // "Early bird" = a session that started between 05:00 and 11:00 on any day.
    // Counting the whole history (rather than just today) makes the badge
    // reachable and the threshold meaningful.
    const earlyStart = new Date(0);
    earlyStart.setUTCHours(5, 0, 0, 0);
    const lateStart = new Date(0);
    lateStart.setUTCHours(11, 0, 0, 0);

    counters.early_bird = await WorkoutSession.countDocuments({
      userId,
      status: 'completed',
      startedAt: { $gte: earlyStart, $lt: lateStart },
    });
  }

  const earned = await UserAchievement.find({ userId }).select('key').lean();
  const earnedKeys = new Set(earned.map((item) => item.key));

  const newlyEarned: EarnedAchievement[] = [];

  for (const definition of catalogue) {
    if (earnedKeys.has(definition.key)) continue;

    const value = counters[definition.trigger as string] ?? 0;
    if (value < definition.threshold) continue;

    const record = {
      userId,
      achievementId: definition._id,
      key: definition.key,
      earnedAt: new Date(),
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      tier: definition.tier,
      points: definition.points,
    };

    try {
      await UserAchievement.create(record);
    } catch (error) {
      // Duplicate key means a concurrent request already awarded it.
      if ((error as { code?: number }).code === 11000) continue;
      throw error;
    }

    newlyEarned.push({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      tier: definition.tier,
      points: definition.points,
      earnedAt: record.earnedAt,
    });
  }

  if (newlyEarned.length > 0) {
    const totalPoints = newlyEarned.reduce((sum, item) => sum + item.points, 0);
    await User.updateOne({ _id: userId }, { $inc: { achievementPoints: totalPoints } });
    // Notification failures must never break the write path that triggered this.
    await Promise.allSettled(
      newlyEarned.map((item) =>
        createNotification({
          userId: String(userId),
          type: 'achievement',
          title: `Achievement unlocked: ${item.title}`,
          body: item.description,
          icon: item.icon,
          actionUrl: '/achievements',
          actionLabel: 'View',
          data: { achievementKey: item.key },
        }),
      ),
    );
  }

  return newlyEarned;
}

export async function listAchievements(
  userId: string,
  category?: string,
): Promise<{ earned: AchievementWithStatus[]; locked: AchievementWithStatus[]; totalPoints: number }> {
  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  const catalogue = await Achievement.find(filter).sort({ sortOrder: 1, threshold: 1 }).lean();
  const earned = await UserAchievement.find({ userId }).lean();

  const earnedByKey = new Map(earned.map((item) => [item.key, item]));

  const triggers = [...new Set(catalogue.map((item) => item.trigger as AchievementTrigger))];
  const counters = await computeUserCounters(userId, new mongoose.Types.ObjectId(String(userId)), triggers);

  const items: AchievementWithStatus[] = catalogue.map((definition) => {
    const earnedRecord = earnedByKey.get(definition.key);
    const value = counters[definition.trigger as string] ?? 0;
    const progress = Math.min(value, definition.threshold);
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      tier: definition.tier,
      points: definition.points,
      category: definition.category,
      threshold: definition.threshold,
      progress,
      progressPercent: Math.min(100, Math.round((progress / definition.threshold) * 100)),
      earned: Boolean(earnedRecord),
      earnedAt: earnedRecord?.earnedAt ?? null,
    };
  });

  const user = await User.findById(userId).select('achievementPoints').lean();

  return {
    earned: items.filter((item) => item.earned),
    locked: items.filter((item) => !item.earned),
    totalPoints: user?.achievementPoints ?? 0,
  };
}

export async function getAchievementSummary(userId: string): Promise<{
  totalPoints: number;
  earnedCount: number;
  totalCount: number;
  recent: EarnedAchievement[];
  nextUp: AchievementWithStatus | null;
}> {
  const { earned, locked, totalPoints } = await listAchievements(userId);
  const recent = earned
    .slice()
    .sort((a, b) => (b.earnedAt?.getTime() ?? 0) - (a.earnedAt?.getTime() ?? 0))
    .slice(0, 5)
    .map<EarnedAchievement>((item) => ({
      key: item.key,
      title: item.title,
      description: item.description,
      icon: item.icon,
      tier: item.tier,
      points: item.points,
      earnedAt: item.earnedAt ?? new Date(),
    }));

  // "Next up" is the locked badge the user is closest to unlocking.
  const nextUp = locked.length
    ? locked.slice().sort((a, b) => b.progressPercent - a.progressPercent)[0]
    : null;

  return { totalPoints, earnedCount: earned.length, totalCount: earned.length + locked.length, recent, nextUp };
}

export async function getAchievementStats(userId: string): Promise<{ byCategory: Record<string, { earned: number; total: number }> }> {
  const { earned, locked } = await listAchievements(userId);
  const byCategory: Record<string, { earned: number; total: number }> = {};

  for (const item of [...earned, ...locked]) {
    if (!byCategory[item.category]) byCategory[item.category] = { earned: 0, total: 0 };
    byCategory[item.category].total += 1;
  }
  for (const item of earned) {
    if (byCategory[item.category]) byCategory[item.category].earned += 1;
  }

  return { byCategory };
}

export function todayIso(): string {
  return isoDate(new Date());
}
