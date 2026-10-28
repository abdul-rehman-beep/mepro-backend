import mongoose from 'mongoose';
import { Workout } from '../../models/Workout';
import { Yoga } from '../../models/Yoga';
import { User } from '../../models/User';
import { isoDate, startOfDay, addDays } from '../../utils/date';
import { calculateWaterTarget } from '../../utils/health';
import { Progress } from '../../models/Progress';
import { WorkoutSession } from '../../models/WorkoutSession';
import type {
  ActivityLevel,
  FitnessLevel,
  GoalType,
  WorkoutCategory,
  WorkoutLocation,
  YogaCategory,
} from '../../types/enums';

/**
 * Deterministic recommendation engine.
 *
 * This is not a degraded mode bolted on afterwards — it is the floor the system
 * always has. Every rule here is an `IF/THEN` over the user's own data, so it
 * is explainable, instant, testable, and always available even with no model
 * loaded, no network, and no GPU.
 */

export interface UserContext {
  userId: string;
  name: string;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bmiCategory: string | null;
  fitnessLevel: FitnessLevel | null;
  activityLevel: ActivityLevel;
  goals: GoalType[];
  dietPreference: string | null;
  allergies: string[];
  preferredWorkoutMinutes: number;
  preferredWorkoutLocation: WorkoutLocation[];
  dailyCalorieTarget: number;
  dailyWaterTargetMl: number;
  streak: number;
  totalWorkouts: number;
  lastWorkoutDaysAgo: number | null;
  workoutsThisWeek: number;
  averageSessionMinutes: number;
  nutritionLoggedDays: number;
  waterCompliancePercent: number;
  hasCompletedOnboarding: boolean;
  /** How many meals a day the user prefers; used to structure diet advice. */
  mealCount: number;
}

export interface Recommendation {
  type: 'workout' | 'nutrition' | 'hydration' | 'yoga' | 'overall';
  title: string;
  reason: string;
  recommendation: string;
  nextAction: string;
  motivation: string;
  confidence: number;
  provider: 'transformers' | 'rules';
  relatedIds: string[];
  relatedLabel: string | null;
}

/** Loads everything the rules need in a fixed number of indexed queries. */
export async function buildUserContext(userId: string): Promise<UserContext> {
  const userIdObject = new mongoose.Types.ObjectId(String(userId));
  const weekAgo = startOfDay(addDays(new Date(), -6));

  const [user, weekSessions, latestSession, nutritionDays, waterRows, average] = await Promise.all([
    User.findById(userId).lean(),
    WorkoutSession.find({
      userId,
      status: 'completed',
      completedAt: { $gte: weekAgo },
    })
      .select('durationMinutes category')
      .lean(),
    WorkoutSession.findOne({ userId, status: 'completed' })
      .sort({ completedAt: -1 })
      .select('completedAt')
      .lean(),
    Progress.find({ userId, foodLogs: { $gt: 0 } }).select('day').lean(),
    Progress.find({ userId }).select('day waterMl').sort({ day: -1 }).limit(7).lean(),
    WorkoutSession.aggregate<{ avg: number }>([
      { $match: { userId: userIdObject, status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$durationMinutes' } } },
    ]),
  ]);

  if (!user) throw new Error('User not found while building AI context');

  const lastWorkoutDaysAgo = latestSession?.completedAt
    ? Math.floor((Date.now() - new Date(latestSession.completedAt).getTime()) / 86_400_000)
    : null;

  const waterTarget = user.dailyWaterTargetMl ?? 2000;
  const waterCompliancePercent = waterRows.length
    ? Math.round(
        (waterRows.filter((row) => (row.waterMl ?? 0) >= waterTarget).length / waterRows.length) * 100,
      )
    : 0;

  return {
    userId,
    name: user.name,
    age: user.age ?? null,
    gender: (user.gender ?? null) as UserContext['gender'],
    heightCm: user.heightCm ?? null,
    weightKg: user.weightKg ?? null,
    bmi: user.bmi ?? null,
    bmiCategory: user.bmiCategory ?? null,
    fitnessLevel: (user.fitnessLevel ?? null) as FitnessLevel | null,
    activityLevel: (user.activityLevel ?? 'moderate') as ActivityLevel,
    goals: (user.goals ?? []) as GoalType[],
    dietPreference: user.dietPreference ?? null,
    allergies: user.allergies ?? [],
    preferredWorkoutMinutes: user.preferredWorkoutMinutes ?? 30,
    preferredWorkoutLocation: (user.preferredWorkoutLocation ?? []) as WorkoutLocation[],
    dailyCalorieTarget: user.dailyCalorieTarget ?? 2000,
    dailyWaterTargetMl: waterTarget,
    streak: user.streak ?? 0,
    totalWorkouts: user.totalWorkouts ?? 0,
    lastWorkoutDaysAgo,
    workoutsThisWeek: weekSessions.length,
    averageSessionMinutes: Math.round(average[0]?.avg ?? 0),
    nutritionLoggedDays: nutritionDays.length,
    waterCompliancePercent,
    hasCompletedOnboarding: Boolean(user.onboardingCompleted),
    mealCount: user.mealCount ?? 3,
  };
}

/** Greeting-aware, non-punitive openers. Never implies the user failed. */
const MOTIVATIONS = [
  'Consistency matters more than intensity. Showing up today is the win.',
  'Small, repeatable steps beat occasional heroics every time.',
  'Your body adapts to the sessions you actually do, not the ones you plan.',
  'Progress is rarely linear. A steady week is a successful week.',
  'You do not need a perfect day, just a next one.',
  'Rest days are part of the plan, not a break from it.',
];

function pickMotivation(seed: number): string {
  return MOTIVATIONS[Math.abs(seed) % MOTIVATIONS.length];
}

function nameSeed(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return hash;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? 'there';
}

/** Picks the training focus implied by the user's goals. */
function categoriesForGoals(goals: GoalType[]): WorkoutCategory[] {
  if (goals.includes('weight_loss')) return ['cardio', 'hiit', 'full_body'];
  if (goals.includes('muscle_gain')) return ['strength', 'upper_body', 'lower_body'];
  if (goals.includes('flexibility')) return ['mobility', 'stretching', 'yoga' as unknown as WorkoutCategory];
  if (goals.includes('stress_reduction')) return ['mobility', 'stretching'];
  if (goals.includes('general_fitness') || goals.includes('better_lifestyle')) return ['full_body', 'cardio', 'strength'];
  return ['full_body', 'cardio'];
}

export async function ruleBasedWorkoutRecommendation(context: UserContext): Promise<Recommendation | null> {
  const { fitnessLevel, goals, lastWorkoutDaysAgo, workoutsThisWeek, preferredWorkoutMinutes } = context;

  // Rest-recovery: several days off means a lighter session, not a punishing one.
  if (lastWorkoutDaysAgo !== null && lastWorkoutDaysAgo >= 4) {
    const workout = await pickWorkout({
      difficulty: fitnessLevel ?? 'beginner',
      categories: categoriesForGoals(goals),
      maxDuration: Math.max(15, Math.min(preferredWorkoutMinutes, 30)),
    });

    return {
      type: 'workout',
      title: 'Gentle Restart Session',
      reason: `It has been ${lastWorkoutDaysAgo} days since your last session, so a lighter entry is a good way to resume.`,
      recommendation: `Try a short ${workout?.durationMinutes ?? 25} minute ${workout?.title ?? 'full body mobility'} routine at an easy pace. The goal today is to move, not to set records.`,
      nextAction: 'Open Workouts and start the recommended session',
      motivation: pickMotivation(nameSeed(context.name)),
      confidence: 0.74,
      provider: 'rules',
      relatedIds: workout ? [workout.id] : [],
      relatedLabel: workout?.title ?? null,
    };
  }

  // New user: meet them where they are.
  if (context.totalWorkouts === 0) {
    const workout = await pickWorkout({
      difficulty: 'beginner',
      categories: ['full_body', 'mobility'],
      maxDuration: 20,
    });

    return {
      type: 'workout',
      title: 'Your First Full Body Session',
      reason: 'You have not logged a completed workout yet, so the best first step is a short, low-skill session.',
      recommendation: `Start with a ${workout?.durationMinutes ?? 20} minute beginner full body routine. Use the instructions on each exercise and stop a set early if your form breaks down.`,
      nextAction: 'Start the beginner session in Workouts',
      motivation: pickMotivation(nameSeed(context.name)),
      confidence: 0.8,
      provider: 'rules',
      relatedIds: workout ? [workout.id] : [],
      relatedLabel: workout?.title ?? null,
    };
  }

  // Weekly volume: 4+ sessions means suggest recovery or a change of focus.
  if (workoutsThisWeek >= 4) {
    return {
      type: 'workout',
      title: 'Recovery and Progression Week',
      reason: `You have already completed ${workoutsThisWeek} sessions this week, which is a solid training load.`,
      recommendation:
        'Add one active recovery session this week, such as mobility work or a beginner yoga routine. Keep at least one full rest day to let muscles repair.',
      nextAction: 'Browse the Yoga tab for a recovery routine',
      motivation: pickMotivation(nameSeed(context.name)),
      confidence: 0.71,
      provider: 'rules',
      relatedIds: [],
      relatedLabel: null,
    };
  }

  // Under-training: push toward consistency.
  if (workoutsThisWeek <= 1) {
    const workout = await pickWorkout({
      difficulty: (fitnessLevel ?? 'beginner') as never,
      categories: categoriesForGoals(goals),
      maxDuration: preferredWorkoutMinutes,
    });

    return {
      type: 'workout',
      title: 'Add One More Session This Week',
      reason: `You have trained ${workoutsThisWeek === 0 ? 'not at all' : 'once'} in the last seven days.`,
      recommendation: `Aim for one more ${preferredWorkoutMinutes} minute session this week. ${goalPhrase(goals)} A short session counts even on a busy day.`,
      nextAction: 'Schedule a session from Workouts',
      motivation: pickMotivation(nameSeed(context.name)),
      confidence: 0.7,
      provider: 'rules',
      relatedIds: workout ? [workout.id] : [],
      relatedLabel: workout?.title ?? null,
    };
  }

  // On track: keep the user in the right focus area.
  const workout = await pickWorkout({
    difficulty: (fitnessLevel ?? 'intermediate') as never,
    categories: categoriesForGoals(goals),
    maxDuration: preferredWorkoutMinutes,
  });

  return {
    type: 'workout',
    title: `${capitalise(workout?.category?.replace('_', ' ') ?? 'Full Body')} Focus Session`,
    reason: `You are on a ${workoutsThisWeek} session rhythm this week, which matches your ${goalLabel(goals)}.`,
    recommendation: `Continue with a ${workout?.durationMinutes ?? preferredWorkoutMinutes} minute ${workout?.title ?? 'focused'} session. Keep your intensity steady rather than increasing it.`,
    nextAction: 'Start this session when you are ready',
    motivation: pickMotivation(nameSeed(context.name)),
    confidence: 0.76,
    provider: 'rules',
    relatedIds: workout ? [workout.id] : [],
    relatedLabel: workout?.title ?? null,
  };
}

export async function ruleBasedYogaRecommendation(context: UserContext): Promise<Recommendation> {
  const hour = new Date().getUTCHours();
  const timeOfDay = hour < 11 ? 'morning' : hour >= 17 ? 'evening' : 'anytime';

  const goals = context.goals;
  let category: YogaCategory = 'beginner';
  if (goals.includes('flexibility')) category = 'flexibility';
  else if (goals.includes('stress_reduction')) category = 'stress_relief';
  else if (timeOfDay === 'morning') category = 'morning';
  else if (timeOfDay === 'evening') category = 'evening';

  const routine = await Yoga.findOne({
    isActive: true,
    category,
    ...(context.fitnessLevel ? { difficulty: context.fitnessLevel } : {}),
  }).lean();

  return {
    type: 'yoga',
    title: `${timeOfDay === 'anytime' ? 'Yoga' : capitalise(timeOfDay)} Yoga Flow`,
    reason: `Your goals include ${goals.map((goal) => goalLabel(goal)).join(', ') || 'general wellness'}, and a ${category.replace('_', ' ')} flow matches that.`,
    recommendation: `${routine ? `"${routine.title}" runs ${routine.durationMinutes} minutes.` : `A ${category.replace('_', ' ')} routine fits today.`} Breathe slowly, never force a stretch, and skip any pose that causes pain.`,
    nextAction: 'Open the Yoga tab to start',
    motivation: pickMotivation(nameSeed(context.name)),
    confidence: 0.69,
    provider: 'rules',
    relatedIds: routine ? [routine._id.toString()] : [],
    relatedLabel: routine?.title ?? null,
  };
}

export async function ruleBasedNutritionRecommendation(context: UserContext): Promise<Recommendation> {
  const target = context.dailyCalorieTarget;
  const { nutritionLoggedDays, goals, dietPreference } = context;

  const proteinTarget = Math.round((context.weightKg ?? 70) * (goals.includes('muscle_gain') ? 1.8 : 1.6));
  const dietaryNote = dietPreference ? ` Your plan stays ${dietPreference.replace('_', ' ')}.` : '';
  const allergyNote = context.allergies.length
    ? ` Your meals avoid ${context.allergies.join(', ')}.`
    : '';

  const loggingNote =
    nutritionLoggedDays < 3
      ? ' Logging meals for three days in a row gives you a much clearer picture than a single day.'
      : ' You have been logging consistently, which is what makes these targets useful.';

  return {
    type: 'nutrition',
    title: `Around ${target.toLocaleString('en-US')} kcal a day`,
    reason: `That target is an estimate built from your height, weight, age, activity level and goals.${dietaryNote}`,
    recommendation: `Aim for roughly ${proteinTarget} g of protein, ${Math.round((target * 0.45) / 4)} g of carbohydrate and ${Math.round((target * 0.25) / 9)} g of fat each day, spread across your meals.${allergyNote}${loggingNote}`,
    nextAction: 'Review today in Nutrition',
    motivation: 'Food tracking is information, not judgement. A single off-plan meal changes nothing.',
    confidence: 0.72,
    provider: 'rules',
    relatedIds: [],
    relatedLabel: null,
  };
}

export async function ruleBasedHydrationRecommendation(context: UserContext): Promise<Recommendation> {
  const target = context.dailyWaterTargetMl;
  const litres = (target / 1000).toFixed(1);
  const compliance = context.waterCompliancePercent;

  const body =
    compliance >= 70
      ? `You met your hydration target on ${compliance}% of the last seven days.`
      : compliance > 0
        ? `You met your hydration target on ${compliance}% of the last seven days.`
        : 'There is no hydration data for the past week yet.';

  return {
    type: 'hydration',
    title: `Target ${litres} litres of water today`,
    reason: `${target} ml is based on your body weight and activity level, and adjusts as those change.`,
    recommendation: `Spread ${litres} litres across the day rather than drinking it all at once. A glass of water with each meal and before training is a simple way to get there. Increase it further on hot days or long training sessions.`,
    nextAction: 'Log your next glass in Hydration',
    motivation: pickMotivation(nameSeed(context.name)),
    confidence: 0.75,
    provider: 'rules',
    relatedIds: [],
    relatedLabel: null,
  };
}

export async function ruleBasedOverallRecommendation(context: UserContext): Promise<Recommendation> {
  if (!context.hasCompletedOnboarding) {
    return {
      type: 'overall',
      title: 'Finish setting up your profile',
      reason: 'Recommendations improve a lot once your height, weight, goals and preferences are set.',
      recommendation: 'Complete onboarding so calorie, hydration and workout suggestions are tailored to you.',
      nextAction: 'Finish onboarding',
      motivation: 'It takes two minutes and makes everything else more accurate.',
      confidence: 0.9,
      provider: 'rules',
      relatedIds: [],
      relatedLabel: null,
    };
  }

  const [workout, nutrition, hydration] = await Promise.all([
    ruleBasedWorkoutRecommendation(context),
    ruleBasedNutritionRecommendation(context),
    ruleBasedHydrationRecommendation(context),
  ]);

  const parts = [workout?.recommendation, nutrition.recommendation, hydration.recommendation].filter(Boolean);

  return {
    type: 'overall',
    title: `Your focus this week, ${firstName(context.name)}`,
    reason: 'This combines your training, nutrition and hydration patterns from the past week.',
    recommendation: parts.join(' '),
    nextAction: workout?.nextAction ?? 'Open your dashboard',
    motivation: workout?.motivation ?? pickMotivation(nameSeed(context.name)),
    confidence: 0.7,
    provider: 'rules',
    relatedIds: workout?.relatedIds ?? [],
    relatedLabel: workout?.relatedLabel ?? null,
  };
}

/** Chooses a catalogue workout that satisfies the constraints. */
async function pickWorkout(params: {
  difficulty: FitnessLevel | string;
  categories: WorkoutCategory[];
  maxDuration: number;
}): Promise<{ id: string; title: string; durationMinutes: number; category: string } | null> {
  const difficulty = String(params.difficulty);

  // Prefer an exact category + difficulty match, then relax in stages. Relaxing
  // guarantees a result even if the catalogue is thin.
  const attempts: Array<Record<string, unknown>> = [
    { isActive: true, difficulty, category: { $in: params.categories }, durationMinutes: { $lte: params.maxDuration } },
    { isActive: true, difficulty, durationMinutes: { $lte: params.maxDuration } },
    { isActive: true, isAnyOf: undefined, category: { $in: params.categories } },
    { isActive: true },
  ];

  for (const attempt of attempts) {
    const query = { ...attempt };
    delete query.isAnyOf;

    const workout = await Workout.findOne(query).sort({ popularity: -1 }).lean();
    if (workout) {
      return {
        id: workout._id.toString(),
        title: workout.title,
        durationMinutes: workout.durationMinutes,
        category: workout.category,
      };
    }
  }

  return null;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function goalPhrase(goals: GoalType[]): string {
  if (goals.includes('weight_loss')) return 'Steady cardio plus resistance work protects muscle while you are in a calorie deficit.';
  if (goals.includes('muscle_gain')) return 'Progressive resistance work with adequate protein drives the adaptation you want.';
  if (goals.includes('flexibility')) return 'Mobility work will support your flexibility goal directly.';
  if (goals.includes('stress_reduction')) return 'Keep the intensity moderate and use the breathing to unwind.';
  return 'Keep the mix varied so you cover strength, cardio and mobility across the week.';
}

/** Human-readable label for a single goal, or a joined phrase for several. */
function goalLabel(goal: GoalType | GoalType[]): string {
  const labels: Record<string, string> = {
    weight_loss: 'weight loss',
    weight_gain: 'weight gain',
    muscle_gain: 'muscle gain',
    general_fitness: 'general fitness',
    flexibility: 'flexibility',
    stress_reduction: 'stress reduction',
    better_lifestyle: 'a healthier lifestyle',
  };
  const render = (value: GoalType): string => labels[value] ?? value.replace('_', ' ');
  if (Array.isArray(goal)) return goal.map(render).join(' and ');
  return render(goal);
}

export function todayIso(): string {
  return isoDate(new Date());
}

export const RULE_ENGINE_VERSION = '1.0.0';
