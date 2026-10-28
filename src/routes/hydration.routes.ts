import { Router } from 'express';
import * as controller from '../controllers/hydration.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { dayQuerySchema, idParamSchema, waterLogSchema, waterQuerySchema } from '../validators';

const router = Router();
router.use(requireAuth);

router.get('/today', validate({ query: dayQuerySchema }), controller.getToday);
router.post('/log', validate({ body: waterLogSchema }), controller.log);
router.get('/history', validate({ query: waterQuerySchema }), controller.getHistory);
router.delete('/log/:id', validate({ params: idParamSchema }), controller.removeLog);

export default router;
