import { z } from 'zod';
import {
  activityLevelSchema,
  ageSchema,
  booleanQuery,
  csvArray,
  dateTimeSchema,
  dietPreferenceSchema,
  emailSchema,
  fitnessLevelSchema,
  genderSchema,
  heightSchema,
  idParamSchema,
  isoDateSchema,
  nameSchema,
  paginationSchema,
  passwordSchema,
  weightSchema,
} from './common.validator';

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const refreshSchema = z.object({
  // Also accepted from the httpOnly cookie when the client prefers that.
  refreshToken: z.string().min(10).max(4096).optional(),
});

export const logoutSchema = refreshSchema;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

const profileFields = {
  name: nameSchema.optional(),
  age: ageSchema.optional(),
  gender: genderSchema.optional(),
  heightCm: heightSchema.optional(),
  weightKg: weightSchema.optional(),
  targetWeightKg: weightSchema.optional(),
  fitnessLevel: fitnessLevelSchema.optional(),
  activityLevel: activityLevelSchema.optional(),
  goals: z.array(z.enum(['weight_loss', 'weight_gain', 'muscle_gain', 'general_fitness', 'flexibility', 'stress_reduction', 'better_lifestyle'])).max(5).optional(),
  preferredWorkoutLocation: z.array(z.string().max(30)).max(4).optional(),
  preferredDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
  preferredWorkoutMinutes: z.coerce.number().int().min(5).max(180).optional(),
  dietPreference: dietPreferenceSchema.optional(),
  allergies: z.array(z.string().trim().max(40)).max(20).optional(),
  dislikedFoods: z.array(z.string().trim().max(60)).max(30).optional(),
  mealCount: z.coerce.number().int().min(2).max(6).optional(),
};

export const updateProfileSchema = z.object(profileFields).refine(
  (data) => Object.keys(data).length > 0,
  'Provide at least one field to update',
);

export const onboardingSchema = z.object({
  ...profileFields,
  age: ageSchema,
  gender: genderSchema,
  heightCm: heightSchema,
  weightKg: weightSchema,
  fitnessLevel: fitnessLevelSchema,
  goals: z
    .array(
      z.enum([
        'weight_loss',
        'weight_gain',
        'muscle_gain',
        'general_fitness',
        'flexibility',
        'stress_reduction',
        'better_lifestyle',
      ]),
    )
    .min(1, 'Select at least one goal')
    .max(5),
  dietPreference: dietPreferenceSchema,
});

export const weightLogSchema = z.object({
  weightKg: weightSchema,
  date: isoDateSchema.optional(),
});

export const bmiQuerySchema = z.object({
  weightKg: weightSchema.optional(),
  heightCm: heightSchema.optional(),
});

export const bmiBodySchema = z.object({
  // Both are optional: the controller falls back to the stored profile, so
  // POST /users/bmi with an empty body means "recalculate from my profile".
  weightKg: weightSchema.optional(),
  heightCm: heightSchema.optional(),
});

export const avatarSchema = z.object({
  avatarUrl: z.string().url('Enter a valid image URL').max(500).nullable(),
});

export const notificationSettingsSchema = z.object({
  workoutReminders: z.boolean().optional(),
  waterReminders: z.boolean().optional(),
  mealReminders: z.boolean().optional(),
  motivation: z.boolean().optional(),
  achievements: z.boolean().optional(),
  aiRecommendations: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')
    .optional(),
  reminderTimes: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM'))
    .max(10)
    .optional(),
});

export const deviceTokenSchema = z.object({
  token: z.string().trim().min(10, 'Invalid push token').max(400),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

export const workoutListSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  location: z.enum(['home', 'gym', 'outdoor', 'anywhere']).optional(),
  equipment: csvArray(10),
  muscleGroup: csvArray(10),
  minDuration: z.coerce.number().int().min(1).max(240).optional(),
  maxDuration: z.coerce.number().int().min(1).max(240).optional(),
  sort: z.enum(['newest', 'popular', 'shortest', 'longest', 'title']).optional().default('popular'),
});

export const workoutSessionSchema = z.object({
  durationMinutes: z.coerce.number().int().min(1, 'Session must be at least 1 minute').max(300),
  perceivedEffort: z.coerce.number().int().min(1).max(10).optional(),
  notes: z.string().trim().max(1000).optional(),
  completedExercises: z
    .array(
      z.object({
        exerciseOrder: z.coerce.number().int().min(0).max(200),
        name: z.string().trim().min(1).max(120),
        durationSeconds: z.coerce.number().int().min(0).max(7200).optional(),
        caloriesBurned: z.coerce.number().int().min(0).max(5000).optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const yogaListSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z
    .enum(['beginner', 'flexibility', 'relaxation', 'morning', 'evening', 'stress_relief', 'back_friendly'])
    .optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  bestTimeOfDay: z.enum(['morning', 'evening', 'anytime']).optional(),
  maxDuration: z.coerce.number().int().min(1).max(180).optional(),
});

export const historySchema = paginationSchema.extend({
  type: z.enum(['workout', 'yoga', 'all']).optional().default('all'),
});

export const yogaCompleteSchema = workoutSessionSchema.partial().extend({
  durationMinutes: z.coerce.number().int().min(1).max(300).optional(),
});

export const progressQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export const weeklyQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).optional().default(8),
});

export const monthlyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export const dateRangeQuerySchema = z
  .object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    day: isoDateSchema.optional(),
  })
  .refine((data) => !(data.startDate && data.endDate) || data.startDate <= data.endDate, {
    message: 'startDate must be before endDate',
    path: ['startDate'],
  });

export const goalCreateSchema = z.object({
  title: z.string().trim().min(3, 'Give your goal a title').max(120),
  description: z.string().trim().max(500).optional(),
  goalType: z.enum([
    'weight_loss',
    'weight_gain',
    'muscle_gain',
    'general_fitness',
    'flexibility',
    'stress_reduction',
    'better_lifestyle',
  ]),
  targetValue: z.coerce.number().min(0.1, 'Target must be greater than 0').max(1_000_000),
  currentValue: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  unit: z.string().trim().min(1).max(24),
  targetDate: isoDateSchema.optional(),
  source: z
    .enum(['manual', 'weight', 'workout_count', 'workout_minutes', 'water_ml', 'yoga_count', 'streak'])
    .optional()
    .default('manual'),
});

export const goalUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  targetValue: z.coerce.number().min(0.1).max(1_000_000).optional(),
  currentValue: z.coerce.number().min(0).max(1_000_000).optional(),
  unit: z.string().trim().min(1).max(24).optional(),
  targetDate: isoDateSchema.optional().nullable(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export const goalProgressSchema = z
  .object({
    currentValue: z.coerce.number().min(0).max(1_000_000).optional(),
    increment: z.coerce.number().optional(),
  })
  // Without this, `{}` validated and the endpoint returned 200 with an
  // unchanged goal, which reads as success to the client.
  .refine((data) => data.currentValue !== undefined || data.increment !== undefined, {
    message: 'Provide currentValue or increment',
    path: ['currentValue'],
  });

export const foodSearchSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  origin: z.enum(['south_asian', 'middle_eastern', 'global', 'other']).optional(),
  diet: csvArray(5),
  maxCalories: z.coerce.number().min(0).max(1000).optional(),
  minProtein: z.coerce.number().min(0).max(100).optional(),
  excludeAllergens: csvArray(10),
  commonOnly: booleanQuery,
  sort: z.enum(['name', 'calories_asc', 'calories_desc', 'protein_desc', 'health']).optional().default('health'),
});

export const foodLogQuerySchema = paginationSchema.extend({
  day: isoDateSchema.optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

export const createFoodLogSchema = z
  .object({
    foodId: z.string().regex(/^[a-f\d]{24}$/i, 'Malformed food id'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    servings: z.coerce.number().min(0.01, 'Servings must be greater than 0').max(100).optional(),
    servingName: z.string().trim().max(60).optional(),
    grams: z.coerce.number().min(0.1, 'Grams must be greater than 0').max(10_000).optional(),
    eatenAt: dateTimeSchema.optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine((data) => data.grams !== undefined || data.servings !== undefined || data.servingName !== undefined, {
    message: 'Provide servings, a serving name, or grams',
    path: ['servings'],
  });

/**
 * A log the user typed by hand, with no catalogue entry behind it. The macro
 * values describe the amount being logged, so no per-100g scaling happens.
 */
export const customFoodLogSchema = z.object({
  foodName: z.string().trim().min(1, 'Food name is required').max(120),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0').max(100).optional().default(1),
  unit: z.string().trim().min(1).max(60).optional().default('serving'),
  calories: z.coerce.number().min(0, 'Calories cannot be negative').max(10_000),
  proteinG: z.coerce.number().min(0, 'Protein cannot be negative').max(1_000).optional().default(0),
  carbsG: z.coerce.number().min(0, 'Carbs cannot be negative').max(1_000).optional().default(0),
  fatG: z.coerce.number().min(0, 'Fat cannot be negative').max(1_000).optional().default(0),
  fiberG: z.coerce.number().min(0).max(1_000).optional().default(0),
  sugarG: z.coerce.number().min(0).max(1_000).optional().default(0),
  sodiumMg: z.coerce.number().min(0).max(20_000).optional().default(0),
  eatenAt: dateTimeSchema.optional(),
  notes: z.string().trim().max(300).optional(),
});

export const updateFoodLogSchema = z.object({
  foodId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  servings: z.coerce.number().min(0.01).max(100).optional(),
  servingName: z.string().trim().max(60).optional(),
  grams: z.coerce.number().min(0).max(10_000).optional(),
  eatenAt: dateTimeSchema.optional(),
  notes: z.string().trim().max(300).optional(),
});

export const waterLogSchema = z.object({
  amountMl: z.coerce.number().int().min(1, 'Enter at least 1 ml').max(5000),
  day: isoDateSchema.optional(),
  source: z.enum(['quick_add', 'custom', 'bottle']).optional().default('quick_add'),
});

export const waterQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
});

export const dayQuerySchema = z.object({
  day: isoDateSchema.optional(),
});

export const mealPlanSchema = z.object({
  day: isoDateSchema.optional(),
  regenerate: booleanQuery.optional().default(false),
});

export const notificationListSchema = paginationSchema.extend({
  unreadOnly: booleanQuery.optional().default(false),
  type: z.string().trim().max(40).optional(),
});

export const assistantQuerySchema = z.object({
  message: z.string().trim().min(2, 'Ask a question').max(1000),
  conversationId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  includeProfile: booleanQuery.optional().default(true),
});

export const recommendationQuerySchema = z.object({
  force: booleanQuery.optional().default(false),
  type: z.enum(['workout', 'nutrition', 'hydration', 'yoga', 'overall']).optional(),
});

export const feedbackSchema = z.object({
  dismissed: z.boolean().optional(),
  actedUpon: z.boolean().optional(),
  rating: z.coerce.number().int().min(-1).max(1).optional(),
});

export const communityPostSchema = z.object({
  content: z.string().trim().min(1, 'Write something first').max(2000),
  postType: z.enum(['update', 'question', 'achievement', 'tip']).optional().default('update'),
  category: z.string().trim().max(40).optional().default('general'),
  relatedWorkoutId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  imageUrls: z.array(z.string().url().max(500)).max(4).optional().default([]),
});

export const communityListSchema = paginationSchema.extend({
  category: z.string().trim().max(40).optional(),
  postType: z.enum(['update', 'question', 'achievement', 'tip']).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['recent', 'popular']).optional().default('recent'),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Write a comment').max(1000),
});

export const reportSchema = z.object({
  reason: z.string().trim().min(3, 'Tell us why').max(500),
});

export { idParamSchema, paginationSchema, booleanQuery };
