import type { Request, Response } from 'express';
import * as yogaService from '../services/workout.service';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import type { YogaListQuery } from '../services/workout.service';
import type { CompleteSessionInput } from '../services/workout.service';
import { routeParam } from '../utils/http';

// The Yoga domain reuses the workout service; these thin wrappers keep the
// route files symmetrical with the rest of the API and leave room for yoga
// specific logic to be added without touching routes.

export const list = async (req: Request, res: Response): Promise<Response> => {
  const query = getValidatedQuery<YogaListQuery>(req);
  const result = await yogaService.listYoga(query);
  return sendPaginated(res, result.items, result.total, result.page, result.limit, 'Yoga routines');
};

export const getOne = async (req: Request, res: Response): Promise<Response> => {
  const routine = await yogaService.getYoga(routeParam(req, 'id'));
  return sendSuccess(res, routine, 'Yoga routine');
};

export const complete = async (req: Request, res: Response): Promise<Response> => {
  const result = await yogaService.completeYogaSession(
    req.user!.id,
    routeParam(req, 'id'),
    req.body as CompleteSessionInput,
  );
  return sendCreated(res, result, 'Yoga session complete');
};
