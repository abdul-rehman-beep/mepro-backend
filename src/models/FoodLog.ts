import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { MEAL_TYPES } from '../types/enums';

export interface LoggedNutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

const foodLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Null for a custom log that has no catalogue entry behind it. */
    foodId: { type: Schema.Types.ObjectId, ref: 'Food', default: null },

    /** Snapshotted so historical logs never change when the food table is edited. */
    foodName: { type: String, required: true },
    /** `catalogue` entries scale a Food row; `custom` carries its own macros. */
    source: { type: String, enum: ['catalogue', 'custom'], default: 'catalogue', index: true },
    foodLocalName: { type: String, default: '' },
    foodCategory: { type: String, default: 'other' },

    mealType: { type: String, enum: MEAL_TYPES, required: true, index: true },
    servings: { type: Number, required: true, min: 0.01, max: 100 },
    servingName: { type: String, default: '100 g' },
    /** Zero for custom logs, where the user supplied totals rather than a weight. */
    grams: { type: Number, required: true, min: 0, max: 10000, default: 0 },

    nutrition: { type: Schema.Types.Mixed, required: true },

    eatenAt: { type: Date, default: Date.now },
    day: { type: String, required: true, index: true },
    notes: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true },
);

foodLogSchema.index({ userId: 1, day: 1 });
foodLogSchema.index({ userId: 1, eatenAt: -1 });
foodLogSchema.index({ userId: 1, day: 1, mealType: 1 });

export type FoodLogAttributes = InferSchemaType<typeof foodLogSchema>;
export type FoodLogDocument = HydratedDocument<FoodLogAttributes>;
export type FoodLogModel = Model<FoodLogAttributes>;

export const FoodLog = model<FoodLogAttributes>('FoodLog', foodLogSchema) as FoodLogModel;
