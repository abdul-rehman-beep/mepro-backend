import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

/**
 * One document per user per day. Everything the progress screens need is written
 * here at completion time, so charts read a single indexed collection instead of
 * re-aggregating sessions, food logs and water logs on every request.
 */
const progressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    day: { type: String, required: true, index: true },

    weightKg: { type: Number, default: null },
    bmi: { type: Number, default: null },

    caloriesConsumed: { type: Number, default: 0 },
    caloriesBurned: { type: Number, default: 0 },
    calorieTarget: { type: Number, default: 0 },

    proteinG: { type: Number, default: 0 },
    carbsG: { type: Number, default: 0 },
    fatG: { type: Number, default: 0 },
    fiberG: { type: Number, default: 0 },

    waterMl: { type: Number, default: 0 },
    waterTargetMl: { type: Number, default: 2000 },

    workoutMinutes: { type: Number, default: 0 },
    workoutCount: { type: Number, default: 0 },
    yogaCount: { type: Number, default: 0 },
    workoutDays: { type: Number, default: 0 },

    mealsLogged: { type: Number, default: 0 },
    foodLogs: { type: Number, default: 0 },

    goalMinutesTarget: { type: Number, default: 0 },
  },
  { timestamps: true },
);

progressSchema.index({ userId: 1, day: 1 }, { unique: true });
progressSchema.index({ userId: 1, day: -1 });
progressSchema.index({ userId: 1, day: 1, weightKg: 1 });

export type ProgressAttributes = InferSchemaType<typeof progressSchema>;
export type ProgressDocument = HydratedDocument<ProgressAttributes>;
export type ProgressModel = Model<ProgressAttributes>;

export const Progress = model<ProgressAttributes>('Progress', progressSchema) as ProgressModel;
