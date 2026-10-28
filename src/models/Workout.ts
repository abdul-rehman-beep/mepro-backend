import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import {
  EQUIPMENT,
  FITNESS_LEVELS,
  MUSCLE_GROUPS,
  WORKOUT_CATEGORIES,
  WORKOUT_LOCATIONS,
} from '../types/enums';

const exerciseSchema = new Schema(
  {
    order: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    instructions: { type: [String], default: [] },
    muscleGroups: { type: [String], enum: MUSCLE_GROUPS, default: [] },
    equipment: { type: [String], enum: EQUIPMENT, default: [] },
    sets: { type: Number, default: 3, min: 1, max: 20 },
    reps: { type: String, default: '10-12' },
    holdSeconds: { type: Number, default: 0 },
    restSeconds: { type: Number, default: 60 },
    durationSeconds: { type: Number, default: 45 },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    caloriesPerMinute: { type: Number, default: 6 },
    tips: { type: [String], default: [] },
    commonMistakes: { type: [String], default: [] },
  },
  { _id: false },
);

const workoutSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },

    category: { type: String, enum: WORKOUT_CATEGORIES, required: true, index: true },
    difficulty: { type: String, enum: FITNESS_LEVELS, required: true, index: true },
    location: { type: String, enum: WORKOUT_LOCATIONS, default: 'anywhere', index: true },
    equipment: { type: [String], enum: EQUIPMENT, default: [] },
    muscleGroups: { type: [String], enum: MUSCLE_GROUPS, default: [] },

    durationMinutes: { type: Number, required: true, min: 1, max: 240 },
    estimatedCalories: { type: Number, default: 0 },

    exercises: { type: [exerciseSchema], default: [] },

    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },

    benefits: { type: [String], default: [] },
    equipmentNotes: { type: String, default: null },
    contraindications: { type: [String], default: [] },
    warmup: { type: [String], default: [] },
    cooldown: { type: [String], default: [] },

    /** Optional per-requirement restrictions, e.g. joints to avoid. */
    avoidIf: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    popularity: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

workoutSchema.index({ title: 'text', description: 'text' });
workoutSchema.index({ isActive: 1, category: 1, difficulty: 1 });
workoutSchema.index({ isActive: 1, location: 1, durationMinutes: 1 });
workoutSchema.index({ muscleGroups: 1, difficulty: 1 });

workoutSchema.virtual('id').get(function id() {
  return this._id.toString();
});
workoutSchema.set('toJSON', { virtuals: true, versionKey: false });

/** Text-searchable bag used by the AI semantic retriever. */
workoutSchema.virtual('searchText').get(function searchText() {
  return [this.title, this.description, this.category, this.difficulty, (this.muscleGroups ?? []).join(' ')]
    .filter(Boolean)
    .join(' ');
});

export type WorkoutAttributes = InferSchemaType<typeof workoutSchema>;
export type WorkoutDocument = HydratedDocument<WorkoutAttributes>;
export type WorkoutModel = Model<WorkoutAttributes>;

export const Workout = model<WorkoutAttributes>('Workout', workoutSchema) as WorkoutModel;

/** Projection for list screens — omits the (large) exercise array. */
export const WORKOUT_LIST_PROJECTION = {
  exercises: 0,
} as const;
