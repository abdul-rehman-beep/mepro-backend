/**
 * Post-seed integrity checks. Verifies the invariants the app depends on, so a
 * bad seed fails loudly here rather than as a confusing UI bug later.
 *
 *   npm run verify:seed
 */

import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { logger } from '../src/utils/logger';
import { Workout } from '../src/models/Workout';
import { Yoga } from '../src/models/Yoga';
import { Food } from '../src/models/Food';
import { Achievement, UserAchievement } from '../src/models/Achievement';
import { User } from '../src/models/User';
import { WorkoutSession } from '../src/models/WorkoutSession';
import { FoodLog } from '../src/models/FoodLog';
import { WaterLog } from '../src/models/WaterLog';
import { Goal } from '../src/models/Goal';
import { Progress } from '../src/models/Progress';
import { CommunityPost } from '../src/models/CommunityPost';
import { goalProgressPercent } from '../src/models/Goal';
import { DEMO_PASSWORD, DEMO_USERS } from '../src/seed/demo-users';
import { comparePassword } from '../src/models/User';

const DEMO_EMAILS = DEMO_USERS.map((u) => u.email);

const failures: string[] = [];

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ''}`);
    failures.push(label);
  }
}

async function main(): Promise<void> {
  await connectDatabase();

  console.log('\nCatalogue');
  const [workoutCount, yogaCount, foodCount, achievementCount] = await Promise.all([
    Workout.countDocuments(),
    Yoga.countDocuments(),
    Food.countDocuments(),
    Achievement.countDocuments(),
  ]);
  check('workouts seeded', workoutCount >= 10, `${workoutCount}`);
  check('yoga routines seeded', yogaCount >= 5, `${yogaCount}`);
  check('foods seeded', foodCount >= 50, `${foodCount}`);
  check('achievements seeded', achievementCount >= 20, `${achievementCount}`);

  const dupWorkouts = await Workout.aggregate<{ n: number }>([
    { $group: { _id: '$slug', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'n' },
  ]);
  check('workout slugs unique', (dupWorkouts[0]?.n ?? 0) === 0);

  const mealsWithExercises = await Workout.countDocuments({ exercises: { $size: 0 } });
  check('every workout has exercises', mealsWithExercises === 0, `${mealsWithExercises} empty`);

  const routinesWithAsanas = await Yoga.countDocuments({ asanas: { $size: 0 } });
  check('every routine has asanas', routinesWithAsanas === 0, `${routinesWithAsanas} empty`);

  // Dietary flags must not leak into dietTags (preferences) and vice versa.
  const glutenFreeRice = await Food.findOne({ slug: 'white-rice-cooked' }).lean();
  check(
    'dietTags hold preferences only',
    Boolean(glutenFreeRice) && glutenFreeRice!.dietTags.every((t) => DIET_PREFERENCE_SET.has(t)),
    glutenFreeRice?.dietTags.join(','),
  );
  const cornTortilla = await Food.findOne({ slug: 'corn-tortilla' }).lean();
  check(
    'gluten_free routed to dietaryFlags',
    cornTortilla?.dietaryFlags.includes('gluten_free') === true &&
      !cornTortilla!.dietTags.includes('gluten_free'),
    cornTortilla?.dietaryFlags.join(','),
  );

  console.log('\nSession integrity');
  const yogaSessions = await WorkoutSession.countDocuments({ category: 'yoga' });
  const yogaWithYogaId = await WorkoutSession.countDocuments({
    category: 'yoga',
    yogaId: { $exists: true },
    workoutId: { $exists: false },
  });
  check('yoga sessions use yogaId only', yogaSessions === yogaWithYogaId, `${yogaWithYogaId}/${yogaSessions}`);

  const workoutSessions = await WorkoutSession.countDocuments({ category: { $ne: 'yoga' } });
  const workoutsWithWorkoutId = await WorkoutSession.countDocuments({
    category: { $ne: 'yoga' },
    workoutId: { $exists: true },
    yogaId: { $exists: false },
  });
  check(
    'workout sessions use workoutId only',
    workoutSessions === workoutsWithWorkoutId,
    `${workoutsWithWorkoutId}/${workoutSessions}`,
  );

  const yogaIds = (await Yoga.find().select('_id').lean()).map((y) => y._id);
  const danglingYoga = await WorkoutSession.countDocuments({
    yogaId: { $exists: true, $nin: yogaIds },
  });
  check('no dangling yogaId references', danglingYoga === 0, `${danglingYoga}`);

  const workoutIds = (await Workout.find().select('_id').lean()).map((w) => w._id);
  const danglingWorkout = await WorkoutSession.countDocuments({
    workoutId: { $exists: true, $nin: workoutIds },
  });
  check('no dangling workoutId references', danglingWorkout === 0, `${danglingWorkout}`);

  const untitled = await WorkoutSession.countDocuments({ $or: [{ title: '' }, { title: { $exists: false } }] });
  check('every session has a title', untitled === 0, `${untitled} untitled`);

  console.log('\nDemo accounts');
  const users = await User.find({ email: { $in: [...DEMO_EMAILS] } }).lean();
  check('all demo users exist', users.length === DEMO_EMAILS.length, `${users.length}/${DEMO_EMAILS.length}`);

  for (const user of users) {
    const withPassword = await User.findOne({ email: user.email }).select('+password');
    const loginOk = withPassword ? await comparePassword(DEMO_PASSWORD, withPassword.password) : false;
    check(`${user.email} can sign in`, loginOk);
  }

  for (const user of users) {
    const [sessions, foodLogs, waterLogs, progress, goals, earned] = await Promise.all([
      WorkoutSession.countDocuments({ userId: user._id }),
      FoodLog.countDocuments({ userId: user._id }),
      WaterLog.countDocuments({ userId: user._id }),
      Progress.countDocuments({ userId: user._id }),
      Goal.countDocuments({ userId: user._id }),
      UserAchievement.countDocuments({ userId: user._id }),
    ]);

    check(`${user.email} has history`, sessions > 0 && foodLogs > 0 && progress > 0, `${sessions} sessions`);
    check(`${user.email} has goals`, goals === 3, `${goals}`);
    check(`${user.email} earned badges`, earned > 0, `${earned}`);

    // Streak counters must agree with the raw logs.
    const activeDays = new Set(
      (
        await WorkoutSession.find({ userId: user._id, status: 'completed' }).select('day').lean()
      ).map((s) => s.day),
    );
    check(
      `${user.email} streak is plausible`,
      user.streak > 0 && user.streak <= Math.max(activeDays.size, 1),
      `streak=${user.streak} activeDays=${activeDays.size}`,
    );
  }

  console.log('\nGoal progress arithmetic');
  const goals = await Goal.find().lean();
  const mismatched = goals.filter(
    (g) => g.source === 'manual' && g.progressPercent !== goalProgressPercent(g.baselineValue, g.currentValue, g.targetValue),
  );
  check('stored progressPercent matches baseline arithmetic', mismatched.length === 0, `${mismatched.length} mismatched`);

  const overComplete = goals.filter((g) => g.progressPercent > 100);
  check('no goal exceeds 100%', overComplete.length === 0, `${overComplete.length} over`);

  const weightGoals = goals.filter((g) => g.source === 'weight');
  const badBaseline = weightGoals.filter((g) => g.baselineValue <= 0);
  check('weight goals captured a baseline', badBaseline.length === 0, `${weightGoals.length} weight goals`);

  console.log('\nCommunity');
  const posts = await CommunityPost.countDocuments();
  check('community feed has content', posts >= 3, `${posts} posts`);

  console.log('\nWater consistency');
  const sampleDay = await Progress.findOne({ waterMl: { $gt: 0 } }).sort({ day: -1 }).lean();
  if (sampleDay) {
    const logged = await WaterLog.aggregate<{ total: number }>([
      { $match: { userId: sampleDay.userId, day: sampleDay.day } },
      { $group: { _id: null, total: { $sum: '$amountMl' } } },
    ]);
    check(
      'rolled-up water matches raw logs',
      (logged[0]?.total ?? 0) === sampleDay.waterMl,
      `${logged[0]?.total ?? 0} vs ${sampleDay.waterMl}`,
    );
  }

  console.log('');
  if (failures.length > 0) {
    logger.error(`${failures.length} check(s) failed`, { failures });
    await disconnectDatabase();
    process.exit(1);
  }

  console.log('All seed integrity checks passed.');
  await disconnectDatabase();
  process.exit(0);
}

const DIET_PREFERENCE_SET = new Set([
  'vegetarian',
  'non_vegetarian',
  'vegan',
  'pescatarian',
  'eggetarian',
]);

void main();
