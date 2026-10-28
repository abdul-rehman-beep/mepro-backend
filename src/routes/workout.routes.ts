import { Router } from 'express';
import * as controller from '../controllers/workout.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import {
  historySchema,
  idParamSchema,
  workoutListSchema,
  workoutSessionSchema,
} from '../validators';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: workoutListSchema }), controller.listWorkouts);
router.get('/history', validate({ query: historySchema }), controller.getHistory);
router.get('/stats', controller.getStats);
router.get('/session/active', controller.getActiveSession);

router.get('/:id', validate({ params: idParamSchema }), controller.getWorkout);
router.post('/:id/start', validate({ params: idParamSchema }), controller.startWorkout);
router.post(
  '/:id/complete',
  validate({ params: idParamSchema, body: workoutSessionSchema }),
  controller.completeWorkout,
);

router.get('/sessions/:id', validate({ params: idParamSchema }), controller.getSession);
router.delete('/sessions/:id', validate({ params: idParamSchema }), controller.abandonSession);

export default router;
