import { Router } from 'express';
import * as controller from '../controllers/achievement.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();
router.use(requireAuth);

const categoryQuerySchema = z.object({
  category: z.string().trim().max(40).optional(),
});

router.get('/', validate({ query: categoryQuerySchema }), controller.list);
router.get('/summary', controller.getSummary);
router.get('/stats', controller.getStats);
router.post('/evaluate', controller.evaluate);

export default router;
