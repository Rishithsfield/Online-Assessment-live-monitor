import { Router } from 'express';
import { generateQuestion } from '../controllers/aiController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/generate-question', authMiddleware, requireRole('recruiter'), generateQuestion);

export default router;
