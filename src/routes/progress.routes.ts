import { Router } from 'express';
import * as controller from '../controllers/progress.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { monthlyQuerySchema, progressQuerySchema, weeklyQuerySchema } from '../validators';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: progressQuerySchema }), controller.getOverview);
router.get('/daily', controller.getDaily);
router.get('/weekly', validate({ query: weeklyQuerySchema }), controller.getWeekly);
router.get('/monthly', validate({ query: monthlyQuerySchema }), controller.getMonthly);
router.get('/streak', controller.getStreak);
router.get('/summary', controller.getSummary);
router.post('/sync', controller.sync);

export default router;
