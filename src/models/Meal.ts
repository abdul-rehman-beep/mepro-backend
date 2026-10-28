import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { DIET_PREFERENCES, MEAL_TYPES } from '../types/enums';

const mealItemSchema = new Schema(
  {
    foodId: { type: Schema.Types.ObjectId, ref: 'Food' },
    foodName: { type: String, required: true },
    servings: { type: Number, default: 1 },
    servingName: { type: String, default: '100 g' },
    grams: { type: Number, default: 100 },
    calories: { type: Number, default: 0 },
    proteinG: { type: Number, default: 0 },
    carbsG: { type: Number, default: 0 },
    fatG: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * A meal plan is generated for a specific day and the user who requested it. It
 * is a *suggestion*: the user can swap or remove any item and log what they
 * actually ate separately, so plans are never treated as medical prescriptions.
 */
const mealSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    day: { type: String, required: true, index: true },
    title: { type: String, default: 'My meal plan' },

    meals: {
      type: [
        new Schema(
          {
            mealType: { type: String, enum: MEAL_TYPES, required: true },
            name: { type: String, default: '' },
            items: { type: [mealItemSchema], default: [] },
            calories: { type: Number, default: 0 },
            proteinG: { type: Number, default: 0 },
            carbsG: { type: Number, default: 0 },
            fatG: { type: Number, default: 0 },
            notes: { type: String, default: '' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    totalCalories: { type: Number, default: 0 },
    totalProteinG: { type: Number, default: 0 },
    totalCarbsG: { type: Number, default: 0 },
    totalFatG: { type: Number, default: 0 },

    calorieTarget: { type: Number, default: 0 },
    dietPreference: { type: String, enum: DIET_PREFERENCES, default: null },
    allergies: { type: [String], default: [] },

    generatedBy: { type: String, enum: ['ai', 'rules'], default: 'rules' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

mealSchema.index({ userId: 1, day: 1 }, { unique: true });

export type MealAttributes = InferSchemaType<typeof mealSchema>;
export type MealDocument = HydratedDocument<MealAttributes>;
export type MealModel = Model<MealAttributes>;

export const Meal = model<MealAttributes>('Meal', mealSchema) as MealModel;
