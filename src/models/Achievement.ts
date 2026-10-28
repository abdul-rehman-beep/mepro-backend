import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

export const ACHIEVEMENT_TRIGGERS = [
  'first_workout',
  'workout_count',
  'streak_days',
  'first_yoga',
  'yoga_count',
  'water_total',
  'first_meal_plan',
  'food_log_count',
  'goal_completed',
  'weight_logged',
  'profile_complete',
  'early_bird',
] as const;

export type AchievementTrigger = (typeof ACHIEVEMENT_TRIGGERS)[number];

/** Catalogue entry: the definition of a badge. */
const achievementSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },

    trigger: { type: String, enum: ACHIEVEMENT_TRIGGERS, required: true, index: true },
    threshold: { type: Number, required: true, min: 1 },

    icon: { type: String, default: 'trophy' },
    /** 0 = bronze, 1 = silver, 2 = gold, 3 = platinum. Presentation only. */
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    points: { type: Number, default: 10 },
    category: { type: String, default: 'general', index: true },

    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

achievementSchema.index({ isActive: 1, category: 1, sortOrder: 1 });

export type AchievementAttributes = InferSchemaType<typeof achievementSchema>;
export type AchievementDocument = HydratedDocument<AchievementAttributes>;
export type AchievementModel = Model<AchievementAttributes>;

export const Achievement = model<AchievementAttributes>('Achievement', achievementSchema) as AchievementModel;

/** A badge a specific user has earned. */
const userAchievementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    achievementId: { type: Schema.Types.ObjectId, ref: 'Achievement', required: true },
    key: { type: String, required: true },

    earnedAt: { type: Date, default: Date.now },
    /** Snapshot so history survives catalogue edits. */
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'trophy' },
    tier: { type: String, default: 'bronze' },
    points: { type: Number, default: 10 },
  },
  { timestamps: true },
);

userAchievementSchema.index({ userId: 1, key: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1, earnedAt: -1 });

export type UserAchievementAttributes = InferSchemaType<typeof userAchievementSchema>;
export type UserAchievementDocument = HydratedDocument<UserAchievementAttributes>;
export type UserAchievementModel = Model<UserAchievementAttributes>;

export const UserAchievement = model<UserAchievementAttributes>(
  'UserAchievement',
  userAchievementSchema,
) as UserAchievementModel;
