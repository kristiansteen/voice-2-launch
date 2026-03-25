import { Router } from 'express';
import flowController from '../controllers/flow.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, flowController.list);
router.put('/:id', authenticate, flowController.upsert);
router.delete('/:id', authenticate, flowController.delete);

export default router;
