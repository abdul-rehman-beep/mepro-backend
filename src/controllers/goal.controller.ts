import type { QueryFilter } from 'mongoose';
import type { Request, Response } from 'express';
import { Goal, goalProgressPercent, type GoalAttributes, type GoalDocument } from '../models/Goal';
import { User } from '../models/User';
import { Progress } from '../models/Progress';
import { WorkoutSession } from '../models/WorkoutSession';
import { WaterLog } from '../models/WaterLog';
import { sendCreated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';
import { toObjectId } from '../services/workout.service';
import { evaluateAchievements } from '../services/achievement.service';
import { getStreak, todayKey } from '../services/progress.service';
import { isoDate, startOfDay, addDays } from '../utils/date';

export async function list(req: Request, res: Response): Promise<Response> {
  const { page, limit, skip } = getPagination(req.query as { page?: unknown; limit?: unknown });
  const status = (req.query as { status?: string }).status;

  const filter: QueryFilter<GoalAttributes> = { userId: req.user!.id };
  if (status === 'active' || status === 'completed' || status === 'archived') filter.status = status;

  const [items, total] = await Promise.all([
    Goal.find(filter).sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Goal.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  }, 'Goals');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const body = req.body as {
    title: string;
    description?: string;
    goalType: GoalAttributes['goalType'];
    targetValue: number;
    currentValue?: number;
    unit: string;
    targetDate?: string;
    source?: GoalAttributes['source'];
  };

  const source: GoalAttributes['source'] = body.source ?? 'manual';

  // The baseline is captured once, at creation, and never moves: it is the
  // fixed "where I started" reference that makes progress meaningful. For a
  // weight goal that is the current weight, so a new "lose 5 kg" goal reads 0%
  // rather than 100%. Counter goals start from zero.
  const baselineValue = await readBaseline(source, req.user!.id);

  // Only validated fields are copied through; `baselineValue` is server-owned.
  const goal = await Goal.create({
    userId: req.user!.id,
    title: body.title,
    description: body.description ?? '',
    goalType: body.goalType,
    targetValue: body.targetValue,
    unit: body.unit,
    targetDate: body.targetDate ? new Date(body.targetDate) : null,
    source,
    baselineValue,
    // A manual goal honours the client-supplied starting value (the validator
    // defaults it to 0). An auto-sourced goal always starts at its baseline, so
    // the immediate sync below measures real change rather than a fake offset.
    currentValue: source === 'manual' ? Math.max(0, body.currentValue ?? 0) : baselineValue,
  });

  // Reflect reality immediately rather than only after the next background sync.
  const synced =
    source === 'manual'
      ? await saveProgress(goal)
      : ((await syncGoalProgress(goal.id, req.user!.id)) as GoalAttributes) ?? goal.toObject();

  return sendCreated(res, synced, 'Goal created');
}

/** Persists a freshly created goal's initial progress without a full sync. */
async function saveProgress(goal: GoalDocument): Promise<GoalAttributes> {
  goal.progressPercent = computeProgress(goal);
  goal.lastSyncedAt = new Date();
  await goal.save();
  return goal.toObject();
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const goal = await Goal.findOne({ _id: toObjectId(req.params.id, 'goalId'), userId: req.user!.id }).lean();
  if (!goal) throw ApiError.notFound('Goal not found');
  return sendSuccess(res, goal, 'Goal');
}

export async function update(req: Request, res: Response): Promise<Response> {
  const goal = await Goal.findOneAndUpdate(
    { _id: toObjectId(req.params.id, 'goalId'), userId: req.user!.id },
    { $set: req.body },
    { returnDocument: 'after', runValidators: true },
  );
  if (!goal) throw ApiError.notFound('Goal not found');
  return sendSuccess(res, goal, 'Goal updated');
}

export async function remove(req: Request, res: Response): Promise<Response> {
  const result = await Goal.deleteOne({ _id: toObjectId(req.params.id, 'goalId'), userId: req.user!.id });
  if ((result.deletedCount ?? 0) === 0) throw ApiError.notFound('Goal not found');
  return sendSuccess(res, { deleted: true }, 'Goal deleted');
}

/**
 * Recomputes a goal's current value from the source data its `source` declares,
 * then derives progress. This is what keeps weight / workout / water goals
 * accurate without the client having to report progress back to us.
 */
export async function syncGoalProgress(goalId: string, userId: string): Promise<GoalAttributes | null> {
  const goal = await Goal.findOne({ _id: toObjectId(goalId, 'goalId'), userId });
  if (!goal) return null;

  const userIdObject = toObjectId(userId, 'userId');
  const today = todayKey();
  const weekAgo = startOfDay(addDays(new Date(), -6));
  let currentValue = goal.currentValue ?? 0;

  switch (goal.source) {
    case 'weight': {
      const latest = await Progress.findOne({ userId, weightKg: { $ne: null } })
        .sort({ day: -1 })
        .select('weightKg')
        .lean();
      currentValue = latest?.weightKg ?? currentValue;
      break;
    }
    case 'workout_count': {
      currentValue = await WorkoutSession.countDocuments({
        userId,
        status: 'completed',
        category: { $ne: 'yoga' },
        completedAt: { $gte: weekAgo },
      });
      break;
    }
    case 'workout_minutes': {
      const rows = await WorkoutSession.aggregate<{ total: number }>([
        { $match: { userId: userIdObject, status: 'completed', completedAt: { $gte: weekAgo } } },
        { $group: { _id: null, total: { $sum: '$durationMinutes' } } },
      ]);
      currentValue = Math.round(rows[0]?.total ?? 0);
      break;
    }
    case 'yoga_count': {
      currentValue = await WorkoutSession.countDocuments({
        userId,
        status: 'completed',
        category: 'yoga',
        completedAt: { $gte: weekAgo },
      });
      break;
    }
    case 'water_ml': {
      const rows = await WaterLog.aggregate<{ total: number }>([
        { $match: { userId: userIdObject, day: today } },
        { $group: { _id: null, total: { $sum: '$amountMl' } } },
      ]);
      currentValue = Math.round(rows[0]?.total ?? 0);
      break;
    }
    case 'streak': {
      const streak = await getStreak(userId);
      currentValue = streak.current;
      break;
    }
    case 'manual':
    default:
      break;
  }

  goal.currentValue = currentValue;
  goal.progressPercent = computeProgress(goal);
  goal.lastSyncedAt = new Date();

  const wasCompleted = goal.status === 'completed';
  if (goal.progressPercent >= 100 && goal.status === 'active') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  await goal.save();

  if (!wasCompleted && goal.status === 'completed') {
    await evaluateAchievements(userId);
  }

  return goal.toObject();
}

function computeProgress(goal: { baselineValue?: number | null; currentValue?: number | null; targetValue: number }): number {
  return goalProgressPercent(goal.baselineValue ?? 0, goal.currentValue ?? 0, goal.targetValue);
}

/**
 * Reads the value a source-sourced goal should start counting from, so a brand
 * new "lose 5 kg" goal reports 0% rather than 100% (or 160%).
 */
async function readBaseline(source: string, userId: string): Promise<number> {
  if (source === 'weight') {
    const user = await User.findById(userId).select('weightKg').lean();
    // A weight goal with no starting weight is meaningless: a baseline of 0
    // makes the goal sit at 0% forever and hides real change, so ask the user
    // to record a weight first.
    if (!user?.weightKg) {
      throw ApiError.badRequest('Log your current weight before creating a weight goal');
    }
    return user.weightKg;
  }
  // Counters legitimately start at zero: the immediate sync below replaces it
  // with the real count.
  return 0;
}

export async function setProgress(req: Request, res: Response): Promise<Response> {
  const goal = await Goal.findOne({ _id: toObjectId(req.params.id, 'goalId'), userId: req.user!.id });
  if (!goal) throw ApiError.notFound('Goal not found');

  const { currentValue, increment } = req.body as { currentValue?: number; increment?: number };

  if (currentValue !== undefined) goal.currentValue = currentValue;
  if (increment !== undefined) goal.currentValue = (goal.currentValue ?? 0) + increment;

  goal.progressPercent = computeProgress(goal);
  goal.lastSyncedAt = new Date();

  if (goal.progressPercent >= 100 && goal.status === 'active') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  await goal.save();
  await evaluateAchievements(req.user!.id);

  return sendSuccess(res, goal, 'Goal progress updated');
}

/** Refreshes every auto-sourced goal for the current user. */
export async function syncAll(userId: string): Promise<void> {
  const goals = await Goal.find({ userId, source: { $ne: 'manual' }, status: 'active' })
    .select('_id')
    .lean();

  for (const goal of goals) {
    await syncGoalProgress(goal._id.toString(), userId).catch(() => undefined);
  }
}

export async function syncAllForUser(req: Request, res: Response): Promise<Response> {
  await syncAll(req.user!.id);
  const goals = await Goal.find({ userId: req.user!.id }).sort({ status: 1, createdAt: -1 }).lean();
  return sendSuccess(res, goals, 'Goals synced');
}

export async function getStats(req: Request, res: Response): Promise<Response> {
  const [total, active, completed, user] = await Promise.all([
    Goal.countDocuments({ userId: req.user!.id }),
    Goal.countDocuments({ userId: req.user!.id, status: 'active' }),
    Goal.countDocuments({ userId: req.user!.id, status: 'completed' }),
    User.findById(req.user!.id).select('achievementPoints').lean(),
  ]);

  return sendSuccess(
    res,
    { total, active, completed, completionRate: total ? Math.round((completed / total) * 100) : 0, points: user?.achievementPoints ?? 0 },
    'Goal statistics',
  );
}

export { isoDate };
