import mongoose, { type QueryFilter } from 'mongoose';
import { Food } from '../models/Food';
import { FoodLog } from '../models/FoodLog';
import { WaterLog } from '../models/WaterLog';
import { Meal } from '../models/Meal';
import { WorkoutSession } from '../models/WorkoutSession';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { getPagination, toIdArray, containsFilter, clampNumber } from '../utils/pagination';
import { isoDate, startOfDay, endOfDay } from '../utils/date';
import { calculateCaloriesBurned, calculateMacros, HEALTH_DISCLAIMER } from '../utils/health';
import { rebuildDay, todayKey, EMPTY_NUTRITION } from './progress.service';
import { evaluateAchievements } from './achievement.service';
import { toObjectId } from './workout.service';
import {
  type ActivityLevel,
  type DietPreference,
  type FoodCategory,
  type FitnessLevel,
  type MealType,
} from '../types/enums';

export interface ScaledNutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

export interface FoodRow {
  _id: mongoose.Types.ObjectId;
  name: string;
  localName: string;
  category: string;
  origin: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  servings?: Array<{ name: string; grams: number; isDefault: boolean }>;
  defaultServingGrams: number;
  dietTags: string[];
  allergens: string[];
  healthScore: number;
  imageUrl: string | null;
  isCommon: boolean;
}

/**
 * Nutrition values are stored per 100 g. `grams` is the only input needed, so
 * the client can send a raw weight ("180 g") or a serving count ("1.5 rotis")
 * and we still compute identical totals.
 */
export function scaleNutrition(food: FoodRow, grams: number): ScaledNutrition {
  const factor = grams / 100;
  const round = (value: number) => Math.round((value ?? 0) * factor * 10) / 10;
  return {
    calories: Math.round((food.calories ?? 0) * factor),
    proteinG: round(food.proteinG ?? 0),
    carbsG: round(food.carbsG ?? 0),
    fatG: round(food.fatG ?? 0),
    fiberG: round(food.fiberG ?? 0),
    sugarG: round(food.sugarG ?? 0),
    sodiumMg: Math.round((food.sodiumMg ?? 0) * factor),
  };
}

/** Resolves a (servings, servingName) pair into grams. */
export function resolveGrams(
  food: Pick<FoodRow, 'servings' | 'defaultServingGrams'>,
  servings: number,
  servingName?: string,
): { grams: number; resolvedName: string } {
  if (servingName) {
    const match = food.servings?.find((item) => item.name.toLowerCase() === servingName.toLowerCase());
    if (match) return { grams: match.grams * servings, resolvedName: match.name };
  }

  const fallback = food.servings?.find((item) => item.isDefault);
  if (fallback) return { grams: fallback.grams * servings, resolvedName: fallback.name };

  return { grams: (food.defaultServingGrams || 100) * servings, resolvedName: `${servings} x 100 g` };
}

export interface FoodSearchQuery {
  page?: unknown;
  limit?: unknown;
  search?: string;
  category?: string;
  origin?: string;
  diet?: string;
  maxCalories?: string;
  minProtein?: string;
  excludeAllergens?: string;
  commonOnly?: string;
  sort?: string;
}

export async function searchFoods(query: FoodSearchQuery): Promise<{
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  disclaimer: string;
}> {
  const { page, limit, skip } = getPagination(query);
  const filter: QueryFilter<Record<string, unknown>> = { isActive: true };

  if (query.search) {
    const nameMatch = containsFilter('name', query.search);
    const localMatch = containsFilter('localName', query.search);
    filter.$or = [nameMatch, localMatch];
  }

  if (query.category) filter.category = query.category;
  if (query.origin) filter.origin = query.origin;
  // `csvArray` always yields an array, and `[]` is truthy, so guard on length.
  // `$in` is required here: assigning a plain array would demand exact equality
  // with the whole `dietTags` array instead of matching any listed preference.
  if (query.diet?.length) filter.dietTags = { $in: query.diet };
  if (query.commonOnly) filter.isCommon = true;

  const maxCalories = Number(query.maxCalories);
  if (Number.isFinite(maxCalories) && maxCalories > 0) filter.calories = { $lte: maxCalories };

  const minProtein = Number(query.minProtein);
  if (Number.isFinite(minProtein) && minProtein > 0) filter.proteinG = { $gte: minProtein };

  // Exclude anything carrying a listed allergen, so an allergy setting actually
  // removes the food rather than just flagging it.
  const excluded = toIdArray(query.excludeAllergens);
  if (excluded.length) filter.allergens = { $nin: excluded };

  const sorts: Record<string, Record<string, 1 | -1>> = {
    name: { name: 1 },
    calories_asc: { calories: 1 },
    calories_desc: { calories: -1 },
    protein_desc: { proteinG: -1 },
    health: { healthScore: -1 },
  };
  const sort = sorts[query.sort ?? 'health'] ?? sorts.health;

  const [items, total] = await Promise.all([
    Food.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Food.countDocuments(filter),
  ]);

  return {
    items: items as unknown[],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
    disclaimer: 'Nutrition values are approximate reference values per 100 g and may vary by preparation.',
  };
}

export async function getFood(id: string): Promise<unknown> {
  const food = await Food.findById(id).lean();
  if (!food) throw ApiError.notFound('Food not found');
  return food;
}

export async function getFoodCategories(): Promise<Array<{ category: string; count: number }>> {
  return Food.aggregate<{ _id: string; count: number }>([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).then((rows) => rows.map((row) => ({ category: row._id, count: row.count })));
}

export interface CreateFoodLogInput {
  foodId: string;
  mealType: MealType;
  servings: number;
  servingName?: string;
  grams?: number;
  eatenAt?: string;
  notes?: string;
}

export async function createFoodLog(userId: string, input: CreateFoodLogInput): Promise<unknown> {
  const food = await Food.findById(toObjectId(input.foodId, 'foodId')).lean();
  if (!food) throw ApiError.notFound('Food not found');

  const { grams, resolvedName } =
    input.grams !== undefined
      ? { grams: input.grams, resolvedName: input.servingName ?? `${input.grams} g` }
      : resolveGrams(food as FoodRow, input.servings, input.servingName);

  const nutrition = scaleNutrition(food as FoodRow, grams);
  const eatenAt = input.eatenAt ? new Date(input.eatenAt) : new Date();
  const day = isoDate(eatenAt);

  const log = await FoodLog.create({
    userId,
    foodId: food._id,
    foodName: food.name,
    foodLocalName: food.localName,
    foodCategory: food.category,
    mealType: input.mealType,
    servings: input.servings ?? grams / 100,
    servingName: resolvedName,
    grams,
    nutrition,
    eatenAt,
    day,
    notes: input.notes ?? '',
  });

  await rebuildDay(userId, day);
  await evaluateAchievements(userId);

  return log;
}

export interface CreateCustomFoodLogInput {
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  eatenAt?: string;
  notes?: string;
}

/**
 * Saves a hand-entered food. The macros are the totals for the logged amount,
 * so there is no per-100 g food to scale. `grams` stays at zero and the log is
 * marked `source: 'custom'` so edits never try to look up a catalogue food.
 */
export async function createCustomFoodLog(
  userId: string,
  input: CreateCustomFoodLogInput,
): Promise<unknown> {
  const eatenAt = input.eatenAt ? new Date(input.eatenAt) : new Date();
  const day = isoDate(eatenAt);
  const round = (value: number) => Math.round(value * 10) / 10;

  const log = await FoodLog.create({
    userId,
    foodId: null,
    source: 'custom',
    foodName: input.foodName.trim(),
    foodLocalName: '',
    foodCategory: 'other',
    mealType: input.mealType,
    servings: input.quantity,
    servingName: input.unit,
    grams: 0,
    nutrition: {
      calories: Math.round(input.calories),
      proteinG: round(input.proteinG),
      carbsG: round(input.carbsG),
      fatG: round(input.fatG),
      fiberG: round(input.fiberG),
      sugarG: round(input.sugarG),
      sodiumMg: Math.round(input.sodiumMg),
    },
    eatenAt,
    day,
    notes: input.notes ?? '',
  });

  await rebuildDay(userId, day);
  await evaluateAchievements(userId);

  return log;
}

export async function updateFoodLog(
  userId: string,
  logId: string,
  input: Partial<CreateFoodLogInput>,
): Promise<unknown> {
  const log = await FoodLog.findOne({ _id: toObjectId(logId, 'logId'), userId });
  if (!log) throw ApiError.notFound('Food log not found');

  if (input.foodId) {
    const food = await Food.findById(toObjectId(input.foodId, 'foodId')).lean();
    if (!food) throw ApiError.notFound('Food not found');

    const servings = input.servings ?? log.servings;
    const { grams, resolvedName } =
      input.grams !== undefined
        ? { grams: input.grams, resolvedName: input.servingName ?? `${input.grams} g` }
        : resolveGrams(food as FoodRow, servings, input.servingName);

    log.foodId = food._id;
    log.foodName = food.name;
    log.foodLocalName = food.localName;
    log.foodCategory = food.category;
    log.servings = servings;
    log.servingName = resolvedName;
    log.grams = grams;
    log.nutrition = scaleNutrition(food as FoodRow, grams);
  } else if (log.source === 'custom' || !log.foodId) {
    // Custom logs carry their own totals, so a portion change only updates the
    // label; there are no per-100 g values to rescale from.
    if (input.servings !== undefined) log.servings = input.servings;
    if (input.servingName !== undefined) log.servingName = input.servingName;
  } else if (input.servings !== undefined || input.grams !== undefined || input.servingName !== undefined) {
    const food = await Food.findById(log.foodId).lean();
    if (!food) throw ApiError.notFound('Food not found for this log');

    const servings = input.servings ?? log.servings;
    const { grams, resolvedName } =
      input.grams !== undefined
        ? { grams: input.grams, resolvedName: input.servingName ?? `${input.grams} g` }
        : resolveGrams(food as FoodRow, servings, input.servingName ?? log.servingName);

    log.servings = servings;
    log.servingName = resolvedName;
    log.grams = grams;
    log.nutrition = scaleNutrition(food as FoodRow, grams);
  }

  const previousDay = log.day;
  if (input.mealType) log.mealType = input.mealType;
  if (input.notes !== undefined) log.notes = input.notes;
  if (input.eatenAt) {
    log.eatenAt = new Date(input.eatenAt);
    log.day = isoDate(log.eatenAt);
  }

  await log.save();

  // Editing can move a log to a different day, so both days need rebuilding.
  if (previousDay !== log.day) await rebuildDay(userId, previousDay);
  await rebuildDay(userId, log.day);

  return log;
}

export async function deleteFoodLog(userId: string, logId: string): Promise<{ deleted: boolean }> {
  const log = await FoodLog.findOneAndDelete({ _id: toObjectId(logId, 'logId'), userId });
  if (!log) throw ApiError.notFound('Food log not found');

  await rebuildDay(userId, log.day);
  return { deleted: true };
}

export async function listFoodLogs(
  userId: string,
  query: { page?: unknown; limit?: unknown; day?: string; mealType?: string; startDate?: string; endDate?: string },
): Promise<{ items: unknown[]; page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }> {
  const { page, limit, skip } = getPagination(query);
  const filter: QueryFilter<Record<string, unknown>> = { userId };

  if (query.day) filter.day = query.day;
  if (query.mealType) filter.mealType = query.mealType;

  if (query.startDate || query.endDate) {
    filter.eatenAt = {
      ...(query.startDate ? { $gte: startOfDay(query.startDate) } : {}),
      ...(query.endDate ? { $lte: endOfDay(query.endDate) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    FoodLog.find(filter).sort({ eatenAt: -1 }).skip(skip).limit(limit).lean(),
    FoodLog.countDocuments(filter),
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

export interface DailyNutritionSummary {
  day: string;
  target: number;
  consumed: number;
  burned: number;
  remaining: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  byMeal: Array<{ mealType: MealType; calories: number; items: unknown[] }>;
  mealsLogged: number;
  targetMet: boolean;
  disclaimer: string;
}

export async function getDailyNutrition(
  userId: string,
  day: string = todayKey(),
): Promise<DailyNutritionSummary> {
  const [user, logs, burnedAgg] = await Promise.all([
    User.findById(userId, 'dailyCalorieTarget heightCm weightKg age gender activityLevel goals fitnessLevel').lean(),
    FoodLog.find({ userId, day }).sort({ eatenAt: 1 }).lean(),
    // Exercise energy is added back to the day's balance.
    WorkoutSession.aggregate<{ total: number }>([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)), day, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$caloriesBurned' } } },
    ]),
  ]);

  const consumed = logs.reduce((sum, log) => sum + ((log.nutrition as ScaledNutrition)?.calories ?? 0), 0);
  const burned = Math.round(burnedAgg[0]?.total ?? 0);
  const target = user?.dailyCalorieTarget ?? 2000;

  const totals = logs.reduce(
    (acc, log) => {
      const nutrition = log.nutrition as ScaledNutrition;
      acc.proteinG += nutrition?.proteinG ?? 0;
      acc.carbsG += nutrition?.carbsG ?? 0;
      acc.fatG += nutrition?.fatG ?? 0;
      acc.fiberG += nutrition?.fiberG ?? 0;
      return acc;
    },
    { proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const byMeal = mealTypes.map((mealType) => {
    const items = logs.filter((log) => log.mealType === mealType);
    return {
      mealType,
      calories: items.reduce((sum, item) => sum + ((item.nutrition as ScaledNutrition)?.calories ?? 0), 0),
      items: items as unknown[],
    };
  });

  return {
    day,
    target,
    consumed: Math.round(consumed),
    burned,
    // Burned calories are added back: the user has more room, not less.
    remaining: Math.max(0, Math.round(target - consumed + burned)),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
    fiberG: Math.round(totals.fiberG),
    byMeal,
    mealsLogged: new Set(logs.map((log) => log.mealType)).size,
    targetMet: consumed > 0 && consumed >= target * 0.8 && consumed <= target * 1.1,
    disclaimer: 'Calorie and macro figures are informational estimates, not medical advice.',
  };
}

export async function getNutritionHistory(
  userId: string,
  query: { startDate?: string; endDate?: string },
): Promise<Array<{ day: string; calories: number; proteinG: number; carbsG: number; fatG: number; meals: number }>> {
  const filter: QueryFilter<Record<string, unknown>> = { userId };
  if (query.startDate || query.endDate) {
    filter.day = {
      ...(query.startDate ? { $gte: query.startDate } : {}),
      ...(query.endDate ? { $lte: query.endDate } : {}),
    };
  }

  const rows = await FoodLog.aggregate<{
    _id: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    count: number;
  }>([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), ...(filter.day ? { day: filter.day } : {}) } },
    {
      $group: {
        _id: '$day',
        calories: { $sum: '$nutrition.calories' },
        proteinG: { $sum: '$nutrition.proteinG' },
        carbsG: { $sum: '$nutrition.carbsG' },
        fatG: { $sum: '$nutrition.fatG' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    day: row._id,
    calories: Math.round(row.calories ?? 0),
    proteinG: Math.round(row.proteinG ?? 0),
    carbsG: Math.round(row.carbsG ?? 0),
    fatG: Math.round(row.fatG ?? 0),
    meals: row.count,
  }));
}

export interface LogWaterInput {
  amountMl: number;
  day?: string;
  source?: 'quick_add' | 'custom' | 'bottle';
}

export async function logWater(userId: string, input: LogWaterInput): Promise<{
  log: unknown;
  totalMl: number;
  targetMl: number;
  percent: number;
}> {
  const amountMl = clampNumber(input.amountMl, 1, 5000, 250);
  const day = input.day ?? todayKey();

  const log = await WaterLog.create({
    userId,
    amountMl,
    day,
    source: input.source ?? 'quick_add',
    loggedAt: new Date(),
  });

  await rebuildDay(userId, day);
  await evaluateAchievements(userId);

  const user = await User.findById(userId, 'dailyWaterTargetMl').lean();
  const targetMl = user?.dailyWaterTargetMl ?? 2000;

  const totals = await WaterLog.aggregate<{ total: number }>([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), day } },
    { $group: { _id: null, total: { $sum: '$amountMl' } } },
  ]);
  const totalMl = Math.round(totals[0]?.total ?? amountMl);

  return {
    log,
    totalMl,
    targetMl,
    percent: Math.min(100, Math.round((totalMl / Math.max(1, targetMl)) * 100)),
  };
}

export async function getHydrationToday(userId: string, day: string = todayKey()): Promise<{
  day: string;
  totalMl: number;
  targetMl: number;
  percent: number;
  entries: unknown[];
  glasses: number;
  remainingMl: number;
  nextReminderInMinutes: number | null;
}> {
  const [user, logs] = await Promise.all([
    User.findById(userId, 'dailyWaterTargetMl notificationSettings').lean(),
    WaterLog.find({ userId, day }).sort({ loggedAt: 1 }).lean(),
  ]);

  const totalMl = logs.reduce((sum, log) => sum + (log.amountMl ?? 0), 0);
  const targetMl = user?.dailyWaterTargetMl ?? 2000;

  return {
    day,
    totalMl,
    targetMl,
    percent: Math.min(100, Math.round((totalMl / Math.max(1, targetMl)) * 100)),
    entries: logs as unknown[],
    glasses: Math.round((totalMl / 250) * 10) / 10,
    remainingMl: Math.max(0, targetMl - totalMl),
    nextReminderInMinutes: 60,
  };
}

export async function getHydrationHistory(
  userId: string,
  days = 7,
): Promise<Array<{ day: string; totalMl: number; targetMl: number; percent: number }>> {
  const user = await User.findById(userId, 'dailyWaterTargetMl').lean();
  const targetMl = user?.dailyWaterTargetMl ?? 2000;
  const limit = clampNumber(days, 1, 90, 7);

  const rows = await WaterLog.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        day: { $gte: isoDate(new Date(Date.now() - (limit - 1) * 86_400_000)) },
      },
    },
    { $group: { _id: '$day', total: { $sum: '$amountMl' } } },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    day: row._id,
    totalMl: Math.round(row.total),
    targetMl,
    percent: Math.min(100, Math.round((row.total / Math.max(1, targetMl)) * 100)),
  }));
}

export async function removeWaterLog(userId: string, logId: string): Promise<{ deleted: boolean; day: string }> {
  const log = await WaterLog.findOneAndDelete({ _id: toObjectId(logId, 'logId'), userId });
  if (!log) throw ApiError.notFound('Water log not found');
  await rebuildDay(userId, log.day);
  return { deleted: true, day: log.day };
}

export interface MealPlanResult {
  day: string;
  title: string;
  meals: Array<{
    mealType: MealType;
    name: string;
    items: Array<{ foodId: string; foodName: string; servings: number; servingName: string; grams: number; calories: number; proteinG: number; carbsG: number; fatG: number }>;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    notes: string;
  }>;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  calorieTarget: number;
  dietPreference: string | null;
  allergies: string[];
  generatedBy: 'ai' | 'rules';
  notes: string;
  disclaimer: string;
}

interface PlanSlot {
  mealType: MealType;
  name: string;
  targetCalories: number;
  categories: FoodCategory[];
  notes: string;
}

/**
 * Builds a day plan by sampling foods that match the user's diet, allergies and
 * goal, then filling each meal to its calorie budget.
 *
 * This is a deterministic greedy packer rather than an optimiser: it is
 * predictable, fast, explainable and never produces an extreme plan. Each item
 * is clamped so no single food can dominate a meal.
 */
export async function generateMealPlan(userId: string, day: string = todayKey()): Promise<MealPlanResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found');

  const calorieTarget = user.dailyCalorieTarget ?? 2000;
  const diet = (user.dietPreference ?? null) as DietPreference | null;
  const allergies = (user.allergies ?? []).map((item) => item.toLowerCase());
  const disliked = (user.dislikedFoods ?? []).map((item) => item.toLowerCase());
  const mealCount = user.mealCount ?? 3;
  const weightKg = user.weightKg ?? 70;
  const goals = user.goals ?? [];

  const macros = calculateMacros(calorieTarget, goals as never, weightKg);

  const slots: PlanSlot[] = buildSlots(mealCount, goals as string[]);

  const foodFilter: QueryFilter<Record<string, unknown>> = { isActive: true, isCommon: true };
  if (diet) foodFilter.dietTags = diet;
  if (allergies.length) foodFilter.allergens = { $nin: allergies };

  // Exclude disliked foods by name, case-insensitively, without a regex injection risk.
  const candidates = await Food.find(foodFilter).sort({ healthScore: -1 }).limit(400).lean();

  const pool = candidates.filter(
    (food) =>
      !disliked.some(
        (item) => (food.name ?? '').toLowerCase().includes(item) || (food.localName ?? '').toLowerCase().includes(item),
      ),
  );

  const usable = pool.length > 0 ? pool : await Food.find({ isActive: true }).sort({ healthScore: -1 }).limit(200).lean();

  const meals: MealPlanResult['meals'] = [];

  for (const slot of slots) {
    const matching = usable.filter((food) => slot.categories.includes(food.category as FoodCategory));
    const foodPool = matching.length >= 2 ? matching : usable;

    const items: MealPlanResult['meals'][number]['items'] = [];
    let mealCalories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    // Greedy fill: keep adding the healthiest remaining food while the meal has
    // budget left. Each pick is capped at 45% of the meal so plans stay varied.
    const remaining = [...foodPool];
    let guard = 0;

    while (mealCalories < slot.targetCalories * 0.9 && remaining.length > 0 && guard < 8) {
      guard += 1;
      remaining.sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0));
      const food = remaining.shift();
      if (!food) break;

      const per100 = food.calories ?? 0;
      if (per100 <= 0) continue;

      const budgetLeft = slot.targetCalories - mealCalories;
      const cap = Math.min(slot.targetCalories * 0.45, budgetLeft);
      const grams = Math.max(20, Math.min(400, Math.round((cap / per100) * 100)));

      const scaled = scaleNutrition(food as FoodRow, grams);
      if (scaled.calories > budgetLeft + 40) continue;

      const serving = food.servings?.[0];
      items.push({
        foodId: food._id.toString(),
        foodName: food.name,
        servings: Math.round((grams / (serving?.grams ?? 100)) * 100) / 100,
        servingName: serving?.name ?? '100 g',
        grams,
        calories: scaled.calories,
        proteinG: scaled.proteinG,
        carbsG: scaled.carbsG,
        fatG: scaled.fatG,
      });

      mealCalories += scaled.calories;
      protein += scaled.proteinG;
      carbs += scaled.carbsG;
      fat += scaled.fatG;
    }

    meals.push({
      mealType: slot.mealType,
      name: slot.name,
      items,
      calories: Math.round(mealCalories),
      proteinG: Math.round(protein),
      carbsG: Math.round(carbs),
      fatG: Math.round(fat),
      notes: slot.notes,
    });
  }

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);

  const result: MealPlanResult = {
    day,
    title: `Meal plan for ${day}`,
    meals,
    totalCalories,
    totalProteinG: meals.reduce((sum, meal) => sum + meal.proteinG, 0),
    totalCarbsG: meals.reduce((sum, meal) => sum + meal.carbsG, 0),
    totalFatG: meals.reduce((sum, meal) => sum + meal.fatG, 0),
    calorieTarget,
    dietPreference: diet,
    allergies,
    generatedBy: 'rules',
    notes: 'This plan is a suggestion based on your goals and preferences. Adjust portions to suit you.',
    disclaimer: HEALTH_DISCLAIMER,
  };

  // Persist so the plan screen and the day view agree.
  await Meal.findOneAndUpdate(
    { userId, day },
    {
      $set: {
        userId,
        day,
        title: result.title,
        meals: meals.map((meal) => ({ ...meal, mealType: meal.mealType })),
        totalCalories: result.totalCalories,
        totalProteinG: result.totalProteinG,
        totalCarbsG: result.totalCarbsG,
        totalFatG: result.totalFatG,
        calorieTarget,
        dietPreference: diet,
        allergies,
        generatedBy: 'rules',
        notes: result.notes,
      },
    },
    { upsert: true },
  );

  return result;
}

function buildSlots(mealCount: number, goals: string[]): PlanSlot[] {
  const wantsMoreProtein = goals.includes('muscle_gain') || goals.includes('weight_loss');

  if (mealCount >= 5) {
    return [
      { mealType: 'breakfast', name: 'Breakfast', targetCalories: 400, categories: ['grains', 'dairy', 'fruits', 'protein'], notes: 'Start the day with protein and fibre.' },
      { mealType: 'snack', name: 'Morning snack', targetCalories: 200, categories: ['fruits', 'nuts_seeds', 'dairy'], notes: 'A light snack to keep energy steady.' },
      { mealType: 'lunch', name: 'Lunch', targetCalories: 600, categories: ['grains', 'protein', 'legumes', 'vegetables'], notes: 'Balanced main meal.' },
      { mealType: 'snack', name: 'Afternoon snack', targetCalories: 200, categories: ['fruits', 'nuts_seeds'], notes: 'Good for training in the evening.' },
      { mealType: 'dinner', name: 'Dinner', targetCalories: 550, categories: ['protein', 'vegetables', 'grains', 'legumes'], notes: 'Lighter on carbs, richer in protein.' },
    ];
  }

  if (mealCount === 4) {
    return [
      { mealType: 'breakfast', name: 'Breakfast', targetCalories: 450, categories: ['grains', 'dairy', 'fruits', 'protein'], notes: 'Includes a protein source.' },
      { mealType: 'lunch', name: 'Lunch', targetCalories: 600, categories: ['grains', 'protein', 'legumes', 'vegetables'], notes: 'Your main meal.' },
      { mealType: 'snack', name: 'Snack', targetCalories: 250, categories: ['fruits', 'nuts_seeds', 'dairy'], notes: 'Keeps you satisfied between meals.' },
      { mealType: 'dinner', name: 'Dinner', targetCalories: 650, categories: ['protein', 'vegetables', 'grains'], notes: 'Complete protein and vegetables.' },
    ];
  }

  return [
    {
      mealType: 'breakfast',
      name: 'Breakfast',
      targetCalories: Math.round(calorieShare(0.25)),
      categories: wantsMoreProtein ? ['grains', 'dairy', 'protein', 'fruits'] : ['grains', 'dairy', 'fruits'],
      notes: 'Balanced start to the day.',
    },
    {
      mealType: 'lunch',
      name: 'Lunch',
      targetCalories: Math.round(calorieShare(0.4)),
      categories: ['grains', 'protein', 'legumes', 'vegetables'],
      notes: 'Your largest meal.',
    },
    {
      mealType: 'dinner',
      name: 'Dinner',
      targetCalories: Math.round(calorieShare(0.35)),
      categories: wantsMoreProtein ? ['protein', 'vegetables', 'legumes'] : ['grains', 'protein', 'vegetables'],
      notes: 'Keep it balanced.',
    },
  ];

  function calorieShare(ratio: number): number {
    return 2000 * ratio;
  }
}

export async function getMealPlan(userId: string, day: string = todayKey()): Promise<unknown | null> {
  const meal = await Meal.findOne({ userId, day }).lean();
  return meal;
}

export async function getTodayMeals(userId: string): Promise<{
  plan: unknown | null;
  logged: DailyNutritionSummary;
}> {
  const [plan, logged] = await Promise.all([getMealPlan(userId), getDailyNutrition(userId)]);
  return { plan, logged };
}

/** Recomputes the day's activity energy without a workout session. */
export function estimateExerciseCalories(params: {
  category: string;
  minutes: number;
  weightKg: number;
  fitnessLevel?: FitnessLevel;
}): number {
  return calculateCaloriesBurned(params);
}

export { EMPTY_NUTRITION };
export type { ActivityLevel, DietPreference, FoodCategory, MealType };
