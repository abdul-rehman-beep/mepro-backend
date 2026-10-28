import { Router } from 'express';
import * as controller from '../controllers/notification.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { idParamSchema, notificationListSchema } from '../validators';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: notificationListSchema }), controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/:id/read', validate({ params: idParamSchema }), controller.markRead);
router.patch('/read-all', controller.markAllRead);
router.delete('/:id', validate({ params: idParamSchema }), controller.remove);
router.delete('/', controller.clear);

export default router;
