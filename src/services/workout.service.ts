import mongoose, { type QueryFilter } from 'mongoose';
import { Workout, WORKOUT_LIST_PROJECTION } from '../models/Workout';
import { WorkoutSession } from '../models/WorkoutSession';
import { Yoga, YOGA_LIST_PROJECTION } from '../models/Yoga';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { getPagination, toIdArray, containsFilter } from '../utils/pagination';
import { calculateCaloriesBurned } from '../utils/health';
import { isoDate } from '../utils/date';
import { rebuildDay, todayKey } from './progress.service';
import { evaluateAchievements } from './achievement.service';
import {
  type Equipment,
  type FitnessLevel,
  type MuscleGroup,
  type WorkoutCategory,
  type WorkoutLocation,
  type YogaCategory,
} from '../types/enums';

export interface WorkoutListQuery {
  page?: unknown;
  limit?: unknown;
  search?: string;
  category?: string;
  difficulty?: string;
  location?: string;
  equipment?: string;
  muscleGroup?: string;
  maxDuration?: string;
  minDuration?: string;
  sort?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function buildWorkoutFilter(query: WorkoutListQuery): QueryFilter<Record<string, unknown>> {
  const filter: QueryFilter<Record<string, unknown>> = { isActive: true };

  const search = containsFilter('title', query.search);
  if (Object.keys(search).length) {
    filter.$or = [search, containsFilter('description', query.search)];
  }

  if (query.category) filter.category = query.category;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.location) filter.location = query.location;

  const equipment = toIdArray(query.equipment);
  if (equipment.length) filter.equipment = { $in: equipment };

  const muscleGroups = toIdArray(query.muscleGroup);
  if (muscleGroups.length) filter.muscleGroups = { $in: muscleGroups };

  const minDuration = Number(query.minDuration);
  if (Number.isFinite(minDuration) && minDuration > 0) {
    filter.durationMinutes = { ...((filter.durationMinutes as object) ?? {}), $gte: minDuration };
  }
  const maxDuration = Number(query.maxDuration);
  if (Number.isFinite(maxDuration) && maxDuration > 0) {
    filter.durationMinutes = { ...((filter.durationMinutes as object) ?? {}), $lte: maxDuration };
  }

  return filter;
}

const WORKOUT_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  popular: { popularity: -1, createdAt: -1 },
  shortest: { durationMinutes: 1 },
  longest: { durationMinutes: -1 },
  title: { title: 1 },
};

export async function listWorkouts(query: WorkoutListQuery): Promise<PaginatedResult<unknown>> {
  const { page, limit, skip } = getPagination(query);
  const filter = buildWorkoutFilter(query);
  const sort = WORKOUT_SORTS[query.sort ?? 'popular'] ?? WORKOUT_SORTS.popular;

  const [items, total] = await Promise.all([
    Workout.find(filter, WORKOUT_LIST_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
    Workout.countDocuments(filter),
  ]);

  return {
    items: items as unknown[],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

export async function getWorkout(id: string): Promise<unknown> {
  const workout = await Workout.findById(id).lean();
  if (!workout) throw ApiError.notFound('Workout not found');
  return workout;
}

export interface YogaListQuery {
  page?: unknown;
  limit?: unknown;
  search?: string;
  category?: string;
  difficulty?: string;
  maxDuration?: string;
  bestTimeOfDay?: string;
}

export async function listYoga(query: YogaListQuery): Promise<PaginatedResult<unknown>> {
  const { page, limit, skip } = getPagination(query);
  const filter: QueryFilter<Record<string, unknown>> = { isActive: true };

  const search = containsFilter('title', query.search);
  if (Object.keys(search).length) filter.$or = [search, containsFilter('description', query.search)];

  if (query.category) filter.category = query.category;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.bestTimeOfDay) filter.bestTimeOfDay = query.bestTimeOfDay;

  const maxDuration = Number(query.maxDuration);
  if (Number.isFinite(maxDuration) && maxDuration > 0) filter.durationMinutes = { $lte: maxDuration };

  const [items, total] = await Promise.all([
    Yoga.find(filter, YOGA_LIST_PROJECTION).sort({ popularity: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Yoga.countDocuments(filter),
  ]);

  return {
    items: items as unknown[],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

export async function getYoga(id: string): Promise<unknown> {
  const routine = await Yoga.findById(id).lean();
  if (!routine) throw ApiError.notFound('Yoga routine not found');
  return routine;
}

/** Ensures a value is a valid ObjectId before it reaches a query. */
export function toObjectId(value: string | string[] | undefined, label = 'id'): mongoose.Types.ObjectId {
  // Express 5 types route params as `string | string[]`; the runtime value is
  // always a single string, so normalise before validating.
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    throw ApiError.badRequest(`Invalid ${label}`, [{ field: label, message: 'Malformed id' }]);
  }
  return new mongoose.Types.ObjectId(raw);
}

/**
 * Starts a session. If the user already has an in-progress session for this
 * workout, that document is returned instead of creating a duplicate, so a
 * double tap on "Start" cannot produce two sessions.
 */
export async function startWorkoutSession(
  userId: string,
  workoutId: string,
): Promise<{ session: unknown; workout: unknown; resumed: boolean }> {
  const workout = await Workout.findById(workoutId).lean();
  if (!workout) throw ApiError.notFound('Workout not found');

  const existing = await WorkoutSession.findOne({
    userId,
    workoutId,
    status: 'in_progress',
  }).lean();

  if (existing) {
    return { session: existing, workout, resumed: true };
  }

  const session = await WorkoutSession.create({
    userId,
    workoutId,
    title: workout.title,
    startedAt: new Date(),
    day: todayKey(),
    status: 'in_progress',
    exercisesTotal: workout.exercises?.length ?? 0,
    difficulty: workout.difficulty,
    category: workout.category,
  });

  return { session, workout, resumed: false };
}

export interface CompleteSessionInput {
  completedExercises?: Array<{
    exerciseOrder: number;
    name: string;
    durationSeconds?: number;
    caloriesBurned?: number;
  }>;
  durationMinutes?: number;
  perceivedEffort?: number;
  notes?: string;
}

export interface CompleteSessionResult {
  session: unknown;
  caloriesBurned: number;
  progressUpdated: boolean;
  newAchievements: string[];
  dayTotals: { workoutMinutes: number; workoutCount: number; yogaCount: number };
}

/** Yoga sessions reuse the WorkoutSession collection with category='yoga'. */
export async function completeYogaSession(
  userId: string,
  yogaId: string,
  input: CompleteSessionInput,
): Promise<CompleteSessionResult> {
  const routine = await Yoga.findById(yogaId).lean();
  if (!routine) throw ApiError.notFound('Yoga routine not found');

  const user = await User.findById(userId, 'weightKg fitnessLevel').lean();
  const day = todayKey();

  // Trust the recorded duration, but fall back to the routine length so a
  // client that forgets to send timing still produces a sensible estimate.
  const durationMinutes = Math.max(1, Math.round(input.durationMinutes ?? routine.durationMinutes));
  const caloriesBurned = calculateCaloriesBurned({
    category: 'yoga',
    minutes: durationMinutes,
    weightKg: user?.weightKg ?? 70,
    fitnessLevel: (user?.fitnessLevel ?? 'beginner') as FitnessLevel,
  });

  const session = await WorkoutSession.create({
    userId,
    yogaId,
    title: routine.title,
    startedAt: new Date(Date.now() - durationMinutes * 60_000),
    completedAt: new Date(),
    durationMinutes,
    caloriesBurned,
    status: 'completed',
    completedExercises: input.completedExercises ?? [],
    exercisesCompleted: input.completedExercises?.length ?? routine.asanas?.length ?? 0,
    exercisesTotal: routine.asanas?.length ?? 0,
    perceivedEffort: input.perceivedEffort,
    notes: input.notes ?? '',
    day,
    category: 'yoga',
    difficulty: routine.difficulty,
  });

  await User.updateOne(
    { _id: userId },
    {
      $inc: {
        totalYogaSessions: 1,
        totalWorkoutMinutes: durationMinutes,
      },
    },
  );

  await Yoga.updateOne({ _id: yogaId }, { $inc: { popularity: 1 } });
  await rebuildDay(userId, day);
  const earned = await evaluateAchievements(userId);

  return {
    session,
    caloriesBurned,
    progressUpdated: true,
    newAchievements: earned.map((item) => item.key),
    dayTotals: { workoutMinutes: durationMinutes, workoutCount: 0, yogaCount: 1 },
  };
}

export async function completeWorkoutSession(
  userId: string,
  workoutId: string,
  input: CompleteSessionInput,
): Promise<CompleteSessionResult> {
  const workout = await Workout.findById(workoutId).lean();
  if (!workout) throw ApiError.notFound('Workout not found');

  const user = await User.findById(userId, 'weightKg fitnessLevel').lean();
  const day = todayKey();

  const durationMinutes = Math.max(1, Math.round(input.durationMinutes ?? workout.durationMinutes));

  // Per-exercise figures win when supplied; otherwise derive from the workout
  // so a client that omits them still records a plausible energy expenditure.
  const fallbackPerExercise = Math.round(durationMinutes / Math.max(1, workout.exercises?.length ?? 1));
  const completedExercises = (input.completedExercises ?? []).map((exercise) => ({
    exerciseOrder: exercise.exerciseOrder,
    name: exercise.name,
    durationSeconds: exercise.durationSeconds ?? fallbackPerExercise * 60,
    caloriesBurned:
      exercise.caloriesBurned ??
      calculateCaloriesBurned({
        category: workout.category,
        minutes: fallbackPerExercise,
        weightKg: user?.weightKg ?? 70,
        fitnessLevel: (user?.fitnessLevel ?? 'intermediate') as FitnessLevel,
      }),
    completedAt: new Date(),
  }));

  const summedExerciseCalories = completedExercises.reduce((sum, item) => sum + (item.caloriesBurned ?? 0), 0);

  const caloriesBurned =
    completedExercises.length > 0
      ? Math.max(0, Math.round(summedExerciseCalories))
      : calculateCaloriesBurned({
          category: workout.category,
          minutes: durationMinutes,
          weightKg: user?.weightKg ?? 70,
          fitnessLevel: (user?.fitnessLevel ?? 'intermediate') as FitnessLevel,
        });

  // Reuse an in-progress session when one exists so a session is not double counted.
  const existing = await WorkoutSession.findOneAndUpdate(
    { userId, workoutId, status: 'in_progress' },
    {
      $set: {
        completedAt: new Date(),
        durationMinutes,
        caloriesBurned,
        status: 'completed',
        completedExercises,
        exercisesCompleted: completedExercises.length,
        exercisesTotal: workout.exercises?.length ?? completedExercises.length,
        perceivedEffort: input.perceivedEffort,
        notes: input.notes ?? '',
        day,
      },
    },
    { returnDocument: 'after' },
  );

  const session =
    existing ??
    (await WorkoutSession.create({
      userId,
      workoutId,
      title: workout.title,
      startedAt: new Date(Date.now() - durationMinutes * 60_000),
      completedAt: new Date(),
      durationMinutes,
      caloriesBurned,
      status: 'completed',
      completedExercises,
      exercisesCompleted: completedExercises.length,
      exercisesTotal: workout.exercises?.length ?? completedExercises.length,
      perceivedEffort: input.perceivedEffort,
      notes: input.notes ?? '',
      day,
      category: workout.category,
      difficulty: workout.difficulty,
    }));

  await User.updateOne(
    { _id: userId },
    { $inc: { totalWorkouts: 1, totalWorkoutMinutes: durationMinutes } },
  );

  await Workout.updateOne({ _id: workoutId }, { $inc: { popularity: 1 } });
  await rebuildDay(userId, day);
  const earned = await evaluateAchievements(userId);

  return {
    session,
    caloriesBurned,
    progressUpdated: true,
    newAchievements: earned.map((item) => item.key),
    dayTotals: { workoutMinutes: durationMinutes, workoutCount: 1, yogaCount: 0 },
  };
}

export async function getSession(userId: string, sessionId: string): Promise<unknown> {
  const session = await WorkoutSession.findOne({ _id: toObjectId(sessionId, 'sessionId'), userId })
    .populate('workoutId', 'title category difficulty durationMinutes imageUrl')
    .populate('yogaId', 'title category difficulty durationMinutes imageUrl')
    .lean();
  if (!session) throw ApiError.notFound('Workout session not found');
  return session;
}

export async function listHistory(
  userId: string,
  query: { page?: unknown; limit?: unknown; type?: string },
): Promise<PaginatedResult<unknown>> {
  const { page, limit, skip } = getPagination(query);
  const filter: QueryFilter<Record<string, unknown>> = { userId };

  if (query.type === 'workout') filter.category = { $ne: 'yoga' };
  if (query.type === 'yoga') filter.category = 'yoga';

  const [items, total] = await Promise.all([
    WorkoutSession.find(filter)
      .populate('workoutId', 'title category difficulty durationMinutes imageUrl')
    .populate('yogaId', 'title category difficulty durationMinutes imageUrl')
      .sort({ completedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WorkoutSession.countDocuments(filter),
  ]);

  return {
    items: items as unknown[],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

export async function getActiveSession(userId: string): Promise<unknown | null> {
  return WorkoutSession.findOne({ userId, status: 'in_progress' })
    .populate('workoutId', 'title category difficulty durationMinutes imageUrl exercises')
    .populate('yogaId', 'title category difficulty durationMinutes imageUrl asanas')
    .sort({ startedAt: -1 })
    .lean();
}

export async function abandonSession(userId: string, sessionId: string): Promise<{ abandoned: boolean }> {
  const result = await WorkoutSession.updateOne(
    { _id: toObjectId(sessionId, 'sessionId'), userId, status: 'in_progress' },
    { $set: { status: 'abandoned', completedAt: new Date() } },
  );
  return { abandoned: (result.modifiedCount ?? 0) > 0 };
}

export interface WorkoutStats {
  totalSessions: number;
  totalMinutes: number;
  totalCalories: number;
  byCategory: Array<{ category: string; count: number; minutes: number }>;
  byDifficulty: Array<{ difficulty: string; count: number }>;
  averageDurationMinutes: number;
}

export async function getWorkoutStats(userId: string): Promise<WorkoutStats> {
  const userIdObject = toObjectId(userId, 'userId');

  const [totals, byCategory, byDifficulty] = await Promise.all([
    WorkoutSession.aggregate<{ sessions: number; minutes: number; calories: number }>([
      { $match: { userId: userIdObject, status: 'completed' } },
      { $group: { _id: null, sessions: { $sum: 1 }, minutes: { $sum: '$durationMinutes' }, calories: { $sum: '$caloriesBurned' } } },
    ]),
    WorkoutSession.aggregate<{ _id: string; count: number; minutes: number }>([
      { $match: { userId: userIdObject, status: 'completed' } },
      { $group: { _id: '$category', count: { $sum: 1 }, minutes: { $sum: '$durationMinutes' } } },
      { $sort: { count: -1 } },
    ]),
    WorkoutSession.aggregate<{ _id: string; count: number }>([
      { $match: { userId: userIdObject, status: 'completed' } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]),
  ]);

  const sessions = totals[0]?.sessions ?? 0;
  const minutes = Math.round(totals[0]?.minutes ?? 0);

  return {
    totalSessions: sessions,
    totalMinutes: minutes,
    totalCalories: Math.round(totals[0]?.calories ?? 0),
    byCategory: byCategory.map((row) => ({ category: row._id, count: row.count, minutes: Math.round(row.minutes ?? 0) })),
    byDifficulty: byDifficulty.map((row) => ({ difficulty: row._id, count: row.count })),
    averageDurationMinutes: sessions ? Math.round(minutes / sessions) : 0,
  };
}

export function getTodayWorkoutDay(): string {
  return isoDate(new Date());
}

export type { Equipment, MuscleGroup, WorkoutCategory, WorkoutLocation, YogaCategory };
