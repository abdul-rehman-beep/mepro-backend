import { Router } from 'express';
import * as controller from '../controllers/ai.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { aiRateLimiter } from '../middleware/rate-limit.middleware';
import { assistantQuerySchema, feedbackSchema, idParamSchema, recommendationQuerySchema } from '../validators';

const router = Router();
router.use(requireAuth);

// AI is CPU-bound, so it carries its own (lower) request budget.
router.get('/status', controller.status);
router.get('/suggested-questions', controller.suggestedQuestions);
router.post('/warmup', controller.warmup);

router.get('/recommendations', validate({ query: recommendationQuerySchema }), controller.getRecommendations);
router.get('/recommendations/history', controller.getHistory);
router.delete('/recommendations/cache', controller.refresh);
router.post(
  '/recommendations/:id/feedback',
  validate({ params: idParamSchema, body: feedbackSchema }),
  controller.submitFeedback,
);

router.post('/assistant', aiRateLimiter, validate({ query: assistantQuerySchema }), controller.ask);
router.get('/assistant/conversations', controller.listConversations);
router.get('/assistant/conversations/:id', validate({ params: idParamSchema }), controller.getConversation);
router.delete('/assistant/conversations/:id', validate({ params: idParamSchema }), controller.deleteConversation);

export default router;
