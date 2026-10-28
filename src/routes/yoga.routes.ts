import { Router } from 'express';
import * as controller from '../controllers/yoga.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { idParamSchema, yogaCompleteSchema, yogaListSchema } from '../validators';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: yogaListSchema }), controller.list);
router.get('/:id', validate({ params: idParamSchema }), controller.getOne);
router.post(
  '/:id/complete',
  validate({ params: idParamSchema, body: yogaCompleteSchema }),
  controller.complete,
);

export default router;
