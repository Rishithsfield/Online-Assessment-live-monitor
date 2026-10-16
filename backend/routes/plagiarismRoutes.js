import { Router } from 'express';
import { getPlagiarismReport } from '../controllers/plagiarismController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/report', authMiddleware, requireRole('recruiter'), getPlagiarismReport);

export default router;
