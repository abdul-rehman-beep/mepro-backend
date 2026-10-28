/**
 * Shared domain enums. These are the single source of truth for the values
 * accepted by validators, stored in MongoDB and mirrored by the mobile client.
 */

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type FitnessLevel = (typeof FITNESS_LEVELS)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const GOAL_TYPES = [
  'weight_loss',
  'weight_gain',
  'muscle_gain',
  'general_fitness',
  'flexibility',
  'stress_reduction',
  'better_lifestyle',
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const DIET_PREFERENCES = ['vegetarian', 'non_vegetarian', 'vegan', 'pescatarian', 'eggetarian'] as const;
export type DietPreference = (typeof DIET_PREFERENCES)[number];

export const WORKOUT_CATEGORIES = [
  'cardio',
  'strength',
  'full_body',
  'upper_body',
  'lower_body',
  'core',
  'hiit',
  'mobility',
  'stretching',
] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

export const WORKOUT_LOCATIONS = ['home', 'gym', 'outdoor', 'anywhere'] as const;
export type WorkoutLocation = (typeof WORKOUT_LOCATIONS)[number];

export const EQUIPMENT = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'resistance_band',
  'bench',
  'kettlebell',
  'pull_up_bar',
  'mat',
  'none',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * Coarse groups (`arms`, `legs`) are used for filtering, while the finer
 * anatomical groups are used for descriptions and AI recommendations. Both
 * live in the same list so an exercise can be tagged either way.
 */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'glutes',
  'core',
  'full_body',
  'cardio',
  'biceps',
  'triceps',
  'lats',
  'traps',
  'quads',
  'hamstrings',
  'calves',
  'forearms',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const YOGA_CATEGORIES = [
  'beginner',
  'flexibility',
  'relaxation',
  'morning',
  'evening',
  'stress_relief',
  'back_friendly',
] as const;
export type YogaCategory = (typeof YOGA_CATEGORIES)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const FOOD_CATEGORIES = [
  'grains',
  'protein',
  'dairy',
  'fruits',
  'vegetables',
  'legumes',
  'nuts_seeds',
  'beverages',
  'sweets',
  'snacks',
  'prepared_dishes',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_ORIGINS = ['south_asian', 'middle_eastern', 'global', 'other'] as const;
export type FoodOrigin = (typeof FOOD_ORIGINS)[number];

export const GOAL_STATUSES = ['active', 'completed', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'workout_reminder',
  'meal_reminder',
  'water_reminder',
  'goal_reminder',
  'achievement',
  'motivation',
  'ai_recommendation',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RECOMMENDATION_TYPES = ['workout', 'nutrition', 'hydration', 'yoga', 'overall'] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const AI_PROVIDERS = ['transformers', 'rules'] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const ASSISTANT_INTENTS = [
  'workout_advice',
  'nutrition_advice',
  'hydration_advice',
  'exercise_explanation',
  'yoga_advice',
  'warmup_advice',
  'progress_advice',
  'goal_advice',
  'safety_advice',
  'general_fitness',
  'out_of_scope',
] as const;
export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];
