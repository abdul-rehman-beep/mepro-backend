import { Router } from 'express';
import * as controller from '../controllers/goal.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { goalCreateSchema, goalProgressSchema, goalUpdateSchema, idParamSchema, paginationSchema } from '../validators';
import { z } from 'zod';
const router = Router();
router.use(requireAuth);

const statusQuerySchema = paginationSchema.extend({
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

router.get('/', validate({ query: statusQuerySchema }), controller.list);
router.post('/', validate({ body: goalCreateSchema }), controller.create);
router.get('/stats', controller.getStats);
router.post('/sync', controller.syncAllForUser);

router.get('/:id', validate({ params: idParamSchema }), controller.getOne);
router.patch('/:id', validate({ params: idParamSchema, body: goalUpdateSchema }), controller.update);
router.delete('/:id', validate({ params: idParamSchema }), controller.remove);
router.post('/:id/progress', validate({ params: idParamSchema, body: goalProgressSchema }), controller.setProgress);

export default router;
