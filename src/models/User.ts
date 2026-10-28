import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import bcrypt from 'bcrypt';
import {
  ACTIVITY_LEVELS,
  DIET_PREFERENCES,
  FITNESS_LEVELS,
  GENDERS,
  GOAL_TYPES,
} from '../types/enums';

const BCRYPT_ROUNDS = 12;

export interface NotificationSettingsShape {
  workoutReminders: boolean;
  waterReminders: boolean;
  mealReminders: boolean;
  motivation: boolean;
  achievements: boolean;
  aiRecommendations: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  reminderTimes: string[];
}

const notificationSettingsSchema = new Schema<NotificationSettingsShape>(
  {
    workoutReminders: { type: Boolean, default: true },
    waterReminders: { type: Boolean, default: true },
    mealReminders: { type: Boolean, default: true },
    motivation: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
    aiRecommendations: { type: Boolean, default: true },
    quietHoursStart: { type: String },
    quietHoursEnd: { type: String },
    reminderTimes: { type: [String], default: ['08:00', '13:00', '19:00'] },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    avatarUrl: { type: String, default: null },

    age: { type: Number, min: 13, max: 100 },
    gender: { type: String, enum: GENDERS },
    heightCm: { type: Number, min: 90, max: 250 },
    weightKg: { type: Number, min: 25, max: 350 },
    targetWeightKg: { type: Number, min: 25, max: 350 },

    fitnessLevel: { type: String, enum: FITNESS_LEVELS },
    activityLevel: { type: String, enum: ACTIVITY_LEVELS, default: 'moderate' },
    goals: { type: [String], enum: GOAL_TYPES, default: [] },

    preferredWorkoutLocation: { type: [String], default: [] },
    preferredDays: { type: [Number], min: 0, max: 6, default: [] },
    preferredWorkoutMinutes: { type: Number, min: 5, max: 180, default: 30 },

    dietPreference: { type: String, enum: DIET_PREFERENCES },
    allergies: { type: [String], default: [] },
    dislikedFoods: { type: [String], default: [] },
    mealCount: { type: Number, min: 2, max: 6, default: 3 },

    /** Informational estimates derived from the profile, refreshed on update. */
    bmi: { type: Number, default: null },
    bmiCategory: { type: String, default: null },
    dailyCalorieTarget: { type: Number, default: null },
    dailyWaterTargetMl: { type: Number, default: 2000 },

    onboardingCompleted: { type: Boolean, default: false },
    onboardingStep: { type: String, default: 'profile' },

    /** Denormalised counters so gamification reads never need a scan. */
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null },
    totalWorkouts: { type: Number, default: 0 },
    totalYogaSessions: { type: Number, default: 0 },
    totalWorkoutMinutes: { type: Number, default: 0 },
    achievementPoints: { type: Number, default: 0 },

    notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },
    deviceTokens: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ 'lastActiveDate': -1 });

userSchema.virtual('id').get(function id() {
  return this._id.toString();
});

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.password;
    delete ret.deviceTokens;
    return ret;
  },
});

/** Hash on create and on any explicit password change. */
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

export type NotificationSettings = InferSchemaType<typeof notificationSettingsSchema>;
export type UserAttributes = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttributes>;
export type UserModel = Model<UserAttributes>;

export function comparePassword(candidate: string, hash: string): Promise<boolean> {
  return bcrypt.compare(candidate, hash);
}

export const User = model<UserAttributes>('User', userSchema) as UserModel;

export const USER_PROJECTION = '-password -deviceTokens' as const;

export type PublicUser = Omit<UserAttributes, 'password' | 'deviceTokens'>;
