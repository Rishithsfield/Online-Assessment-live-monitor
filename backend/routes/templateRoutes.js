import { Router } from 'express';
import { getTemplates, createTemplate, deleteTemplate } from '../controllers/templateController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, requireRole('recruiter'));
router.get('/', getTemplates);
router.post('/', createTemplate);
router.delete('/:id', deleteTemplate);

export default router;
