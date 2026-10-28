import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { FITNESS_LEVELS } from '../types/enums';

/**
 * An attempt at a workout or a yoga routine. Created when the user starts,
 * updated as they complete the steps, finalised on completion. Keeping the
 * in-progress document means a crashed session is recoverable rather than lost.
 *
 * Exactly one of `workoutId` / `yogaId` is set, and `category` is denormalised to
 * `yoga` for routines so daily aggregates need no join.
 */
const workoutSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workoutId: { type: Schema.Types.ObjectId, ref: 'Workout', index: true },
    yogaId: { type: Schema.Types.ObjectId, ref: 'Yoga', index: true },

    /**
     * Denormalised display name. History lists read this directly, so a session
     * still shows its name if the source catalogue entry is edited or removed.
     */
    title: { type: String, default: '' },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    caloriesBurned: { type: Number, default: 0 },

    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress', index: true },

    completedExercises: {
      type: [
        new Schema(
          {
            exerciseOrder: { type: Number, required: true },
            name: { type: String, required: true },
            durationSeconds: { type: Number, default: 0 },
            caloriesBurned: { type: Number, default: 0 },
            completedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    exercisesCompleted: { type: Number, default: 0 },
    exercisesTotal: { type: Number, default: 0 },

    perceivedEffort: { type: Number, min: 1, max: 10 },
    notes: { type: String, maxlength: 1000, default: '' },

    /** Denormalised so daily aggregates never need a join to Workout. */
    day: { type: String, required: true, index: true },
    difficulty: { type: String, enum: FITNESS_LEVELS, default: 'intermediate' },
    category: { type: String, default: 'full_body' },
  },
  { timestamps: true },
);

/** A session must reference exactly one of the two activity catalogues. */
workoutSessionSchema.pre('validate', function requireExactlyOneSource() {
  const hasWorkout = Boolean(this.workoutId);
  const hasYoga = Boolean(this.yogaId);

  if (hasWorkout === hasYoga) {
    throw new Error(
      hasWorkout
        ? 'A session cannot reference both a workout and a yoga routine'
        : 'A session must reference either a workout or a yoga routine',
    );
  }

  if (hasYoga) this.category = 'yoga';
});

workoutSessionSchema.index({ userId: 1, day: 1 });
workoutSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });
workoutSessionSchema.index({ userId: 1, completedAt: -1 });
workoutSessionSchema.index({ userId: 1, category: 1, completedAt: -1 });

export type WorkoutSessionAttributes = InferSchemaType<typeof workoutSessionSchema>;
export type WorkoutSessionDocument = HydratedDocument<WorkoutSessionAttributes>;
export type WorkoutSessionModel = Model<WorkoutSessionAttributes>;

export const WorkoutSession = model<WorkoutSessionAttributes>(
  'WorkoutSession',
  workoutSessionSchema,
) as WorkoutSessionModel;
