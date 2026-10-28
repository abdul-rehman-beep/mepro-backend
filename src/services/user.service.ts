import { User, USER_PROJECTION, comparePassword, type PublicUser } from '../models/User';
import { RefreshToken, REVOKE_REASONS } from '../models/RefreshToken';
import { WorkoutSession } from '../models/WorkoutSession';
import { FoodLog } from '../models/FoodLog';
import { WaterLog } from '../models/WaterLog';
import { Goal } from '../models/Goal';
import { Progress } from '../models/Progress';
import { Achievement, UserAchievement } from '../models/Achievement';
import { Notification } from '../models/Notification';
import { AIRecommendation } from '../models/AIRecommendation';
import { AIConversation } from '../models/AIConversation';
import { CommunityPost } from '../models/CommunityPost';
import { Meal } from '../models/Meal';
import { Yoga } from '../models/Yoga';
import { Workout } from '../models/Workout';
import { Food } from '../models/Food';
import { ApiError } from '../utils/ApiError';
import { calculateBmi, calculateCalorieTarget, calculateWaterTarget, bmiCategory } from '../utils/health';
import { ACTIVITY_LEVELS, type ActivityLevel, type GoalType } from '../types/enums';
import { revokeAllSessions } from './auth.service';

export interface ProfileUpdateInput {
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  activityLevel?: ActivityLevel;
  goals?: GoalType[];
  preferredWorkoutLocation?: string[];
  preferredDays?: number[];
  preferredWorkoutMinutes?: number;
  dietPreference?: 'vegetarian' | 'non_vegetarian' | 'vegan' | 'pescatarian' | 'eggetarian';
  allergies?: string[];
  dislikedFoods?: string[];
  mealCount?: number;
}

/**
 * Recomputes every derived health estimate from the current profile.
 * Called after any change that affects weight, height, activity or goals so
 * targets can never drift out of sync with the profile.
 */
export async function refreshDerivedMetrics(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (user.heightCm && user.weightKg) {
    user.bmi = calculateBmi(user.weightKg, user.heightCm);
    user.bmiCategory = bmiCategory(user.bmi);
  }

  if (user.heightCm && user.weightKg && user.age && user.gender) {
    user.dailyCalorieTarget = calculateCalorieTarget(
      {
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        age: user.age,
        gender: user.gender,
        activityLevel: (user.activityLevel ?? 'moderate') as ActivityLevel,
      },
      (user.goals ?? []) as GoalType[],
    );
  }

  if (user.weightKg) {
    user.dailyWaterTargetMl = calculateWaterTarget(
      user.weightKg,
      (user.activityLevel ?? 'moderate') as ActivityLevel,
    );
  }

  await user.save();
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId, USER_PROJECTION).lean();
  if (!user) throw ApiError.notFound('User not found');
  return user as unknown as PublicUser;
}

export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (input.name !== undefined) user.name = input.name.trim();
  if (input.age !== undefined) user.age = input.age;
  if (input.gender !== undefined) user.gender = input.gender;
  if (input.heightCm !== undefined) user.heightCm = input.heightCm;
  if (input.weightKg !== undefined) user.weightKg = input.weightKg;
  if (input.targetWeightKg !== undefined) user.targetWeightKg = input.targetWeightKg;
  if (input.fitnessLevel !== undefined) user.fitnessLevel = input.fitnessLevel;
  if (input.activityLevel !== undefined) user.activityLevel = input.activityLevel;
  if (input.goals !== undefined) user.goals = input.goals;
  if (input.preferredWorkoutLocation !== undefined) user.preferredWorkoutLocation = input.preferredWorkoutLocation;
  if (input.preferredDays !== undefined) user.preferredDays = input.preferredDays;
  if (input.preferredWorkoutMinutes !== undefined) user.preferredWorkoutMinutes = input.preferredWorkoutMinutes;
  if (input.dietPreference !== undefined) user.dietPreference = input.dietPreference;
  if (input.allergies !== undefined) user.allergies = input.allergies;
  if (input.dislikedFoods !== undefined) user.dislikedFoods = input.dislikedFoods;
  if (input.mealCount !== undefined) user.mealCount = input.mealCount;

  await user.save();
  await refreshDerivedMetrics(userId);
  return getProfile(userId);
}

export async function updateAvatar(userId: string, avatarUrl: string | null): Promise<PublicUser> {
  await User.findByIdAndUpdate(userId, { $set: { avatarUrl } });
  return getProfile(userId);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const matches = await comparePassword(currentPassword, user.password);
  if (!matches) throw ApiError.badRequest('Current password is incorrect', [{ field: 'currentPassword' }]);

  if (await comparePassword(newPassword, user.password)) {
    throw ApiError.badRequest('New password must be different from the current password', [
      { field: 'newPassword' },
    ]);
  }

  user.password = newPassword;
  await user.save();

  // Changing a password invalidates every existing session.
  await revokeAllSessions(userId, REVOKE_REASONS.PASSWORD_CHANGED);
}

export async function completeOnboarding(userId: string, input: ProfileUpdateInput): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  await updateProfile(userId, input);

  const updated = await User.findById(userId);
  if (updated) {
    updated.onboardingCompleted = true;
    updated.onboardingStep = 'complete';
    await updated.save();
  }

  return getProfile(userId);
}

export async function updateNotificationSettings(
  userId: string,
  settings: Record<string, unknown>,
): Promise<unknown> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  user.notificationSettings = { ...(user.notificationSettings ?? {}), ...settings } as never;
  user.markModified('notificationSettings');
  await user.save();
  return user.notificationSettings;
}

export async function registerDeviceToken(userId: string, token: string, platform?: string): Promise<string[]> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (!user.deviceTokens.includes(token)) {
    user.deviceTokens.push(token);
    // Cap stored tokens so a reinstall loop cannot grow the document unbounded.
    if (user.deviceTokens.length > 10) user.deviceTokens = user.deviceTokens.slice(-10);
    await user.save();
  }

  logger_device(userId, platform);
  return user.deviceTokens;
}

export async function removeDeviceToken(userId: string, token: string): Promise<{ removed: boolean }> {
  const result = await User.updateOne({ _id: userId }, { $pull: { deviceTokens: token } });
  return { removed: (result.modifiedCount ?? 0) > 0 };
}

function logger_device(userId: string, platform?: string): void {
  // Kept as a no-op seam so device registration can be audited later.
  void userId;
  void platform;
}

export interface OnboardingState {
  onboardingCompleted: boolean;
  onboardingStep: string;
  nextStep: string | null;
  requiredFieldsMissing: string[];
  progressPercent: number;
}

const ONBOARDING_STEPS = [
  { key: 'profile', fields: ['name'] },
  { key: 'body-metrics', fields: ['age', 'gender', 'heightCm', 'weightKg'] },
  { key: 'fitness-level', fields: ['fitnessLevel'] },
  { key: 'goals', fields: ['goals'] },
  { key: 'preferences', fields: ['dietPreference'] },
] as const;

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found');

  const record = user as unknown as Record<string, unknown>;
  const missing: string[] = [];
  let nextStep: string | null = null;
  let satisfied = 0;

  for (const step of ONBOARDING_STEPS) {
    const stepMissing = step.fields.filter((field) => {
      const value = record[field];
      if (Array.isArray(value)) return value.length === 0;
      return value === undefined || value === null || value === '';
    });

    if (stepMissing.length === 0) {
      satisfied += 1;
    } else {
      missing.push(...stepMissing);
      if (!nextStep) nextStep = step.key;
    }
  }

  return {
    onboardingCompleted: Boolean(user.onboardingCompleted),
    onboardingStep: user.onboardingStep ?? 'profile',
    nextStep,
    requiredFieldsMissing: missing,
    progressPercent: Math.round((satisfied / ONBOARDING_STEPS.length) * 100),
  };
}

/** Cascades through every user-scoped collection. Used by DELETE /users/account. */
export async function deleteAccount(userId: string): Promise<void> {
  // Deleting the user row cascades the rest, so every owned collection is
  // cleared explicitly. Comments on other people's posts are stripped without
  // deleting the posts themselves, which would punish uninvolved members.
  await Promise.all([
    RefreshToken.deleteMany({ userId }),
    WorkoutSession.deleteMany({ userId }),
    FoodLog.deleteMany({ userId }),
    WaterLog.deleteMany({ userId }),
    Goal.deleteMany({ userId }),
    Progress.deleteMany({ userId }),
    UserAchievement.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    AIRecommendation.deleteMany({ userId }),
    AIConversation.deleteMany({ userId }),
    Meal.deleteMany({ userId }),
    CommunityPost.deleteMany({ userId }),
    CommunityPost.updateMany({}, { $pull: { comments: { userId } } }),
    User.findByIdAndDelete(userId),
  ]);

  await revokeAllSessions(userId, REVOKE_REASONS.ACCOUNT_DELETED);
}

/** Catalogue models are shared, so they are only reported, never deleted. */
export async function getAccountDataSummary(userId: string): Promise<Record<string, number>> {
  const [workoutSessions, foodLogs, waterLogs, goals, achievements, notifications, posts] = await Promise.all([
    WorkoutSession.countDocuments({ userId }),
    FoodLog.countDocuments({ userId }),
    WaterLog.countDocuments({ userId }),
    Goal.countDocuments({ userId }),
    UserAchievement.countDocuments({ userId }),
    Notification.countDocuments({ userId }),
    CommunityPost.countDocuments({ userId }),
  ]);

  return { workoutSessions, foodLogs, waterLogs, goals, achievements, notifications, posts };
}

export const SHARED_CATALOGUE_MODELS = { Workout, Yoga, Food, Achievement, ACTIVITY_LEVELS };
