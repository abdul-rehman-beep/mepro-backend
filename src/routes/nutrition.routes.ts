import { Router } from 'express';
import * as controller from '../controllers/nutrition.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createFoodLogSchema,
  customFoodLogSchema,
  dateRangeQuerySchema,
  dayQuerySchema,
  foodLogQuerySchema,
  foodSearchSchema,
  idParamSchema,
  mealPlanSchema,
  updateFoodLogSchema,
} from '../validators';

const router = Router();
router.use(requireAuth);

// Food catalogue (shared, read-mostly).
router.get('/foods', validate({ query: foodSearchSchema }), controller.searchFoods);
router.get('/foods/categories', controller.getCategories);
router.get('/foods/:id', validate({ params: idParamSchema }), controller.getFood);

// The user's own food logs.
router.get('/food-logs', validate({ query: foodLogQuerySchema }), controller.listFoodLogs);
router.post('/food-logs', validate({ body: createFoodLogSchema }), controller.createFoodLog);
router.post(
  '/food-logs/custom',
  validate({ body: customFoodLogSchema }),
  controller.createCustomFoodLog,
);
router.patch('/food-logs/:id', validate({ params: idParamSchema, body: updateFoodLogSchema }), controller.updateFoodLog);
router.delete('/food-logs/:id', validate({ params: idParamSchema }), controller.deleteFoodLog);

// Nutrition summaries.
router.get('/today', validate({ query: dayQuerySchema }), controller.getTodayNutrition);
router.get('/history', validate({ query: dateRangeQuerySchema }), controller.getNutritionHistory);

// Meal plans.
router.get('/meals/today', controller.getTodayMeals);
router.get('/meals', validate({ query: dayQuerySchema }), controller.getMealPlan);
router.post('/meals/generate', validate({ query: mealPlanSchema }), controller.generateMealPlan);

export default router;
