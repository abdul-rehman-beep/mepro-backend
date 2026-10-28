import { Router } from 'express';
import * as controller from '../controllers/user.controller';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import {
  avatarSchema,
  bmiBodySchema,
  bmiQuerySchema,
  deviceTokenSchema,
  notificationSettingsSchema,
  onboardingSchema,
  updateProfileSchema,
  weightLogSchema,
} from '../validators';

const router = Router();

// Every user route is authenticated, and the user id always comes from the token.
router.use(requireAuth);

router.get('/profile', controller.getProfile);
router.patch('/profile', validate({ body: updateProfileSchema }), controller.updateProfile);

router.get('/onboarding', controller.getOnboardingState);
router.post('/onboarding', validate({ body: onboardingSchema }), controller.completeOnboarding);

router.patch('/avatar', validate({ body: avatarSchema }), controller.updateAvatar);

router.get('/notification-settings', controller.getNotificationSettings);
router.patch('/notification-settings', validate({ body: notificationSettingsSchema }), controller.updateNotificationSettings);

router.post('/device-token', validate({ body: deviceTokenSchema }), controller.registerDeviceToken);
router.delete('/device-token', validate({ body: deviceTokenSchema }), controller.removeDeviceToken);

router.get('/account', controller.getAccountSummary);
router.delete('/account', controller.deleteAccount);

// BMI: GET derives it from the stored profile unless values are passed in.
router.get('/bmi', validate({ query: bmiQuerySchema }), controller.getBmi);
router.post('/bmi', validate({ body: bmiBodySchema }), controller.getBmi);

router.post('/weight', validate({ body: weightLogSchema }), controller.logWeight);

router.post('/reminders/seed', controller.seedReminders);

export default router;
