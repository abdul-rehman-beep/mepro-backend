import type { Request, Response } from 'express';
import * as workoutService from '../services/workout.service';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import { ApiError } from '../utils/ApiError';
import type { WorkoutListQuery, YogaListQuery } from '../services/workout.service';
import type { CompleteSessionInput } from '../services/workout.service';
import { routeParam } from '../utils/http';

export async function listWorkouts(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<WorkoutListQuery>(req);
  const result = await workoutService.listWorkouts(query);
  return sendPaginated(res, result.items, result.total, result.page, result.limit, 'Workouts');
}

export async function getWorkout(req: Request, res: Response): Promise<Response> {
  const workout = await workoutService.getWorkout(routeParam(req, 'id'));
  return sendSuccess(res, workout, 'Workout');
}

export async function startWorkout(req: Request, res: Response): Promise<Response> {
  const result = await workoutService.startWorkoutSession(req.user!.id, routeParam(req, 'id'));
  return sendCreated(
    res,
    result,
    result.resumed ? 'Session resumed' : 'Workout started',
  );
}

export async function completeWorkout(req: Request, res: Response): Promise<Response> {
  const result = await workoutService.completeWorkoutSession(
    req.user!.id,
    routeParam(req, 'id'),
    req.body as CompleteSessionInput,
  );
  return sendSuccess(res, result, 'Workout complete. Great work');
}

export async function getSession(req: Request, res: Response): Promise<Response> {
  const session = await workoutService.getSession(req.user!.id, routeParam(req, 'id'));
  return sendSuccess(res, session, 'Session');
}

export async function getActiveSession(req: Request, res: Response): Promise<Response> {
  const session = await workoutService.getActiveSession(req.user!.id);
  return sendSuccess(res, session, session ? 'Active session' : 'No active session');
}

export async function abandonSession(req: Request, res: Response): Promise<Response> {
  const result = await workoutService.abandonSession(req.user!.id, routeParam(req, 'id'));
  if (!result.abandoned) throw ApiError.notFound('No in-progress session found');
  return sendSuccess(res, result, 'Session abandoned');
}

export async function getHistory(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<{ page?: number; limit?: number; type?: 'workout' | 'yoga' | 'all' }>(req);
  const result = await workoutService.listHistory(req.user!.id, query);
  return sendPaginated(res, result.items, result.total, result.page, result.limit, 'Workout history');
}

export async function getStats(req: Request, res: Response): Promise<Response> {
  const stats = await workoutService.getWorkoutStats(req.user!.id);
  return sendSuccess(res, stats, 'Workout statistics');
}

/* ---------------------------- Yoga ---------------------------- */

export async function listYoga(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<YogaListQuery>(req);
  const result = await workoutService.listYoga(query);
  return sendPaginated(res, result.items, result.total, result.page, result.limit, 'Yoga routines');
}

export async function getYoga(req: Request, res: Response): Promise<Response> {
  const routine = await workoutService.getYoga(routeParam(req, 'id'));
  return sendSuccess(res, routine, 'Yoga routine');
}

export async function completeYoga(req: Request, res: Response): Promise<Response> {
  const result = await workoutService.completeYogaSession(
    req.user!.id,
    routeParam(req, 'id'),
    req.body as CompleteSessionInput,
  );
  return sendSuccess(res, result, 'Yoga session complete');
}
