import { Router } from 'express';
import {
  getExamHandler,
  updateExamHandler,
  startExamHandler,
  endExamHandler,
  resetExamHandler
} from '../controllers/examController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// Public/Candidate can view exam config
router.get('/', getExamHandler);

// Recruiter operations
router.use(authMiddleware, requireRole('recruiter'));
router.put('/', updateExamHandler);
router.post('/start', startExamHandler);
router.post('/end', endExamHandler);
router.post('/reset', resetExamHandler);

export default router;
