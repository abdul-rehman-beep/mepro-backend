import type { Request, Response } from 'express';
import * as nutritionService from '../services/nutrition.service';
import { sendCreated, sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import type { LogWaterInput } from '../services/nutrition.service';
import { routeParam } from '../utils/http';

export async function getToday(req: Request, res: Response): Promise<Response> {
  const { day } = getValidatedQuery<{ day?: string }>(req);
  const result = await nutritionService.getHydrationToday(req.user!.id, day);
  return sendSuccess(res, result, 'Hydration status');
}

export async function log(req: Request, res: Response): Promise<Response> {
  const result = await nutritionService.logWater(req.user!.id, req.body as LogWaterInput);
  return sendCreated(res, result, 'Water logged');
}

export async function getHistory(req: Request, res: Response): Promise<Response> {
  const { days } = getValidatedQuery<{ days: number }>(req);
  const result = await nutritionService.getHydrationHistory(req.user!.id, days);
  return sendSuccess(res, result, 'Hydration history');
}

export async function removeLog(req: Request, res: Response): Promise<Response> {
  const result = await nutritionService.removeWaterLog(req.user!.id, routeParam(req, 'id'));
  return sendSuccess(res, result, 'Water entry removed');
}
