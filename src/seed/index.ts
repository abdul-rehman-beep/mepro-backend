/**
 * Idempotent database seed.
 *
 * The catalogue is upserted on a stable natural key (slug / key), so running
 * `npm run seed` repeatedly is safe and never duplicates entries. Demo accounts
 * are upserted by email, and their history is only generated once.
 *
 *   npm run seed            upsert catalogue + regenerate demo accounts
 *   npm run seed -- --reset clear every collection, then seed
 *
 * Day rollups are written by calling the production `rebuildDay()` rather than
 * reimplementing the arithmetic, so seeded progress data is identical to what
 * real usage produces.
 */

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { Workout } from '../models/Workout';
import { Yoga } from '../models/Yoga';
import { Food } from '../models/Food';
import { Achievement, UserAchievement } from '../models/Achievement';
import { User } from '../models/User';
import { WorkoutSession } from '../models/WorkoutSession';
import { FoodLog } from '../models/FoodLog';
import { WaterLog } from '../models/WaterLog';
import { Goal } from '../models/Goal';
import { Progress } from '../models/Progress';
import { Notification } from '../models/Notification';
import { AIRecommendation } from '../models/AIRecommendation';
import { AIConversation } from '../models/AIConversation';
import { CommunityPost } from '../models/CommunityPost';
import { Meal } from '../models/Meal';
import { RefreshToken } from '../models/RefreshToken';
import { WORKOUTS } from './data/workouts';
import { YOGA_ROUTINES } from './data/yoga';
import { FOODS } from './data/foods';
import { ACHIEVEMENTS } from './data/achievements';
import { DEMO_PASSWORD, DEMO_USERS, type DemoProfile } from './demo-users';
import { isoDate, addDays, startOfDay } from '../utils/date';
import {
  bmiCategory,
  calculateBmi,
  calculateCalorieTarget,
  calculateWaterTarget,
  type ProfileMetrics,
} from '../utils/health';
import { rebuildDay, getStreak } from '../services/progress.service';
import { evaluateAchievements } from '../services/achievement.service';

const DAYS_OF_HISTORY = 45;

const flags = {
  reset: process.argv.includes('--reset'),
};

const counters: Record<string, number> = {
  workouts: 0,
  yoga: 0,
  foods: 0,
  achievements: 0,
  users: 0,
  sessions: 0,
  foodLogs: 0,
  waterLogs: 0,
  progressDays: 0,
  goals: 0,
  posts: 0,
};

function bump(counter: string, by = 1): void {
  counters[counter] = (counters[counter] ?? 0) + by;
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

async function seedWorkouts(): Promise<void> {
  for (const seed of WORKOUTS) {
    await Workout.findOneAndUpdate(
      { slug: seed.slug },
      { $set: seed },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
    bump('workouts');
  }
}

async function seedYoga(): Promise<void> {
  for (const seed of YOGA_ROUTINES) {
    await Yoga.findOneAndUpdate(
      { slug: seed.slug },
      { $set: seed },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
    bump('yoga');
  }
}

async function seedFoods(): Promise<void> {
  for (const seed of FOODS) {
    await Food.findOneAndUpdate(
      { slug: seed.slug },
      { $set: seed },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
    bump('foods');
  }
}

async function seedAchievements(): Promise<void> {
  for (const seed of ACHIEVEMENTS) {
    await Achievement.findOneAndUpdate(
      { key: seed.key },
      { $set: seed },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
    bump('achievements');
  }
}

/* ------------------------------------------------------------------ */
/* Demo accounts                                                       */
/* ------------------------------------------------------------------ */

/** Deterministic PRNG so re-seeding produces byte-identical demo history. */
function makeRandom(seedText: string): () => number {
  let state = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    state = (state * 31 + seedText.charCodeAt(i)) & 0x7fffffff;
  }
  state = state === 0 ? 1 : state;

  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

interface Catalogues {
  workouts: Array<{
    _id: mongoose.Types.ObjectId;
    title: string;
    category: string;
    durationMinutes: number;
  }>;
  yoga: Array<{ _id: mongoose.Types.ObjectId; title: string; durationMinutes: number }>;
  foods: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    category: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    servings: Array<{ name: string; grams: number; isDefault: boolean }>;
    defaultServingGrams: number;
  }>;
}

async function loadCatalogues(): Promise<Catalogues> {
  const [workouts, yoga, foods] = await Promise.all([
    Workout.find({ isActive: true }).select('_id title category durationMinutes').lean(),
    Yoga.find({ isActive: true }).select('_id title durationMinutes').lean(),
    Food.find({ isActive: true, isCommon: true })
      .select(
        '_id name category calories proteinG carbsG fatG fiberG sugarG sodiumMg servings defaultServingGrams',
      )
      .lean(),
  ]);

  return { workouts, yoga, foods } as Catalogues;
}

/**
 * Writes one day's worth of history for a demo account in bulk (one insert per
 * collection per user), then asks `rebuildDay()` to derive the rollups.
 */
async function seedHistory(
  profile: DemoProfile,
  userId: mongoose.Types.ObjectId,
  catalogues: Catalogues,
): Promise<void> {
  const random = makeRandom(profile.email);
  const sessions: Record<string, unknown>[] = [];
  const foodLogs: Record<string, unknown>[] = [];
  const waterLogs: Record<string, unknown>[] = [];
  const progress: Record<string, unknown>[] = [];
  const days: string[] = [];

  for (let daysAgo = DAYS_OF_HISTORY - 1; daysAgo >= 0; daysAgo -= 1) {
    const day = isoDate(addDays(new Date(), -daysAgo));
    const date = startOfDay(addDays(new Date(), -daysAgo));
    days.push(day);

    // A streak counts any day with a session, a food log, or water, so a demo
    // account that logs everything every day would show an absurd 45-day streak.
    // Roughly one day in eight is a genuine off day: no session, no food, no
    // water. That produces believable, varied streaks.
    const dayOff = random() < 0.13;

    // Training frequency climbs gently over the history window, landing at a
    // believable 4-5 sessions a week.
    const consistency = 0.42 + ((DAYS_OF_HISTORY - daysAgo) / DAYS_OF_HISTORY) * 0.22;

    if (!dayOff && random() < consistency && catalogues.workouts.length > 0) {
      // Resolve the session source explicitly rather than picking from a union,
      // so the workout and its category always come from the same document.
      const source: { id: mongoose.Types.ObjectId; title: string; category: string; durationMinutes: number } = (() => {
        if (random() < 0.25 && catalogues.yoga.length > 0) {
          const routine = pick(random, catalogues.yoga);
          return { id: routine._id, title: routine.title, category: 'yoga', durationMinutes: routine.durationMinutes };
        }
        const workout = pick(random, catalogues.workouts);
        return {
          id: workout._id,
          title: workout.title,
          category: workout.category,
          durationMinutes: workout.durationMinutes,
        };
      })();

      const earlyBird = random() < 0.2;
      const hour = earlyBird ? 5 + Math.floor(random() * 2) : 17 + Math.floor(random() * 5);
      const completedAt = new Date(date);
      completedAt.setHours(hour, Math.floor(random() * 60), 0, 0);

      const durationMinutes = Math.max(
        8,
        Math.round(source.durationMinutes * (0.75 + random() * 0.4)),
      );

      sessions.push({
        userId,
        workoutId: source.category === 'yoga' ? undefined : source.id,
        yogaId: source.category === 'yoga' ? source.id : undefined,
        title: source.title,
        category: source.category,
        status: 'completed',
        startedAt: new Date(completedAt.getTime() - durationMinutes * 60_000),
        completedAt,
        durationMinutes,
        // MET-derived estimate; deliberately approximate.
        caloriesBurned: Math.round(durationMinutes * (6 + random() * 3)),
        exercisesCompleted: source.category === 'yoga' ? 0 : 6 + Math.floor(random() * 4),
        exercisesTotal: source.category === 'yoga' ? 0 : 10,
        difficulty: profile.fitnessLevel,
        perceivedEffort: 4 + Math.floor(random() * 4),
        notes: '',
        day,
      });
    }

    // Nutrition: 3-5 entries, some of which are snacks. Skipped on off days.
    const logCount = dayOff ? 0 : 3 + Math.floor(random() * 3);
    for (let i = 0; i < logCount && catalogues.foods.length > 0; i += 1) {
      const food = pick(random, catalogues.foods);
      const serving = food.servings.find((s) => s.isDefault) ?? food.servings[0];
      const servingGrams = serving?.grams ?? food.defaultServingGrams;
      const grams = Math.max(20, Math.round(servingGrams * (0.6 + random() * 0.9)));
      const factor = grams / 100;

      const isSnack = i > 0 && random() < 0.3;
      const mealType = isSnack ? 'snack' : i === 0 ? 'breakfast' : i < logCount - 1 ? 'lunch' : 'dinner';
      const eatenAt = new Date(date);
      eatenAt.setHours(Math.min(21, 8 + i * 3 + Math.floor(random() * 2)), Math.floor(random() * 60), 0, 0);

      foodLogs.push({
        userId,
        foodId: food._id,
        foodName: food.name,
        foodCategory: food.category,
        mealType,
        servings: Math.round((grams / servingGrams) * 100) / 100,
        servingName: serving?.name ?? `${grams} g`,
        grams,
        nutrition: {
          calories: Math.round(food.calories * factor),
          proteinG: Math.round(food.proteinG * factor * 10) / 10,
          carbsG: Math.round(food.carbsG * factor * 10) / 10,
          fatG: Math.round(food.fatG * factor * 10) / 10,
          fiberG: Math.round(food.fiberG * factor * 10) / 10,
          sugarG: Math.round(food.sugarG * factor * 10) / 10,
          sodiumMg: Math.round(food.sodiumMg * factor),
        },
        eatenAt,
        day,
        notes: '',
      });
    }

    // Water: 4-8 additions spread through the day. Skipped on off days so the
    // streak has real gaps.
    const waterAdds = dayOff ? 0 : 4 + Math.floor(random() * 5);
    for (let i = 0; i < waterAdds; i += 1) {
      const loggedAt = new Date(date);
      loggedAt.setHours(7 + i * 2, Math.floor(random() * 60), 0, 0);
      waterLogs.push({
        userId,
        amountMl: pick(random, [200, 250, 300, 330, 500]),
        source: pick(random, ['quick_add', 'bottle', 'custom'] as const),
        loggedAt,
        day,
      });
    }

    // Weight drifts gradually towards the target rather than jumping, with
    // day-to-day noise on top.
    const t = (DAYS_OF_HISTORY - daysAgo) / DAYS_OF_HISTORY;
    const drift = profile.weightKg + (profile.targetWeightKg - profile.weightKg) * t * 0.7;
    const weightKg = Math.round((drift + (random() - 0.5) * 0.6) * 10) / 10;

    const metrics: ProfileMetrics = {
      heightCm: profile.heightCm,
      weightKg,
      age: profile.age,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
    };

    progress.push({
      userId,
      day,
      weightKg,
      bmi: calculateBmi(weightKg, profile.heightCm),
      calorieTarget: calculateCalorieTarget(metrics, profile.goals),
      waterTargetMl: calculateWaterTarget(weightKg, profile.activityLevel),
      goalMinutesTarget: profile.preferredWorkoutMinutes,
    });
  }

  await Promise.all([
    WorkoutSession.insertMany(sessions),
    FoodLog.insertMany(foodLogs),
    WaterLog.insertMany(waterLogs),
    Progress.insertMany(progress),
  ]);

  bump('sessions', sessions.length);
  bump('foodLogs', foodLogs.length);
  bump('waterLogs', waterLogs.length);
  bump('progressDays', progress.length);

  // Derive every day through the production rollup so stored progress matches
  // exactly what the API would have computed from the same raw logs.
  for (const day of days) {
    await rebuildDay(userId.toString(), day);
  }
}

async function seedGoals(profile: DemoProfile, userId: mongoose.Types.ObjectId): Promise<void> {
  const waterTarget = calculateWaterTarget(profile.weightKg, profile.activityLevel);
  const weightBaseline = profile.weightKg;

  const goals = [
    {
      title: 'Reach target weight',
      goalType: 'weight_loss' as const,
      targetValue: profile.targetWeightKg,
      unit: 'kg',
      source: 'weight' as const,
      baselineValue: weightBaseline,
    },
    {
      title: 'Train 4 times this week',
      goalType: 'general_fitness' as const,
      targetValue: 4,
      unit: 'sessions',
      source: 'workout_count' as const,
      baselineValue: 0,
    },
    {
      title: 'Hit the daily water target',
      goalType: 'better_lifestyle' as const,
      targetValue: waterTarget,
      unit: 'ml',
      source: 'water_ml' as const,
      baselineValue: 0,
    },
  ];

  // Progress is left at 0 so each goal opens at its baseline; the app's own
  // sync fills in real values on first read.
  await Goal.insertMany(
    goals.map((goal) => ({
      userId,
      title: goal.title,
      description: '',
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      unit: goal.unit,
      source: goal.source,
      baselineValue: goal.baselineValue,
      currentValue: goal.baselineValue,
      progressPercent: 0,
      status: 'active' as const,
    })),
  );
  bump('goals', goals.length);
}

async function seedDemoUsers(catalogues: Catalogues): Promise<void> {
  for (const profile of DEMO_USERS) {
    const metrics: ProfileMetrics = {
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      age: profile.age,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
    };
    const bmi = calculateBmi(profile.weightKg, profile.heightCm);

    // The pre-save hash hook does not run for updates, so the password is
    // hashed explicitly here.
    const user = await User.findOneAndUpdate(
      { email: profile.email },
      {
        $set: {
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          targetWeightKg: profile.targetWeightKg,
          fitnessLevel: profile.fitnessLevel,
          activityLevel: profile.activityLevel,
          goals: profile.goals,
          preferredWorkoutLocation: profile.preferredWorkoutLocation,
          preferredDays: profile.preferredDays,
          preferredWorkoutMinutes: profile.preferredWorkoutMinutes,
          dietPreference: profile.dietPreference,
          allergies: profile.allergies,
          dislikedFoods: profile.dislikedFoods,
          bmi,
          bmiCategory: bmiCategory(bmi),
          dailyCalorieTarget: calculateCalorieTarget(metrics, profile.goals),
          dailyWaterTargetMl: calculateWaterTarget(profile.weightKg, profile.activityLevel),
          onboardingCompleted: true,
          onboardingStep: 'done',
          isActive: true,
        },
        $setOnInsert: { email: profile.email },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
    bump('users');

    // `password` is `select: false`, so it is set through a document save to
    // trigger the model's hashing hook.
    user.password = DEMO_PASSWORD;
    await user.save();

    // Demo history is wiped and regenerated on every run. `seedHistory()` draws
    // from a PRNG seeded by the user's email, so the result is deterministic:
    // repeated runs converge on identical data, and a half-finished run from a
    // previous failure is repaired instead of colliding with itself.
    await Promise.all([
      WorkoutSession.deleteMany({ userId: user._id }),
      FoodLog.deleteMany({ userId: user._id }),
      WaterLog.deleteMany({ userId: user._id }),
      Progress.deleteMany({ userId: user._id }),
      Goal.deleteMany({ userId: user._id }),
      UserAchievement.deleteMany({ userId: user._id }),
      Notification.deleteMany({ userId: user._id }),
      AIRecommendation.deleteMany({ userId: user._id }),
      AIConversation.deleteMany({ userId: user._id }),
      Meal.deleteMany({ userId: user._id }),
      RefreshToken.deleteMany({ userId: user._id }),
      CommunityPost.deleteMany({ userId: user._id }),
    ]);

    await seedHistory(profile, user._id, catalogues);
    await seedGoals(profile, user._id);

    // Streak and lifetime counters are derived, never invented.
    const streak = await getStreak(user._id.toString());
    const totals = await WorkoutSession.aggregate<{
      total: number;
      minutes: number;
      yoga: number;
    }>([
      { $match: { userId: user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          minutes: { $sum: '$durationMinutes' },
          yoga: { $sum: { $cond: [{ $eq: ['$category', 'yoga'] }, 1, 0] } },
        },
      },
    ]);

    const latest = await Progress.findOne({ userId: user._id }).sort({ day: -1 }).select('weightKg').lean();

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          streak: streak.current,
          longestStreak: streak.longest,
          lastActiveDate: streak.lastActiveDay ? new Date(streak.lastActiveDay) : null,
          totalWorkouts: (totals[0]?.total ?? 0) - (totals[0]?.yoga ?? 0),
          totalYogaSessions: totals[0]?.yoga ?? 0,
          totalWorkoutMinutes: totals[0]?.minutes ?? 0,
          weightKg: latest?.weightKg ?? profile.weightKg,
        },
      },
    );

    await evaluateAchievements(user._id.toString());
  }
}

async function seedCommunity(): Promise<void> {
  const people = await User.find({ email: { $in: DEMO_USERS.map((u) => u.email) } })
    .select('_id name avatarUrl email')
    .lean();
  const byEmail = new Map(people.map((person) => [person.email, person]));

  const posts = [
    {
      email: DEMO_USERS[0]!.email,
      content:
        'Six weeks in and the 20 minute HIIT is the only thing that reliably fits my morning. Consistency finally clicked.',
      postType: 'update',
      category: 'cardio',
    },
    {
      email: DEMO_USERS[1]!.email,
      content:
        'Any tips for sitting pigeon pose without my hip screaming? Been doing evening mobility for a week and this is the only thing I still dread.',
      postType: 'question',
      category: 'flexibility',
    },
    {
      email: DEMO_USERS[2]!.email,
      content: 'Finally hit a 100 kg deadlift today. Two years of boring progressive overload. Boring works.',
      postType: 'achievement',
      category: 'strength',
    },
    {
      email: DEMO_USERS[0]!.email,
      content:
        'Reminder that the best routine is the one you will still do on a bad day. 10 minutes counts. Especially the 10 minutes.',
      postType: 'tip',
      category: 'general',
    },
  ] as const;

  for (const post of posts) {
    const author = byEmail.get(post.email);
    if (!author) continue;

    await CommunityPost.findOneAndUpdate(
      { userId: author._id, content: post.content },
      {
        $set: {
          authorName: author.name,
          authorAvatarUrl: author.avatarUrl ?? null,
          postType: post.postType,
          category: post.category,
          likes: [],
          likeCount: 0,
          comments: [],
          commentCount: 0,
          isHidden: false,
        },
        $setOnInsert: { userId: author._id, content: post.content },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    bump('posts');
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

async function resetDatabase(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
  logger.warn(`Cleared ${collections.length} collections`);
}

async function buildIndexes(): Promise<void> {
  for (const model of Object.values(mongoose.models)) {
    try {
      await model.createIndexes();
    } catch (error) {
      logger.warn('Index creation failed', { model: model.modelName, error });
    }
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  logger.info('Seeding MEPro database', { reset: flags.reset });
  await connectDatabase();

  if (flags.reset) await resetDatabase();

  await seedWorkouts();
  await seedYoga();
  await seedFoods();
  await seedAchievements();

  const catalogues = await loadCatalogues();
  await seedDemoUsers(catalogues);
  await seedCommunity();
  await buildIndexes();

  const row = (label: string, key: string): string =>
    `    ${label.padEnd(19)}${String(counters[key] ?? 0).padStart(5)}`;

  console.log('');
  console.log('  Catalogue');
  console.log(row('workouts', 'workouts'));
  console.log(row('yoga routines', 'yoga'));
  console.log(row('foods', 'foods'));
  console.log(row('achievements', 'achievements'));
  console.log('  Demo data');
  console.log(row('users', 'users'));
  console.log(row('workout sessions', 'sessions'));
  console.log(row('food logs', 'foodLogs'));
  console.log(row('water logs', 'waterLogs'));
  console.log(row('progress days', 'progressDays'));
  console.log(row('goals', 'goals'));
  console.log(row('community posts', 'posts'));
  console.log('');
  console.log(`  Sign in with any of these (password: ${DEMO_PASSWORD})`);
  for (const user of DEMO_USERS) {
    console.log(`    ${user.email.padEnd(20)} ${user.name}`);
  }
  console.log('');
  logger.info('Seed complete', { seconds: ((Date.now() - startedAt) / 1000).toFixed(1) });
}

main()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logger.error('Seed failed', { error });
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });
