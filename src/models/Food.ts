import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { DIET_PREFERENCES, FOOD_CATEGORIES, FOOD_ORIGINS, MEAL_TYPES } from '../types/enums';

export interface ServingOption {
  name: string;
  grams: number;
  isDefault: boolean;
}

const servingSchema = new Schema<ServingOption>(
  {
    name: { type: String, required: true, trim: true },
    grams: { type: Number, required: true, min: 1, max: 5000 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * Nutrition values are per 100 g and are *approximate reference values* drawn
 * from public composition tables. They are not laboratory measurements and the
 * UI labels them as estimates.
 */
const foodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    localName: { type: String, default: '', index: true },
    slug: { type: String, required: true, unique: true, index: true },

    category: { type: String, enum: FOOD_CATEGORIES, required: true, index: true },
    origin: { type: String, enum: FOOD_ORIGINS, default: 'other', index: true },

    /** Per 100 g. */
    calories: { type: Number, required: true, min: 0 },
    proteinG: { type: Number, required: true, min: 0 },
    carbsG: { type: Number, required: true, min: 0 },
    fatG: { type: Number, required: true, min: 0 },
    fiberG: { type: Number, default: 0, min: 0 },
    sugarG: { type: Number, default: 0, min: 0 },
    sodiumMg: { type: Number, default: 0, min: 0 },

    servings: { type: [servingSchema], default: [] },
    defaultServingGrams: { type: Number, default: 100 },

    dietTags: { type: [String], enum: DIET_PREFERENCES, default: [] },
    /**
     * Dietary attributes that are not diet *preferences*: "gluten_free",
     * "dairy_free", "no_added_sugar", "high_protein". Free-form because the
     * set grows over time and users filter on it, whereas `dietTags` must stay
     * aligned with `User.dietPreference`.
     */
    dietaryFlags: { type: [String], default: [], index: true },
    allergens: { type: [String], default: [] },
    healthScore: { type: Number, min: 0, max: 100, default: 50, index: true },

    imageUrl: { type: String, default: null },
    isCommon: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

foodSchema.index({ name: 'text', localName: 'text' });
foodSchema.index({ isActive: 1, category: 1, isCommon: 1 });
foodSchema.index({ name: 1, origin: 1 });
foodSchema.index({ allergens: 1 });

foodSchema.virtual('id').get(function id() {
  return this._id.toString();
});
foodSchema.set('toJSON', { virtuals: true, versionKey: false });

export type FoodAttributes = InferSchemaType<typeof foodSchema>;
export type FoodDocument = HydratedDocument<FoodAttributes>;
export type FoodModel = Model<FoodAttributes>;

export const Food = model<FoodAttributes>('Food', foodSchema) as FoodModel;

export const ALLERGEN_LABELS = [
  'gluten',
  'dairy',
  'eggs',
  'nuts',
  'peanuts',
  'soy',
  'fish',
  'shellfish',
  'sesame',
] as const;

export const MEAL_TYPE_KEYS = MEAL_TYPES;
