import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import { changePasswordSchema, loginSchema, logoutSchema, refreshSchema, registerSchema } from '../validators';

const router = Router();

// Tight limiter on every credential endpoint to blunt brute-force attacks.
router.post('/register', authRateLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authRateLimiter, validate({ body: loginSchema }), controller.login);

// Refresh is rate limited too: it issues new tokens, so it must not be free.
router.post('/refresh', authRateLimiter, validate({ body: refreshSchema }), controller.refresh);

// optionalAuth rather than requireAuth: logout has to work when the access token
// has already expired, otherwise a stale client can never clear its session.
router.post('/logout', optionalAuth, validate({ body: logoutSchema }), controller.logout);

router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), controller.changePassword);

export default router;
