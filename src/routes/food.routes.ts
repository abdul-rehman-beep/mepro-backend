import { Router } from 'express';
import * as controller from '../controllers/food.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createFoodLogSchema,
  customFoodLogSchema,
  foodLogQuerySchema,
  foodSearchSchema,
  idParamSchema,
  updateFoodLogSchema,
} from '../validators';

/**
 * Thin, resource-oriented alias of the nutrition routes. The mobile client can
 * use either surface; both hit the same service layer and the same validation.
 */
const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: foodSearchSchema }), controller.search);
router.get('/categories', controller.categories);
router.get('/search', validate({ query: foodSearchSchema }), controller.search);
router.get('/:id', validate({ params: idParamSchema }), controller.getOne);

router.get('/logs/all', validate({ query: foodLogQuerySchema }), controller.listLogs);
router.post('/logs', validate({ body: createFoodLogSchema }), controller.createLog);
router.post('/logs/custom', validate({ body: customFoodLogSchema }), controller.createCustomLog);
router.patch('/logs/:id', validate({ params: idParamSchema, body: updateFoodLogSchema }), controller.updateLog);
router.delete('/logs/:id', validate({ params: idParamSchema }), controller.deleteLog);

export default router;
