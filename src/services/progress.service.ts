import mongoose, { type QueryFilter } from 'mongoose';
import { Progress, type ProgressAttributes } from '../models/Progress';
import { WorkoutSession } from '../models/WorkoutSession';
import { FoodLog } from '../models/FoodLog';
import { WaterLog } from '../models/WaterLog';
import { User } from '../models/User';
import { dayRanges, differenceInDays, endOfDay, endOfMonth, endOfWeek, isoDate, startOfDay, startOfMonth, startOfWeek, addDays } from '../utils/date';
import type { LoggedNutrition } from '../models/FoodLog';

/**
 * The Progress collection is a per-user daily rollup. Rather than recomputing
 * from scratch on every read, each write path declares which counters it
 * affects and this module re-derives just that day.
 */

export interface DayCounters {
  caloriesConsumed?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  waterMl?: number;
  workoutMinutes?: number;
  workoutCount?: number;
  yogaCount?: number;
  mealsLogged?: number;
  foodLogs?: number;
  caloriesBurned?: number;
  weightKg?: number;
  /** Targets are stored alongside the counters so a historical day keeps the
   * goal the user was working towards, rather than today's target. */
  calorieTarget?: number;
  waterTargetMl?: number;
  goalMinutesTarget?: number;
}

export function todayKey(now: Date = new Date()): string {
  return isoDate(now);
}

/** Upserts a day's rollup. Values passed in are *absolute totals* for the day. */
export async function upsertDailyProgress(
  userId: string,
  day: string,
  counters: DayCounters,
): Promise<void> {
  const setFields: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(counters)) {
    if (value === undefined) continue;
    setFields[key] = value as number;
  }

  await Progress.updateOne(
    { userId, day },
    { $set: setFields, $setOnInsert: { userId, day } },
    { upsert: true },
  );
}

export interface DailyNutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

export const EMPTY_NUTRITION: DailyNutritionTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
};

/** Sums a day's food logs straight from the log collection. */
export async function getNutritionTotals(userId: string, day: string): Promise<DailyNutritionTotals> {
  const rows = await FoodLog.aggregate<{ _id: null; nutrition: LoggedNutrition[] }>([
    { $match: { userId: mongoose.Types.ObjectId.createFromHexString(String(userId)), day } },
    { $group: { _id: null, nutrition: { $push: '$nutrition' } } },
  ]);

  const logs = rows[0]?.nutrition ?? [];
  return logs.reduce<DailyNutritionTotals>(
    (totals, log) => ({
      calories: totals.calories + (log?.calories ?? 0),
      proteinG: totals.proteinG + (log?.proteinG ?? 0),
      carbsG: totals.carbsG + (log?.carbsG ?? 0),
      fatG: totals.fatG + (log?.fatG ?? 0),
      fiberG: totals.fiberG + (log?.fiberG ?? 0),
      sugarG: totals.sugarG + (log?.sugarG ?? 0),
      sodiumMg: totals.sodiumMg + (log?.sodiumMg ?? 0),
    }),
    { ...EMPTY_NUTRITION },
  );
}

export async function getWaterTotal(userId: string, day: string): Promise<number> {
  const rows = await WaterLog.aggregate<{ total: number }>([
    { $match: { userId: mongoose.Types.ObjectId.createFromHexString(String(userId)), day } },
    { $group: { _id: null, total: { $sum: '$amountMl' } } },
  ]);
  return Math.round(rows[0]?.total ?? 0);
}

export interface DailyActivityTotals {
  workoutMinutes: number;
  workoutCount: number;
  yogaCount: number;
  caloriesBurned: number;
  exercisesCompleted: number;
}

export const EMPTY_ACTIVITY: DailyActivityTotals = {
  workoutMinutes: 0,
  workoutCount: 0,
  yogaCount: 0,
  caloriesBurned: 0,
  exercisesCompleted: 0,
};

export async function getActivityTotals(userId: string, day: string): Promise<DailyActivityTotals> {
  const rows = await WorkoutSession.aggregate<{
    _id: null;
    workoutMinutes: number;
    workoutCount: number;
    yogaCount: number;
    caloriesBurned: number;
    exercisesCompleted: number;
  }>([
    { $match: { userId: mongoose.Types.ObjectId.createFromHexString(String(userId)), day, status: 'completed' } },
    {
      $group: {
        _id: null,
        workoutMinutes: { $sum: '$durationMinutes' },
        workoutCount: { $sum: 1 },
        yogaCount: { $sum: { $cond: [{ $eq: ['$category', 'yoga'] }, 1, 0] } },
        caloriesBurned: { $sum: '$caloriesBurned' },
        exercisesCompleted: { $sum: '$exercisesCompleted' },
      },
    },
  ]);

  const row = rows[0];
  return {
    workoutMinutes: Math.round(row?.workoutMinutes ?? 0),
    workoutCount: row?.workoutCount ?? 0,
    yogaCount: row?.yogaCount ?? 0,
    caloriesBurned: Math.round(row?.caloriesBurned ?? 0),
    exercisesCompleted: row?.exercisesCompleted ?? 0,
  };
}

/**
 * Rebuilds one day's rollup from the source collections. Called after any
 * create/update/delete that affects nutrition, water or training, which keeps
 * the dashboards correct without any client-side bookkeeping.
 */
export async function rebuildDay(userId: string, day: string): Promise<ProgressAttributes | null> {
  const [nutrition, waterMl, activity, user] = await Promise.all([
    getNutritionTotals(userId, day),
    getWaterTotal(userId, day),
    getActivityTotals(userId, day),
    User.findById(userId, 'weightKg dailyCalorieTarget dailyWaterTargetMl preferredWorkoutMinutes').lean(),
  ]);

  const weightEntry = await Progress.findOne({ userId, day }).select('weightKg').lean();
  const weightKg = weightEntry?.weightKg ?? null;

  const counters: DayCounters = {
    caloriesConsumed: Math.round(nutrition.calories),
    proteinG: Math.round(nutrition.proteinG),
    carbsG: Math.round(nutrition.carbsG),
    fatG: Math.round(nutrition.fatG),
    fiberG: Math.round(nutrition.fiberG),
    waterMl,
    workoutMinutes: activity.workoutMinutes,
    workoutCount: activity.workoutCount,
    yogaCount: activity.yogaCount,
    caloriesBurned: activity.caloriesBurned,
    mealsLogged: await FoodLog.countDocuments({ userId, day }),
    foodLogs: await FoodLog.countDocuments({ userId, day }),
    calorieTarget: user?.dailyCalorieTarget ?? 0,
    waterTargetMl: user?.dailyWaterTargetMl ?? 2000,
    goalMinutesTarget: user?.preferredWorkoutMinutes ?? 0,
  };

  if (weightKg !== null) counters.weightKg = weightKg;

  await upsertDailyProgress(userId, day, counters);
  return Progress.findOne({ userId, day }).lean();
}

export interface TrendPoint {
  day: string;
  date: string;
  weightKg: number | null;
  bmi: number | null;
  caloriesConsumed: number;
  caloriesBurned: number;
  calorieTarget: number;
  waterMl: number;
  waterTargetMl: number;
  workoutMinutes: number;
  workoutCount: number;
  yogaCount: number;
  foodLogs: number;
}

export async function getDailySeries(userId: string, days: number): Promise<TrendPoint[]> {
  const ranges = dayRanges(days);
  const start = ranges[0].start;
  const end = ranges[ranges.length - 1].end;

  const entries = await Progress.find({ userId, day: { $gte: isoDate(start), $lte: isoDate(end) } })
    .lean()
    .exec();

  const byDay = new Map(entries.map((entry) => [entry.day, entry]));

  return ranges.map(({ start: dayStart, end: dayEnd }) => {
    const day = isoDate(dayStart);
    const entry = byDay.get(day);
    return {
      day,
      date: day,
      weightKg: entry?.weightKg ?? null,
      bmi: entry?.bmi ?? null,
      caloriesConsumed: entry?.caloriesConsumed ?? 0,
      caloriesBurned: entry?.caloriesBurned ?? 0,
      calorieTarget: entry?.calorieTarget ?? 0,
      waterMl: entry?.waterMl ?? 0,
      waterTargetMl: entry?.waterTargetMl ?? 2000,
      workoutMinutes: entry?.workoutMinutes ?? 0,
      workoutCount: entry?.workoutCount ?? 0,
      yogaCount: entry?.yogaCount ?? 0,
      foodLogs: entry?.foodLogs ?? 0,
    };
  });
}

export interface RangeSummary {
  range: { from: string; to: string; days: number };
  totals: {
    workouts: number;
    yogaSessions: number;
    workoutMinutes: number;
    caloriesBurned: number;
    caloriesConsumed: number;
    waterMl: number;
    activeDays: number;
    foodLogs: number;
  };
  averages: {
    caloriesConsumed: number;
    waterMl: number;
    workoutMinutes: number;
    workoutsPerDay: number;
  };
  weightChangeKg: number | null;
  bestDay: { day: string; workoutMinutes: number } | null;
  consistencyPercent: number;
  series: TrendPoint[];
}

function summarise(rangeFrom: Date, rangeTo: Date, days: number, series: TrendPoint[]): RangeSummary {
  const from = isoDate(rangeFrom);
  const to = isoDate(rangeTo);

  const totals = series.reduce(
    (acc, point) => ({
      workouts: acc.workouts + point.workoutCount,
      yogaSessions: acc.yogaSessions + point.yogaCount,
      workoutMinutes: acc.workoutMinutes + point.workoutMinutes,
      caloriesBurned: acc.caloriesBurned + point.caloriesBurned,
      caloriesConsumed: acc.caloriesConsumed + point.caloriesConsumed,
      waterMl: acc.waterMl + point.waterMl,
      foodLogs: acc.foodLogs + point.foodLogs,
    }),
    {
      workouts: 0,
      yogaSessions: 0,
      workoutMinutes: 0,
      caloriesBurned: 0,
      caloriesConsumed: 0,
      waterMl: 0,
      foodLogs: 0,
    },
  );

  const activeDays = series.filter(
    (point) => point.workoutCount > 0 || point.yogaCount > 0 || point.waterMl > 0 || point.foodLogs > 0,
  ).length;

  const weights = series.map((point) => point.weightKg).filter((value): value is number => value !== null);
  const weightChangeKg = weights.length >= 2 ? round1(weights[weights.length - 1] - weights[0]) : null;

  const best = series.reduce<{ day: string; workoutMinutes: number } | null>((bestSoFar, point) => {
    if (!bestSoFar || point.workoutMinutes > bestSoFar.workoutMinutes) {
      return { day: point.day, workoutMinutes: point.workoutMinutes };
    }
    return bestSoFar;
  }, null);

  return {
    range: { from, to, days },
    totals: { ...totals, activeDays },
    averages: {
      caloriesConsumed: Math.round(totals.caloriesConsumed / Math.max(1, days)),
      waterMl: Math.round(totals.waterMl / Math.max(1, days)),
      workoutMinutes: Math.round(totals.workoutMinutes / Math.max(1, days)),
      workoutsPerDay: round1(totals.workouts / Math.max(1, days)),
    },
    weightChangeKg,
    bestDay: best && best.workoutMinutes > 0 ? best : null,
    consistencyPercent: Math.round((activeDays / Math.max(1, days)) * 100),
    series,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getWeeklyProgress(userId: string, weeks = 8): Promise<RangeSummary[]> {
  const count = Math.max(1, Math.min(weeks, 52));
  const summaries: RangeSummary[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const weekStart = addDays(startOfWeek(), -7 * i);
    const weekEnd = endOfWeek(weekStart);
    const series = await getDailySeriesBetween(userId, weekStart, weekEnd);
    summaries.push(summarise(weekStart, weekEnd, 7, series));
  }

  return summaries;
}

export async function getMonthlyProgress(userId: string, months = 6): Promise<RangeSummary[]> {
  const count = Math.max(1, Math.min(months, 24));
  const summaries: RangeSummary[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const monthStart = new Date(
      Date.UTC(startOfMonth().getUTCFullYear(), startOfMonth().getUTCMonth() - i, 1),
    );
    const monthEnd = endOfMonth(monthStart);
    const series = await getDailySeriesBetween(userId, monthStart, monthEnd);
    const dayCount = Math.max(1, Math.round((endOfDay(monthEnd).getTime() - startOfDay(monthStart).getTime()) / 86_400_000));
    summaries.push(summarise(monthStart, monthEnd, dayCount, series));
  }

  return summaries;
}

async function getDailySeriesBetween(userId: string, from: Date, to: Date): Promise<TrendPoint[]> {
  const entries = await Progress.find({
    userId,
    day: { $gte: isoDate(from), $lte: isoDate(to) },
  })
    .lean()
    .exec();

  const byDay = new Map(entries.map((entry) => [entry.day, entry]));
  const totalDays = Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1);

  const series: TrendPoint[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const day = isoDate(addDays(from, i));
    const entry = byDay.get(day);
    series.push({
      day,
      date: day,
      weightKg: entry?.weightKg ?? null,
      bmi: entry?.bmi ?? null,
      caloriesConsumed: entry?.caloriesConsumed ?? 0,
      caloriesBurned: entry?.caloriesBurned ?? 0,
      calorieTarget: entry?.calorieTarget ?? 0,
      waterMl: entry?.waterMl ?? 0,
      waterTargetMl: entry?.waterTargetMl ?? 2000,
      workoutMinutes: entry?.workoutMinutes ?? 0,
      workoutCount: entry?.workoutCount ?? 0,
      yogaCount: entry?.yogaCount ?? 0,
      foodLogs: entry?.foodLogs ?? 0,
    });
  }

  return series;
}

export interface WeightEntry {
  day: string;
  weightKg: number;
  bmi: number | null;
}

export async function getWeightHistory(userId: string, limit = 90): Promise<WeightEntry[]> {
  const entries = await Progress.find({ userId, weightKg: { $ne: null } })
    .sort({ day: -1 })
    .limit(Math.min(Math.max(limit, 1), 365))
    .select('day weightKg bmi')
    .lean();

  return entries.map((entry) => ({ day: entry.day, weightKg: entry.weightKg as number, bmi: entry.bmi ?? null }));
}

export interface StreakInfo {
  current: number;
  longest: number;
  activeToday: boolean;
  lastActiveDay: string | null;
  milestones: Array<{ days: number; label: string; reached: boolean }>;
}

/**
 * A day counts toward the streak when the user completed a workout, a yoga
 * session, logged food, or hit their water target. This rewards showing up,
 * not just training, and never punishes rest days that were logged as missed.
 */
export async function getStreak(userId: string, now: Date = new Date()): Promise<StreakInfo> {
  const cutoff = isoDate(addDays(startOfDay(now), -400));
  const entries = await Progress.find({
    userId,
    day: { $gte: cutoff },
    $or: [{ workoutCount: { $gt: 0 } }, { yogaCount: { $gt: 0 } }, { foodLogs: { $gt: 0 } }, { waterMl: { $gt: 0 } }],
  })
    .select('day workoutCount yogaCount foodLogs waterMl')
    .lean();

  const activeDays = new Set(entries.map((entry) => entry.day));

  const user = await User.findById(userId, 'streak longestStreak lastActiveDate').lean();
  const waterTarget = user?.dailyWaterTargetMl ?? 2000;

  // Hydration alone counts once the day's target is met.
  for (const entry of entries) {
    if (entry.waterMl >= waterTarget && waterTarget > 0) activeDays.add(entry.day);
  }

  let current = 0;
  const today = startOfDay(now);
  // The streak stays alive if the user has not acted *yet* today.
  let cursor = activeDays.has(isoDate(today)) ? today : addDays(today, -1);
  while (activeDays.has(isoDate(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sortedDays = [...activeDays].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sortedDays) {
    if (previous && differenceInDays(new Date(`${day}T00:00:00Z`), new Date(`${previous}T00:00:00Z`)) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = day;
  }

  const bestEver = Math.max(longest, user?.longestStreak ?? 0);
  const lastActiveDay = sortedDays.length ? sortedDays[sortedDays.length - 1] : null;

  return {
    current: Math.max(current, 0),
    longest: bestEver,
    activeToday: activeDays.has(isoDate(today)),
    lastActiveDay,
    milestones: [3, 7, 14, 30, 60, 100, 365].map((days) => ({
      days,
      label: `${days} day streak`,
      reached: bestEver >= days,
    })),
  };
}

/** Persists the recomputed streak onto the user document. */
export async function syncStreak(userId: string, now: Date = new Date()): Promise<StreakInfo> {
  const streak = await getStreak(userId, now);
  await User.updateOne(
    { _id: userId },
    { $set: { streak: streak.current, longestStreak: Math.max(streak.longest, streak.current), lastActiveDate: new Date() } },
  );
  return streak;
}

export async function logDailyWeight(userId: string, weightKg: number, bmi: number | null, day: string): Promise<void> {
  await Progress.updateOne(
    { userId, day },
    { $set: { weightKg, ...(bmi !== null ? { bmi } : {}) }, $setOnInsert: { userId, day } },
    { upsert: true },
  );
}

export function buildProgressFilter(userId: string, extra: QueryFilter<ProgressAttributes> = {}): QueryFilter<ProgressAttributes> {
  return { userId, ...extra } as QueryFilter<ProgressAttributes>;
}
