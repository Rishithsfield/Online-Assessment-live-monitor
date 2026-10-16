import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import inviteRoutes from './inviteRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import templateRoutes from './templateRoutes.js';
import aiRoutes from './aiRoutes.js';
import executeRoutes from './executeRoutes.js';
import plagiarismRoutes from './plagiarismRoutes.js';
import examRoutes from './examRoutes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

router.use('/auth', authRoutes);
router.use('/invites', inviteRoutes);
router.use('/sessions', sessionRoutes);
router.use('/templates', templateRoutes);
router.use('/ai', aiRoutes);
router.use('/execute', executeRoutes);
router.use('/plagiarism', plagiarismRoutes);
router.use('/exam', examRoutes);

export default router;
