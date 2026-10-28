import { Router } from 'express';
import * as controller from '../controllers/community.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { commentSchema, communityListSchema, communityPostSchema, idParamSchema, reportSchema } from '../validators';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: communityListSchema }), controller.list);
router.post('/', validate({ body: communityPostSchema }), controller.create);
router.get('/mine', controller.listMyPosts);

router.get('/:id', validate({ params: idParamSchema }), controller.getOne);
router.delete('/:id', validate({ params: idParamSchema }), controller.remove);

router.post('/:id/like', validate({ params: idParamSchema }), controller.toggleLike);

router.get('/:id/comments', validate({ params: idParamSchema }), controller.listComments);
router.post(
  '/:id/comments',
  validate({ params: idParamSchema, body: commentSchema }),
  controller.addComment,
);

router.post('/:id/report', validate({ params: idParamSchema, body: reportSchema }), controller.report);

export default router;
