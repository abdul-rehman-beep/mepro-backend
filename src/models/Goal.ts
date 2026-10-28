import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { GOAL_TYPES, GOAL_STATUSES } from '../types/enums';

const goalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 500, default: '' },
    goalType: { type: String, enum: GOAL_TYPES, required: true, index: true },

    targetValue: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, default: 0, min: 0 },
    /**
     * Value the goal started from. Progress is measured from here to
     * `targetValue`, so a "lose 5 kg" goal (80 kg -> 75 kg) can be tracked with
     * the same arithmetic as a "run 20 times" goal (0 -> 20).
     */
    baselineValue: { type: Number, default: 0, min: 0 },
    unit: { type: String, required: true, trim: true },

    startDate: { type: Date, default: Date.now },
    targetDate: { type: Date, default: null },

    status: { type: String, enum: GOAL_STATUSES, default: 'active', index: true },
    completedAt: { type: Date, default: null },

    /** How `currentValue` is maintained. */
    source: {
      type: String,
      enum: ['manual', 'weight', 'workout_count', 'workout_minutes', 'water_ml', 'yoga_count', 'streak'],
      default: 'manual',
    },

    /** Optional milestones for richer progress UI. */
    milestones: {
      type: [new Schema({ label: String, value: Number }, { _id: false })],
      default: [],
    },

    /**
     * Stored rather than virtual so goals can be sorted and filtered by progress
     * in MongoDB. Always keep it in step with `currentValue` via
     * `goalProgressPercent()`.
     */
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

goalSchema.index({ userId: 1, status: 1, createdAt: -1 });
goalSchema.index({ userId: 1, goalType: 1 });

export type GoalAttributes = InferSchemaType<typeof goalSchema>;
export type GoalDocument = HydratedDocument<GoalAttributes>;
export type GoalModel = Model<GoalAttributes>;

export const Goal = model<GoalAttributes>('Goal', goalSchema) as GoalModel;

export const GOAL_SOURCES = [
  'manual',
  'weight',
  'workout_count',
  'workout_minutes',
  'water_ml',
  'yoga_count',
  'streak',
] as const;
export type GoalSource = (typeof GOAL_SOURCES)[number];

/**
 * Progress from the goal's baseline to its target, clamped to 0-100.
 *
 * Measuring from the baseline is what makes counting *down* goals work: for
 * "80 kg -> 75 kg", being at 78 kg is 40% done, not 104%. Count-up goals have a
 * baseline of 0, so the formula degenerates to `current / target`.
 */
export function goalProgressPercent(baseline: number, current: number, target: number): number {
  const span = target - baseline;
  if (!Number.isFinite(span) || span === 0) return 0;
  const ratio = (current - baseline) / span;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

export const GOAL_TITLE_TEMPLATES: Record<string, { title: string; unit: string; source: GoalSource }> = {
  lose_5kg: { title: 'Lose 5 kg', unit: 'kg', source: 'weight' },
  workout_4x_week: { title: 'Work out 4 days a week', unit: 'sessions', source: 'workout_count' },
  water_2l: { title: 'Drink 2 L of water daily', unit: 'ml', source: 'water_ml' },
  yoga_20: { title: 'Complete 20 yoga sessions', unit: 'sessions', source: 'yoga_count' },
  workout_minutes_week: { title: 'Train 150 minutes a week', unit: 'minutes', source: 'workout_minutes' },
  streak_30: { title: 'Keep a 30 day streak', unit: 'days', source: 'streak' },
};
