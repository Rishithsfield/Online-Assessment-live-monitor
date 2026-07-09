import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Settings from './models/Settings.js';
import Exam from './models/Exam.js';
import Session from './models/Session.js';
import Telemetry from './models/Telemetry.js';
import Recruiter from './models/Recruiter.js';
import Invite from './models/Invite.js';
import { authMiddleware, requireRole } from './middleware/auth.js';
import { executeCode } from './services/judge0.js';

// ── MongoDB Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/examdb', {
  serverSelectionTimeoutMS: 10000,
}).then(async () => {
  console.log('✅ MongoDB connected');

  // Seed defaults if they don't exist
  let settings = await Settings.findOne();
  if (!settings) {
    await Settings.create({
      weights: { blur: 15, paste: 25, macro: 40 },
      thresholds: { suspicious: 40, danger: 75 }
    });
    console.log('  → Default settings seeded');
  }

  let exam = await Exam.findOne();
  if (!exam) {
    await Exam.create({
      duration: 3600,
      status: 'draft',
      questions: [
        {
          id: 1,
          title: 'Two Sum',
          functionName: 'twoSum',
          text: 'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
          constraints: '- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- -10^9 <= target <= 10^9\n- Only one valid answer exists.',
          testcases: [
            { id: 1, input: '[2,7,11,15], 9', expectedOutput: '[0,1]' },
            { id: 2, input: '[3,2,4], 6', expectedOutput: '[1,2]' },
            { id: 3, input: '[3,3], 6', expectedOutput: '[0,1]' },
          ]
        }
      ]
    });
    console.log('  → Default exam seeded');
  }
}).catch(err => console.error('❌ MongoDB connection error:', err.message));

// ── Fraud Score Calculator ────────────────────────────────────────────────────
const calculateFraudScore = async (blur, paste, macro, copy = 0) => {
  const settings = await Settings.findOne();
  const { weights } = settings;
  return Math.min(100, blur * weights.blur + paste * weights.paste + macro * weights.macro + copy * weights.paste);
};

// ── Server Bootstrap ──────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  const activeSockets = new Map(); // sessionId -> socket
  let telemetryQueue = [];
  const telemetryCounts = new Map(); // sessionId -> count

  // Flush telemetry batch queue to DB every 4 seconds
  setInterval(async () => {
    if (telemetryQueue.length === 0) return;
    const currentBatch = [...telemetryQueue];
    telemetryQueue = [];

    try {
      await Telemetry.insertMany(currentBatch);
    } catch (err) {
      console.error('Failed to flush telemetry batch:', err.message);
    }
  }, 4000);

  // ── REST API ──────────────────────────────────────────────────────────────

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uptime: process.uptime()
    });
  });

  // Recruiter signup
  app.post('/api/auth/recruiter/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      const existing = await Recruiter.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ error: 'Recruiter account already exists with this email' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const recruiter = await Recruiter.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || 'Recruiter Admin'
      });

      const token = jwt.sign(
        { userId: recruiter._id, role: 'recruiter', name: recruiter.name },
        process.env.JWT_SECRET || 'super_secret_jwt_key_123!',
        { expiresIn: '1d' }
      );

      res.status(201).json({ token, role: 'recruiter', name: recruiter.name });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
  });

  // Recruiter login
  app.post('/api/auth/recruiter/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const recruiter = await Recruiter.findOne({ email: email.toLowerCase() });
      if (!recruiter) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, recruiter.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { userId: recruiter._id, role: 'recruiter', name: recruiter.name },
        process.env.JWT_SECRET || 'super_secret_jwt_key_123!',
        { expiresIn: '1d' }
      );

      res.json({ token, role: 'recruiter', name: recruiter.name });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed: ' + err.message });
    }
  });

  // Candidate login (with Invite Code)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { role, name, accessCode } = req.body;
      const userId = `user_${Date.now()}`;

      if (role === 'candidate') {
        if (!accessCode) {
          return res.status(400).json({ error: 'Access code is required for candidates' });
        }
        
        const invite = await Invite.findOne({ code: accessCode.trim().toUpperCase() });
        if (!invite) {
          return res.status(401).json({ error: 'Invalid access code' });
        }

        const cleanedName = (name || 'Anonymous Candidate').trim();

        let session = await Session.findOne({ name: cleanedName, status: 'active' });

        if (!session) {
          if (invite.status === 'used') {
            return res.status(403).json({ error: 'This access code has already been used' });
          }

          const activeSessionsCount = await Session.countDocuments({ status: 'active' });
          if (activeSessionsCount >= 100) {
            return res.status(403).json({ error: 'Exam room is currently at maximum candidate capacity (100). Please contact the recruiter.' });
          }

          const sessionId = `session_${Date.now()}`;
          session = await Session.create({
            id: sessionId,
            candidateId: userId,
            name: cleanedName,
            code: '// Write your solution here\n',
            language: 'javascript',
            status: 'active',
            fraudScore: 0,
            stats: { blur: 0, paste: 0, macro: 0, copy: 0 },
            startTime: Date.now()
          });

          invite.status = 'used';
          invite.usedBy = sessionId;
          await invite.save();
        }

        const token = jwt.sign(
          { userId: session.candidateId, role: 'candidate', sessionId: session.id, name: session.name },
          process.env.JWT_SECRET || 'super_secret_jwt_key_123!',
          { expiresIn: '1d' }
        );

        res.json({ token, role, sessionId: session.id, name: session.name });
      } else {
        res.status(400).json({ error: 'Invalid login route for recruiter.' });
      }
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to login: ' + err.message });
    }
  });

  // Generate candidate invite code
  app.post('/api/invites', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      const code = `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const invite = await Invite.create({ code });
      res.status(201).json(invite.toObject());
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate invite: ' + err.message });
    }
  });

  // Get all invite codes
  app.get('/api/invites', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      const invites = await Invite.find().sort({ createdAt: -1 });
      res.json(invites.map(i => i.toObject()));
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch invites: ' + err.message });
    }
  });

  // Get all sessions
  app.get('/api/sessions', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      const sessions = await Session.find();
      res.json(sessions.map(s => s.toObject()));
    } catch (err) {
      console.error('Sessions error:', err);
      res.status(500).json({ error: 'Failed to fetch sessions: ' + err.message });
    }
  });

  // Execute code via Judge0
  app.post('/api/execute', authMiddleware, async (req, res) => {
    const { language, code, input, functionName } = req.body;
    try {
      const output = await executeCode(language, code, input, functionName);
      res.json({ output });
    } catch (e) {
      res.status(500).json({ error: 'Execution failed' });
    }
  });

  // Socket.io Handshake Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123!');
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token invalid or expired'));
    }
  });

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {

    // Recruiter joins monitoring room and immediately gets all current sessions
    socket.on('join_recruiter', async () => {
      socket.join('recruiter_monitor');
      try {
        const sessions = await Session.find();
        socket.emit('initial_state', sessions.map(s => s.toObject()));
      } catch (err) {
        console.error('Failed to send initial state:', err.message);
      }
    });

    // Candidate joins their personal room
    socket.on('join_candidate', async ({ sessionId }) => {
      socket.join(sessionId);

      // Multi-device prevention check
      const existingSocket = activeSockets.get(sessionId);
      if (existingSocket && existingSocket.id !== socket.id) {
        existingSocket.emit('force_logout', { reason: 'Duplicate session detected. Logged in from another device/tab.' });
        setTimeout(() => {
          existingSocket.disconnect(true);
        }, 500);

        const session = await Session.findOne({ id: sessionId });
        if (session) {
          session.stats.macro += 1;
          session.fraudScore = await calculateFraudScore(
            session.stats.blur,
            session.stats.paste,
            session.stats.macro,
            session.stats.copy || 0
          );
          await session.save();

          io.to('recruiter_monitor').emit('session_updated', session.toObject());

          const alertMsg = 'Multi-device login warning. Previous device disconnected.';
          io.to('recruiter_monitor').emit('fraud_alert_triggered', {
            id: `alert_${Date.now()}`,
            sessionId,
            candidateName: session.name,
            eventType: 'macro',
            fraudScore: session.fraudScore,
            timestamp: Date.now(),
            message: alertMsg
          });

          io.to('recruiter_monitor').emit('candidate_activity', {
            sessionId,
            candidateName: session.name,
            type: 'violation',
            message: alertMsg,
            timestamp: Date.now()
          });
        }
      }

      activeSockets.set(sessionId, socket);
      socket.sessionId = sessionId;
    });

    socket.on('language_update', async ({ sessionId, language }) => {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        session.language = language;
        await session.save();
        io.to('recruiter_monitor').emit('session_updated', session.toObject());
      }
    });

    socket.on('code_update', async ({ sessionId, code }) => {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        session.code = code;
        await session.save();
        io.to('recruiter_monitor').emit('session_updated', session.toObject());
      }
    });

    socket.on('candidate_run', async ({ sessionId }) => {
      const session = await Session.findOne({ id: sessionId });
      if (session) {
        io.to('recruiter_monitor').emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'run',
          message: 'Ran code against sample testcases',
          timestamp: Date.now()
        });
      }
    });

    socket.on('submit_code', async ({ sessionId, questionId, code, score }) => {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        const currentScores = session.scores || new Map();
        currentScores.set(String(questionId), score);
        session.scores = currentScores;

        if (score && score.passed >= 0) {
          if (!session.codeHistory) session.codeHistory = [];

          session.codeHistory.push({
            questionId,
            code,
            score,
            timestamp: Date.now(),
            id: Date.now().toString()
          });

          // Keep best submission per question
          const bestPerQuestion = {};
          for (const sub of session.codeHistory) {
            const qId = sub.questionId;
            if (!bestPerQuestion[qId]) {
              bestPerQuestion[qId] = sub;
            } else {
              const currentBest = bestPerQuestion[qId];
              const subPassed = sub.score?.passed || 0;
              const currentPassed = currentBest.score?.passed || 0;
              if (subPassed > currentPassed) {
                bestPerQuestion[qId] = sub;
              } else if (subPassed === currentPassed && sub.code.length < currentBest.code.length) {
                bestPerQuestion[qId] = sub;
              }
            }
          }
          session.codeHistory = Object.values(bestPerQuestion);
        }

        await session.save();
        io.to('recruiter_monitor').emit('session_updated', session.toObject());
        io.to('recruiter_monitor').emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'submit',
          message: `Submitted answer. Passed ${score.passed}/${score.total} testcases.`,
          timestamp: Date.now()
        });
      }
    });

    socket.on('submit_test', async ({ sessionId, score }) => {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        session.status = 'submitted';
        session.endTime = Date.now();
        if (score) {
          session.scores.set('final', score);
        }
        await session.save();
        io.to('recruiter_monitor').emit('session_updated', session.toObject());
        io.to('recruiter_monitor').emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'submit',
          message: score
            ? `Submitted the test. Final score: ${score.passed}/${score.total} testcases.`
            : 'Submitted the test.',
          timestamp: Date.now()
        });
      }
    });

    socket.on('telemetry_event', async (data) => {
      const { sessionId, eventType, timestamp } = data;
      const session = await Session.findOne({ id: sessionId });

      if (session && session.status === 'active') {
        // Enforce safe DB telemetry cap per session (max 150 items)
        let currentCount = telemetryCounts.get(sessionId);
        if (currentCount === undefined) {
          currentCount = await Telemetry.countDocuments({ sessionId });
          telemetryCounts.set(sessionId, currentCount);
        }

        if (currentCount < 150) {
          telemetryQueue.push({ sessionId, eventType, timestamp: timestamp || Date.now() });
          telemetryCounts.set(sessionId, currentCount + 1);
        }

        if (eventType === 'blur') session.stats.blur += 1;
        if (eventType === 'paste') session.stats.paste += 1;
        if (eventType === 'macro') session.stats.macro += 1;
        if (eventType === 'copy') session.stats.copy += 1;

        const oldScore = session.fraudScore;
        session.fraudScore = await calculateFraudScore(
          session.stats.blur,
          session.stats.paste,
          session.stats.macro,
          session.stats.copy || 0
        );

        await session.save();
        io.to('recruiter_monitor').emit('session_updated', session.toObject());
        io.to('recruiter_monitor').emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'violation',
          message: `Violation detected: ${eventType}`,
          timestamp: Date.now()
        });

        if (session.fraudScore > oldScore) {
          io.to('recruiter_monitor').emit('fraud_alert_triggered', {
            sessionId,
            candidateName: session.name,
            eventType,
            fraudScore: session.fraudScore,
            timestamp
          });
        }

        const settings = await Settings.findOne();
        if (session.fraudScore >= settings.thresholds.danger) {
          io.to(sessionId).emit('warning_prompt', {
            message: 'High risk anomaly detected. Please remain on this page.'
          });
        }
      }
    });

    socket.on('get_settings', async (callback) => {
      if (typeof callback === 'function') {
        const settings = await Settings.findOne();
        callback(settings);
      }
    });

    socket.on('get_exam', async (callback) => {
      if (typeof callback === 'function') {
        const exam = await Exam.findOne();
        callback(exam);
      }
    });

    socket.on('update_exam', async (newExam) => {
      if (newExam && newExam.questions) {
        let exam = await Exam.findOne();
        if (exam) {
          exam.duration = newExam.duration;
          exam.questions = newExam.questions;
          await exam.save();
        }
        io.emit('exam_updated', newExam);
      }
    });

    socket.on('start_exam', async () => {
      let exam = await Exam.findOne();
      if (exam) {
        exam.status = 'active';
        await exam.save();
        io.emit('exam_started', exam.toObject());
      }
    });

    socket.on('end_exam', async () => {
      let exam = await Exam.findOne();
      if (exam) {
        exam.status = 'finished';
        await exam.save();
        io.emit('exam_updated', exam.toObject());

        // Automatically submit all active candidate sessions
        const activeSessions = await Session.find({ status: 'active' });
        for (const session of activeSessions) {
          session.status = 'submitted';
          session.endTime = Date.now();
          await session.save();
          io.to(session.id).emit('test_submitted_auto');
        }

        // Send updated sessions to recruiter
        const sessions = await Session.find();
        io.to('recruiter_monitor').emit('initial_state', sessions.map(s => s.toObject()));
      }
    });

    socket.on('reset_exam', async () => {
      let exam = await Exam.findOne();
      if (exam) {
        exam.status = 'draft';
        await exam.save();
        io.emit('exam_updated', exam.toObject());

        // Clean all sessions, telemetry, and invites for a fresh start
        await Session.deleteMany({});
        await Telemetry.deleteMany({});
        await Invite.deleteMany({});
        telemetryQueue = [];
        telemetryCounts.clear();
        activeSockets.clear();
        io.to('recruiter_monitor').emit('initial_state', []);
        io.emit('invites_reset');
      }
    });


    socket.on('update_settings', async (newSettings) => {
      if (newSettings && newSettings.weights && newSettings.thresholds) {
        let settings = await Settings.findOne();
        if (settings) {
          settings.weights = newSettings.weights;
          settings.thresholds = newSettings.thresholds;
          await settings.save();

          // Recalculate fraud scores for all active sessions
          const activeSessions = await Session.find({ status: 'active' });
          for (const session of activeSessions) {
            session.fraudScore = await calculateFraudScore(
              session.stats.blur,
              session.stats.paste,
              session.stats.macro,
              session.stats.copy || 0
            );
            await session.save();
            io.to('recruiter_monitor').emit('session_updated', session.toObject());
          }
          io.to('recruiter_monitor').emit('settings_updated', settings);
        }
      }
    });

    socket.on('force_lockout', async ({ sessionId }) => {
      const session = await Session.findOne({ id: sessionId });
      if (session) {
        session.status = 'disqualified';
        await session.save();
        io.to(sessionId).emit('test_disqualified', { reason: 'Manual recruiter lockout' });
        io.to('recruiter_monitor').emit('session_updated', session.toObject());
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (socket.sessionId && activeSockets.get(socket.sessionId) === socket) {
        activeSockets.delete(socket.sessionId);
      }
    });
  });

  // ── Vite Middleware (Dev) / Static (Prod) ─────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
