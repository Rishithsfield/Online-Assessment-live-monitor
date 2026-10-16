import { Router } from 'express';
import { getSessions } from '../controllers/sessionController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, requireRole('recruiter'), getSessions);

export default router;
