import { Router } from 'express';
import { createInvite, getInvites } from '../controllers/inviteController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, requireRole('recruiter'));
router.post('/', createInvite);
router.get('/', getInvites);

export default router;
