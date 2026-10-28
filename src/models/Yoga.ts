import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { FITNESS_LEVELS, YOGA_CATEGORIES } from '../types/enums';

const asanaSchema = new Schema(
  {
    order: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    sanskritName: { type: String, default: '' },
    description: { type: String, default: '' },
    instructions: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    precautions: { type: [String], default: [] },
    modifications: { type: [String], default: [] },
    holdSeconds: { type: Number, default: 30 },
    side: { type: String, enum: ['single', 'both', 'none'], default: 'both' },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
  },
  { _id: false },
);

const yogaSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },

    category: { type: String, enum: YOGA_CATEGORIES, required: true, index: true },
    difficulty: { type: String, enum: FITNESS_LEVELS, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 180 },
    level: { type: String, default: 'beginner' },

    asanas: { type: [asanaSchema], default: [] },
    benefits: { type: [String], default: [] },
    precautions: { type: [String], default: [] },
    contraindications: { type: [String], default: [] },

    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },

    /** Time of day this routine is designed for, used by the recommender. */
    bestTimeOfDay: { type: String, enum: ['morning', 'evening', 'anytime'], default: 'anytime' },
    focusAreas: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    popularity: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

yogaSchema.index({ title: 'text', description: 'text' });
yogaSchema.index({ isActive: 1, category: 1, difficulty: 1 });
yogaSchema.index({ category: 1, bestTimeOfDay: 1 });

yogaSchema.virtual('id').get(function id() {
  return this._id.toString();
});
yogaSchema.set('toJSON', { virtuals: true, versionKey: false });

export type YogaAttributes = InferSchemaType<typeof yogaSchema>;
export type YogaDocument = HydratedDocument<YogaAttributes>;
export type YogaModel = Model<YogaAttributes>;

export const Yoga = model<YogaAttributes>('Yoga', yogaSchema) as YogaModel;

export const YOGA_LIST_PROJECTION = { asanas: 0 } as const;

/** Yoga completion is stored in WorkoutSession with category='yoga'. */
export const YOGA_CATEGORY_KEY = 'yoga';
