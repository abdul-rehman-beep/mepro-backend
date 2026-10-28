import type { ActivityLevel, FitnessLevel, Gender, GoalType } from '../types/enums';

/**
 * All values in this module are *informational estimates* for general wellness
 * use. They are not medical advice and must never be presented as a diagnosis.
 * Callers are expected to surface the disclaimer alongside any result.
 */

export const HEALTH_DISCLAIMER =
  'These calculations are general wellness estimates based on population averages. ' +
  'They are not medical advice and are not a substitute for professional medical care.';

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  healthyRange: { min: number; max: number };
  disclaimer: string;
}

export type BmiCategory = 'Underweight' | 'Healthy weight' | 'Overweight' | 'Obesity';

export interface ProfileMetrics {
  heightCm: number;
  weightKg: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
}

/** BMI = weight(kg) / height(m)^2, rounded to 1 decimal. */
export function calculateBmi(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return round1(weightKg / (heightM * heightM));
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi <= 0) return 'Healthy weight';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy weight';
  if (bmi < 30) return 'Overweight';
  return 'Obesity';
}

export function computeBmi(weightKg: number, heightCm: number): BmiResult {
  const bmi = calculateBmi(weightKg, heightCm);
  return {
    bmi,
    category: bmiCategory(bmi),
    healthyRange: { min: 18.5, max: 24.9 },
    disclaimer: HEALTH_DISCLAIMER,
  };
}

/** Mifflin-St Jeor BMR (kcal/day). */
export function calculateBmr(metrics: ProfileMetrics): number {
  const base = 10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * metrics.age;
  // Population averages: males average ~5% more lean mass than females.
  const genderConstant = metrics.gender === 'male' ? 5 : metrics.gender === 'female' ? -161 : -78;
  return Math.max(0, Math.round(base + genderConstant));
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateTdee(metrics: ProfileMetrics): number {
  return Math.round(calculateBmr(metrics) * ACTIVITY_MULTIPLIERS[metrics.activityLevel]);
}

// Conservative guardrails for an adult-facing target. These are not medical
// limits: a small, sedentary or very young profile can compute below the floor,
// and the product must never surface that number.
const MIN_CALORIE_TARGET = 1200;
const MAX_CALORIE_TARGET = 5000;

/** Adjusts a maintenance target toward the user's stated goal. */
export function applyGoalAdjustment(maintenance: number, goals: GoalType[]): number {
  if (goals.length === 0) {
    // Still clamp: the early return used to bypass the floor entirely, so a
    // light or young profile could be told to eat under 1200 kcal.
    return clamp(Math.round(maintenance), MIN_CALORIE_TARGET, MAX_CALORIE_TARGET);
  }

  let adjustment = 0;
  const has = (goal: GoalType) => goals.includes(goal);

  if (has('weight_loss')) adjustment -= 400;
  if (has('muscle_gain')) adjustment += 250;
  if (has('weight_gain')) adjustment += 400;
  if (has('general_fitness') || has('better_lifestyle')) adjustment -= 100;
  if (has('flexibility') || has('stress_reduction')) adjustment -= 50;

  // Never recommend below a broadly safe floor for adults, and never above a
  // high ceiling. These are conservative guardrails, not medical limits.
  return clamp(Math.round(maintenance + adjustment), MIN_CALORIE_TARGET, MAX_CALORIE_TARGET);
}

export function calculateCalorieTarget(metrics: ProfileMetrics, goals: GoalType[] = []): number {
  return applyGoalAdjustment(calculateTdee(metrics), goals);
}

const ACTIVITY_OFFSET: Record<ActivityLevel, number> = {
  sedentary: 0,
  light: 300,
  moderate: 500,
  active: 700,
  very_active: 900,
};

/**
 * Hydration target in ml. Base 35ml/kg, plus a training allowance and a warm
 * climate allowance, then rounded to the nearest 100ml.
 */
export function calculateWaterTarget(
  weightKg: number,
  activityLevel: ActivityLevel = 'moderate',
  extraTrainingMinutes = 0,
  climateHot = false,
): number {
  if (weightKg <= 0) return 2000;
  const base = weightKg * 35;
  const activity = ACTIVITY_OFFSET[activityLevel] ?? 0;
  const training = Math.max(0, extraTrainingMinutes) * 12;
  const climate = climateHot ? 500 : 0;
  return Math.max(1500, Math.round((base + activity + training + climate) / 100) * 100);
}

/**
 * MET-based energy expenditure. MET (Metabolic Equivalent of Task) values come
 * from the Compendium of Physical Activities and are averaged for a range.
 */
const MET_BY_CATEGORY: Record<string, number> = {
  cardio: 7.0,
  strength: 5.0,
  full_body: 5.5,
  upper_body: 5.0,
  lower_body: 5.5,
  core: 4.0,
  hiit: 9.0,
  mobility: 3.0,
  stretching: 2.3,
  yoga: 3.0,
};

const INTENSITY_FACTOR: Record<FitnessLevel, number> = {
  beginner: 0.9,
  intermediate: 1.0,
  advanced: 1.1,
};

/** kcal = MET * 3.5 * weightKg / 200 * minutes, scaled by training intensity. */
export function calculateCaloriesBurned(params: {
  category: string;
  minutes: number;
  weightKg: number;
  fitnessLevel?: FitnessLevel;
}): number {
  const met = (MET_BY_CATEGORY[params.category] ?? 4.0) * INTENSITY_FACTOR[params.fitnessLevel ?? 'intermediate'];
  const minutes = Math.max(0, params.minutes);
  const kcal = (met * 3.5 * Math.max(0, params.weightKg)) / 200 * minutes;
  return Math.round(kcal);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Splits a calorie target into protein/carb/fat grams. Protein scales with goal. */
export function calculateMacros(calorieTarget: number, goals: GoalType[] = [], weightKg = 70): MacroSplit {
  const proteinPerKg = goals.includes('muscle_gain') ? 1.8 : goals.includes('weight_loss') ? 1.6 : 1.4;
  const fatRatio = goals.includes('weight_loss') ? 0.25 : 0.28;

  // Protein is anchored to body weight, so the remaining calories are what is
  // left to divide. Fat used to be taken from the *full* target, which could
  // overshoot the target on its own and drove carbs to zero; splitting only
  // the remainder keeps protein + fat + carbs at the target.
  const proteinG = Math.round(clamp(weightKg * proteinPerKg, 40, 220));
  const remainingCalories = Math.max(0, calorieTarget - proteinG * 4);
  const fatG = Math.round((remainingCalories * fatRatio) / 9);
  const carbsG = Math.round((remainingCalories - fatG * 9) / 4);
  return { proteinG: Math.max(0, proteinG), carbsG: Math.max(0, carbsG), fatG: Math.max(0, fatG) };
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
