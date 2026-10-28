import type { Request, Response } from 'express';
import * as nutritionService from '../services/nutrition.service';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import { ApiError } from '../utils/ApiError';
import type { CreateCustomFoodLogInput, CreateFoodLogInput, FoodSearchQuery } from '../services/nutrition.service';
import { routeParam } from '../utils/http';

export async function searchFoods(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<FoodSearchQuery>(req);
  const result = await nutritionService.searchFoods(query);
  return sendPaginated(
    res,
    result.items,
    result.total,
    result.page,
    result.limit,
    'Foods',
  );
}

export async function getFood(req: Request, res: Response): Promise<Response> {
  const food = await nutritionService.getFood(routeParam(req, 'id'));
  return sendSuccess(res, food, 'Food');
}

export async function getCategories(req: Request, res: Response): Promise<Response> {
  const categories = await nutritionService.getFoodCategories();
  return sendSuccess(res, categories, 'Food categories');
}

export async function createFoodLog(req: Request, res: Response): Promise<Response> {
  const log = await nutritionService.createFoodLog(req.user!.id, req.body as CreateFoodLogInput);
  return sendCreated(res, log, 'Food logged');
}

export async function createCustomFoodLog(req: Request, res: Response): Promise<Response> {
  const log = await nutritionService.createCustomFoodLog(
    req.user!.id,
    req.body as CreateCustomFoodLogInput,
  );
  return sendCreated(res, log, 'Food logged');
}

export async function updateFoodLog(req: Request, res: Response): Promise<Response> {
  const log = await nutritionService.updateFoodLog(req.user!.id, routeParam(req, 'id'), req.body);
  return sendSuccess(res, log, 'Food log updated');
}

export async function deleteFoodLog(req: Request, res: Response): Promise<Response> {
  const result = await nutritionService.deleteFoodLog(req.user!.id, routeParam(req, 'id'));
  return sendSuccess(res, result, 'Food log removed');
}

export async function listFoodLogs(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<{
    page?: number;
    limit?: number;
    day?: string;
    mealType?: string;
    startDate?: string;
    endDate?: string;
  }>(req);
  const result = await nutritionService.listFoodLogs(req.user!.id, query);
  return sendPaginated(res, result.items, result.total, result.page, result.limit, 'Food logs');
}

export async function getTodayNutrition(req: Request, res: Response): Promise<Response> {
  const { day } = getValidatedQuery<{ day?: string }>(req);
  const summary = await nutritionService.getDailyNutrition(req.user!.id, day);
  return sendSuccess(res, summary, 'Today nutrition');
}

export async function getNutritionHistory(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<{ startDate?: string; endDate?: string }>(req);
  const history = await nutritionService.getNutritionHistory(req.user!.id, query);
  return sendSuccess(res, history, 'Nutrition history');
}

export async function getMealPlan(req: Request, res: Response): Promise<Response> {
  const { day } = getValidatedQuery<{ day?: string }>(req);
  const plan = await nutritionService.getMealPlan(req.user!.id, day);
  if (!plan) throw ApiError.notFound('No meal plan for this day yet');
  return sendSuccess(res, plan, 'Meal plan');
}

export async function generateMealPlan(req: Request, res: Response): Promise<Response> {
  const { day } = getValidatedQuery<{ day?: string }>(req);
  const plan = await nutritionService.generateMealPlan(req.user!.id, day);
  return sendSuccess(res, plan, 'Meal plan generated');
}

export async function getTodayMeals(req: Request, res: Response): Promise<Response> {
  const result = await nutritionService.getTodayMeals(req.user!.id);
  return sendSuccess(res, result, 'Today meals');
}
