import { WORKOUTS } from '../src/seed/data/workouts';
import { YOGA_ROUTINES } from '../src/seed/data/yoga';
import { FOODS } from '../src/seed/data/foods';
import { ACHIEVEMENTS } from '../src/seed/data/achievements';
import { ACHIEVEMENT_TRIGGERS } from '../src/models/Achievement';
import {
  ACTIVITY_LEVELS,
  DIET_PREFERENCES,
  FITNESS_LEVELS,
  FOOD_CATEGORIES,
  FOOD_ORIGINS,
  GENDERS,
  GOAL_TYPES,
  MUSCLE_GROUPS,
  WORKOUT_CATEGORIES,
  WORKOUT_LOCATIONS,
  YOGA_CATEGORIES,
} from '../src/types/enums';

const errors: string[] = [];

function checkEnum(where: string, field: string, value: string, allowed: readonly string[]): void {
  if (!allowed.includes(value)) {
    errors.push(`${where}: ${field}="${value}" not in [${allowed.join(', ')}]`);
  }
}

function checkEnumList(where: string, field: string, values: string[], allowed: readonly string[]): void {
  for (const value of values) checkEnum(where, field, value, allowed);
}

/* Workouts */
const workoutSlugs = new Set<string>();
for (const w of WORKOUTS) {
  const at = `workout ${w.slug}`;
  if (workoutSlugs.has(w.slug)) errors.push(`${at}: duplicate slug`);
  workoutSlugs.add(w.slug);
  checkEnum(at, 'category', w.category, WORKOUT_CATEGORIES);
  checkEnum(at, 'difficulty', w.difficulty, FITNESS_LEVELS);
  checkEnum(at, 'location', w.location, WORKOUT_LOCATIONS);
  checkEnumList(at, 'equipment', w.equipment, ['bodyweight', 'dumbbell', 'barbell', 'resistance_band', 'bench', 'kettlebell', 'pull_up_bar', 'mat', 'none']);
  checkEnumList(at, 'muscleGroups', w.muscleGroups, MUSCLE_GROUPS);
  if (w.durationMinutes < 1 || w.durationMinutes > 240) errors.push(`${at}: durationMinutes ${w.durationMinutes} outside 1-240`);
  if (w.exercises.length === 0) errors.push(`${at}: no exercises`);
  w.exercises.forEach((e, i) => {
    if (e.order !== i + 1) errors.push(`${at}: exercise ${e.name} order ${e.order} != ${i + 1}`);
    if (e.sets < 1 || e.sets > 20) errors.push(`${at}: exercise ${e.name} sets ${e.sets} outside 1-20`);
    checkEnumList(`${at} / ${e.name}`, 'muscleGroups', e.muscleGroups, MUSCLE_GROUPS);
    checkEnumList(`${at} / ${e.name}`, 'equipment', e.equipment, ['bodyweight', 'dumbbell', 'barbell', 'resistance_band', 'bench', 'kettlebell', 'pull_up_bar', 'mat', 'none']);
  });
}

/* Yoga */
const yogaSlugs = new Set<string>();
for (const y of YOGA_ROUTINES) {
  const at = `yoga ${y.slug}`;
  if (yogaSlugs.has(y.slug)) errors.push(`${at}: duplicate slug`);
  yogaSlugs.add(y.slug);
  checkEnum(at, 'category', y.category, YOGA_CATEGORIES);
  checkEnum(at, 'difficulty', y.difficulty, FITNESS_LEVELS);
  checkEnum(at, 'bestTimeOfDay', y.bestTimeOfDay, ['morning', 'evening', 'anytime']);
  if (y.durationMinutes < 1 || y.durationMinutes > 180) errors.push(`${at}: durationMinutes ${y.durationMinutes} outside 1-180`);
  if (y.asanas.length === 0) errors.push(`${at}: no asanas`);
  y.asanas.forEach((a, i) => {
    if (a.order !== i + 1) errors.push(`${at}: asana ${a.name} order ${a.order} != ${i + 1}`);
    checkEnum(`${at} / ${a.name}`, 'side', a.side, ['single', 'both', 'none']);
  });
}

/* Foods */
const foodSlugs = new Set<string>();
for (const f of FOODS) {
  const at = `food ${f.slug}`;
  if (foodSlugs.has(f.slug)) errors.push(`${at}: duplicate slug`);
  foodSlugs.add(f.slug);
  checkEnum(at, 'category', f.category, FOOD_CATEGORIES);
  checkEnum(at, 'origin', f.origin, FOOD_ORIGINS);
  checkEnumList(at, 'dietTags', f.dietTags, DIET_PREFERENCES);
  if (f.dietaryFlags.includes('gluten_free') && f.allergens.includes('gluten')) {
    errors.push(`${at}: marked gluten_free but lists a gluten allergen`);
  }
  if (f.healthScore < 0 || f.healthScore > 100) errors.push(`${at}: healthScore ${f.healthScore} outside 0-100`);
  if (f.calories < 0 || f.proteinG < 0 || f.carbsG < 0 || f.fatG < 0) errors.push(`${at}: negative macro`);
  if (f.servings.length === 0) errors.push(`${at}: no servings`);
  if (f.servings.filter((s) => s.isDefault).length !== 1) errors.push(`${at}: must have exactly one default serving`);
  for (const s of f.servings) {
    if (s.grams < 1 || s.grams > 5000) errors.push(`${at}: serving ${s.name} grams ${s.grams} outside 1-5000`);
  }
  // Rough macro energy sanity check using Atwater factors that account for
  // fiber (4 kcal/g digestible carb, 2 kcal/g fiber), which matters for leafy
  // greens where most of the listed carbohydrate is fiber. 25% tolerance,
  // since published composition tables round heavily.
  const digestibleCarbs = Math.max(0, f.carbsG - f.fiberG);
  const macroKcal = f.proteinG * 4 + digestibleCarbs * 4 + f.fiberG * 2 + f.fatG * 9;
  if (f.calories >= 10 && (macroKcal < f.calories * 0.75 || macroKcal > f.calories * 1.25)) {
    errors.push(`${at}: macros (${macroKcal.toFixed(0)} kcal) inconsistent with calories (${f.calories})`);
  }
}

/* Achievements */
const achievementKeys = new Set<string>();
for (const a of ACHIEVEMENTS) {
  const at = `achievement ${a.key}`;
  if (achievementKeys.has(a.key)) errors.push(`${at}: duplicate key`);
  achievementKeys.add(a.key);
  checkEnum(at, 'trigger', a.trigger, ACHIEVEMENT_TRIGGERS);
  checkEnum(at, 'tier', a.tier, ['bronze', 'silver', 'gold', 'platinum']);
  if (a.threshold < 1) errors.push(`${at}: threshold ${a.threshold} must be >= 1`);
}

const usedTriggers = new Set(ACHIEVEMENTS.map((a) => a.trigger));
for (const trigger of ACHIEVEMENT_TRIGGERS) {
  if (!usedTriggers.has(trigger)) errors.push(`no achievement defined for trigger "${trigger}"`);
}

console.log(`workouts=${WORKOUTS.length} yoga=${YOGA_ROUTINES.length} foods=${FOODS.length} achievements=${ACHIEVEMENTS.length}`);
console.log(`exercises=${WORKOUTS.reduce((n, w) => n + w.exercises.length, 0)} asanas=${YOGA_ROUTINES.reduce((n, y) => n + y.asanas.length, 0)}`);

if (errors.length > 0) {
  console.log(`\n${errors.length} problem(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('\nAll seed data valid.');
