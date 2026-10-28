import type { Request, Response } from 'express';
import * as achievementService from '../services/achievement.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<Response> {
  const category = (req.query as { category?: string }).category;
  const result = await achievementService.listAchievements(req.user!.id, category);
  return sendSuccess(res, result, 'Achievements');
}

export async function getSummary(req: Request, res: Response): Promise<Response> {
  const summary = await achievementService.getAchievementSummary(req.user!.id);
  return sendSuccess(res, summary, 'Achievement summary');
}

export async function getStats(req: Request, res: Response): Promise<Response> {
  const stats = await achievementService.getAchievementStats(req.user!.id);
  return sendSuccess(res, stats, 'Achievement statistics');
}

/** Lets the client ask for a re-check, e.g. after an offline workout. */
export async function evaluate(req: Request, res: Response): Promise<Response> {
  const earned = await achievementService.evaluateAchievements(req.user!.id);
  return sendSuccess(res, { earned, count: earned.length }, earned.length ? 'New achievements' : 'Nothing new');
}
