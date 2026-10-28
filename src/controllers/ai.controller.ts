import type { Request, Response } from 'express';
import * as recommendationService from '../services/ai/recommendation.service';
import * as assistantService from '../services/ai/assistant.service';
import { getModelStatus, isAiAvailable, waitForWarmup } from '../services/ai/model.service';
import { sendCreated, sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import { toObjectId } from '../services/workout.service';
import { ApiError } from '../utils/ApiError';
import { routeParam } from '../utils/http';

export async function getRecommendations(req: Request, res: Response): Promise<Response> {
  const { force, type } = getValidatedQuery<{ force: boolean; type?: 'workout' | 'nutrition' | 'hydration' | 'yoga' | 'overall' }>(req);
  const bundle = await recommendationService.getRecommendations(req.user!.id, { force, type });
  return sendSuccess(res, bundle, 'Recommendations');
}

export async function getHistory(req: Request, res: Response): Promise<Response> {
  const history = await recommendationService.getRecommendationHistory(req.user!.id, 20);
  return sendSuccess(res, history, 'Recommendation history');
}

export async function submitFeedback(req: Request, res: Response): Promise<Response> {
  const result = await recommendationService.recordRecommendationFeedback(
    req.user!.id,
    toObjectId(routeParam(req, 'id'), 'recommendationId').toString(),
    req.body,
  );
  if (!result.updated) throw ApiError.notFound('Recommendation not found');
  return sendSuccess(res, result, 'Thanks for the feedback');
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  const result = await recommendationService.invalidateRecommendations(req.user!.id);
  return sendSuccess(res, result, 'Recommendation cache cleared');
}

export async function ask(req: Request, res: Response): Promise<Response> {
  const { message, conversationId } = getValidatedQuery<{ message: string; conversationId?: string }>(req);
  const { reply, conversationId: conversation } = await assistantService.ask(req.user!.id, message, conversationId);
  // The answer is spread at the top level so the client reads `data.reply` as a
  // string and the supporting metadata as siblings, rather than unwrapping
  // `data.reply.reply`.
  return sendCreated(res, { ...reply, conversationId: conversation }, 'Answer ready');
}

export async function listConversations(req: Request, res: Response): Promise<Response> {
  const conversations = await assistantService.listConversations(req.user!.id, 20);
  return sendSuccess(res, conversations, 'Conversations');
}

export async function getConversation(req: Request, res: Response): Promise<Response> {
  const conversation = await assistantService.getConversation(req.user!.id, routeParam(req, 'id'));
  if (!conversation) throw ApiError.notFound('Conversation not found');
  return sendSuccess(res, conversation, 'Conversation');
}

export async function deleteConversation(req: Request, res: Response): Promise<Response> {
  const result = await assistantService.deleteConversation(req.user!.id, routeParam(req, 'id'));
  if (!result.deleted) throw ApiError.notFound('Conversation not found');
  return sendSuccess(res, result, 'Conversation deleted');
}

/**
 * Reports which provider served recent answers. Useful for the mobile "AI
 * status" panel and for verifying the fallback path actually works.
 */
export async function status(_req: Request, res: Response): Promise<Response> {
  const model = getModelStatus();
  return sendSuccess(
    res,
    {
      available: isAiAvailable(),
      model,
      fallbackActive: !isAiAvailable(),
      message: isAiAvailable()
        ? 'The AI model is loaded and recommendations are being personalised.'
        : 'Running the built-in rule engine. Every feature works without the AI model.',
    },
    'AI status',
  );
}

export async function warmup(_req: Request, res: Response): Promise<Response> {
  const ready = await waitForWarmup();
  return sendSuccess(res, { ready }, ready ? 'AI model ready' : 'AI model still loading or unavailable');
}

export async function suggestedQuestions(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, assistantService.SUGGESTED_QUESTIONS, 'Suggested questions');
}
