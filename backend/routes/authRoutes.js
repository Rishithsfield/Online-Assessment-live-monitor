import { Router } from 'express';
import { registerRecruiter, loginRecruiter, loginCandidate } from '../controllers/authController.js';

const router = Router();

router.post('/recruiter/register', registerRecruiter);
router.post('/recruiter/login', loginRecruiter);
router.post('/login', loginCandidate);

export default router;
