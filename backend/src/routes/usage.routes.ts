import { Router } from 'express';
import usageController from '../controllers/usage.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/check', authenticate, usageController.checkAndRecord);
router.post('/log', authenticate, usageController.logUsage);
router.get('/me', authenticate, usageController.getMyUsage);
router.get('/admin', authenticate, usageController.getAdminUsage);

export default router;
