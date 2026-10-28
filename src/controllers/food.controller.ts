import type { Request, Response } from 'express';
import * as nutritionService from '../services/nutrition.service';
import { sendCreated, sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import type { LogWaterInput } from '../services/nutrition.service';
import { routeParam } from '../utils/http';

// Food catalogue endpoints. Kept separate from the food-log endpoints so the
// mobile client can apply a different rate limit / cache policy to the
// (large, read-mostly) catalogue versus the user's own logs.

export const search = async (req: Request, res: Response): Promise<Response> => {
  const query = getValidatedQuery<Record<string, unknown>>(req);
  const result = await nutritionService.searchFoods(query as never);
  return sendSuccess(res, result, 'Foods');
};

export const getOne = async (req: Request, res: Response): Promise<Response> => {
  const food = await nutritionService.getFood(routeParam(req, 'id'));
  return sendSuccess(res, food, 'Food');
};

export const categories = async (_req: Request, res: Response): Promise<Response> => {
  const result = await nutritionService.getFoodCategories();
  return sendSuccess(res, result, 'Food categories');
};

export const createLog = async (req: Request, res: Response): Promise<Response> => {
  const log = await nutritionService.createFoodLog(req.user!.id, req.body);
  return sendCreated(res, log, 'Food logged');
};

export const createCustomLog = async (req: Request, res: Response): Promise<Response> => {
  const log = await nutritionService.createCustomFoodLog(req.user!.id, req.body);
  return sendCreated(res, log, 'Food logged');
};

export const updateLog = async (req: Request, res: Response): Promise<Response> => {
  const log = await nutritionService.updateFoodLog(req.user!.id, routeParam(req, 'id'), req.body);
  return sendSuccess(res, log, 'Food log updated');
};

export const deleteLog = async (req: Request, res: Response): Promise<Response> => {
  const result = await nutritionService.deleteFoodLog(req.user!.id, routeParam(req, 'id'));
  return sendSuccess(res, result, 'Food log removed');
};

export const listLogs = async (req: Request, res: Response): Promise<Response> => {
  const query = getValidatedQuery<Record<string, unknown>>(req);
  const result = await nutritionService.listFoodLogs(req.user!.id, query as never);
  return sendSuccess(res, result, 'Food logs');
};

export const logWater = async (req: Request, res: Response): Promise<Response> => {
  const result = await nutritionService.logWater(req.user!.id, req.body as LogWaterInput);
  return sendCreated(res, result, 'Water logged');
};
