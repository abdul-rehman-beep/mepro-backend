import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { booleanQuery } from '../validators';

const router = Router();
router.use(requireAuth);

const dashboardQuerySchema = z.object({
  // The dashboard is the one place where skipping the AI block is genuinely
  // useful (slow networks, low battery), so it is a documented switch.
  includeAi: booleanQuery.optional().default(true),
});

router.get('/', validate({ query: dashboardQuerySchema }), controller.getDashboard);

export default router;
