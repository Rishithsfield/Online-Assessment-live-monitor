import { Router } from 'express';
import { executeCodeHandler } from '../controllers/executeController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, executeCodeHandler);

export default router;
