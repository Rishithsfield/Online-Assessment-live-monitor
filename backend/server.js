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
import QuestionTemplate from './models/QuestionTemplate.js';
import Message from './models/Message.js';
import { authMiddleware, requireRole } from './middleware/auth.js';
import { executeCode } from './services/judge0.js';
import { checkAllSessionsPlagiarism } from './services/plagiarism.js';

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

  // Plagiarism report across all candidates
  app.get('/api/plagiarism/report', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      const sessions = await Session.find();
      const report = checkAllSessionsPlagiarism(sessions.map(s => s.toObject()));
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate plagiarism report: ' + err.message });
    }
  });

  // ── Question Template Library ───────────────────────────────────────────────

  // List templates (optional ?difficulty= and ?tag= query filters)
  app.get('/api/templates', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      const filter = {};
      if (req.query.difficulty) filter.difficulty = req.query.difficulty;
      if (req.query.tag) filter.tags = { $in: [req.query.tag] };
      const templates = await QuestionTemplate.find(filter).sort({ createdAt: -1 });
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch templates: ' + err.message });
    }
  });

  // Create a template manually
  app.post('/api/templates', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      const template = await QuestionTemplate.create(req.body);
      res.status(201).json(template);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create template: ' + err.message });
    }
  });

  // Delete a template
  app.delete('/api/templates/:id', authMiddleware, requireRole('recruiter'), async (req, res) => {
    try {
      await QuestionTemplate.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete template: ' + err.message });
    }
  });

  // ── AI Question Generation via Gemini ───────────────────────────────────────
  app.post('/api/ai/generate-question', authMiddleware, requireRole('recruiter'), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Gemini API key not configured. Add GEMINI_API_KEY to your .env file. Get one at https://aistudio.google.com/apikey'
      });
    }

    const { topic, difficulty, testCaseCount } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const numTestCases = Math.min(Math.max(testCaseCount || 3, 1), 10);
    const diffLevel = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

    const prompt = `Topic: ${topic}
Difficulty: ${diffLevel}
Number of test cases: ${numTestCases}

Generate a coding challenge as a JSON object matching this structure:
{
  "title": "Short descriptive title",
  "functionName": "camelCaseFunctionName",
  "text": "Full problem statement with examples. Use standard plain text for math (e.g. 10^9 + 7, a != b). Do NOT use LaTeX commands with backslashes like \\neq or \\frac.",
  "constraints": "Bullet-pointed constraints using standard text",
  "difficulty": "${diffLevel}",
  "tags": ["tag1", "tag2"],
  "boilerplate": {
    "javascript": "function camelCaseFunctionName(params) {\n  // Write your code here\n}",
    "python": "def snake_case_function_name(params):\n    # Write your code here\n    pass"
  },
  "testcases": [
    { "id": 1, "input": "arg1, arg2", "expectedOutput": "expected_result" }
  ]
}`;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      };

      const jsonSchema = {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          functionName: { type: 'STRING' },
          text: { type: 'STRING' },
          constraints: { type: 'STRING' },
          difficulty: { type: 'STRING' },
          tags: { type: 'ARRAY', items: { type: 'STRING' } },
          boilerplate: {
            type: 'OBJECT',
            properties: {
              javascript: { type: 'STRING' },
              python: { type: 'STRING' }
            },
            required: ['javascript', 'python']
          },
          testcases: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'INTEGER' },
                input: { type: 'STRING' },
                expectedOutput: { type: 'STRING' }
              },
              required: ['id', 'input', 'expectedOutput']
            }
          }
        },
        required: ['title', 'functionName', 'text', 'constraints', 'difficulty', 'tags', 'boilerplate', 'testcases']
      };

      const reqBody = JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "You are an automated API backend that outputs ONLY raw JSON adhering strictly to the provided response schema. Never output reasoning, test walkthroughs, markdown code fences, or LaTeX commands containing backslashes."
          }]
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: jsonSchema
        }
      });

      let geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
        { method: 'POST', headers, body: reqBody }
      );

      // Fallback to gemini-flash-latest if 1.5-flash is unavailable
      if (!geminiRes.ok) {
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          { method: 'POST', headers, body: reqBody }
        );
      }

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        console.error('Gemini API error:', geminiRes.status, errBody);
        let parsedErr = errBody;
        try {
          const jsonErr = JSON.parse(errBody);
          parsedErr = jsonErr.error?.message || errBody;
        } catch (_) { }
        return res.status(502).json({ error: `Gemini API returned ${geminiRes.status}: ${parsedErr}` });
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return res.status(502).json({ error: 'Empty response from Gemini API. Try again.' });
      }

      // Multi-pass Auto-Repairing JSON Parser
      let question;
      try {
        let cleaned = rawText.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        } else if (firstBrace !== -1) {
          cleaned = cleaned.substring(firstBrace);
        }

        // Pass 1: Direct JSON.parse
        try {
          question = JSON.parse(cleaned);
        } catch (e1) {
          // Pass 2: Truncated JSON Auto-repair + Invalid backslash & character escaping
          let inString = false;
          let escaped = false;
          let stack = [];
          let repaired = '';

          for (let i = 0; i < cleaned.length; i++) {
            const ch = cleaned[i];
            if (escaped) {
              repaired += ch;
              escaped = false;
              continue;
            }
            if (ch === '\\') {
              // Fix invalid JSON escape characters (e.g. LaTeX \neq, \frac)
              const nextChar = cleaned[i + 1];
              if (nextChar && !' "  / b f n r t u '.includes(nextChar)) {
                repaired += '\\\\';
              } else {
                repaired += ch;
                escaped = true;
              }
              continue;
            }
            if (ch === '"') {
              inString = !inString;
              repaired += ch;
              continue;
            }
            if (inString) {
              if (ch === '\n') { repaired += '\\n'; continue; }
              if (ch === '\r') { repaired += '\\r'; continue; }
              if (ch === '\t') { repaired += '\\t'; continue; }
              repaired += ch;
              continue;
            }

            if (ch === '{') stack.push('}');
            else if (ch === '[') stack.push(']');
            else if (ch === '}' || ch === ']') {
              if (stack.length > 0 && stack[stack.length - 1] === ch) {
                stack.pop();
              }
            }
            repaired += ch;
          }

          if (inString) repaired += '"';
          while (stack.length > 0) repaired += stack.pop();

          question = JSON.parse(repaired);
        }
      } catch (err) {
        console.error('Failed JSON raw output:', rawText);
        return res.status(502).json({ error: 'AI response was truncated or unparseable. Please click Generate Question again.' });
      }

      // Validate essential fields
      if (!question.title || !question.text || !question.testcases) {
        return res.status(502).json({ error: 'Gemini returned an incomplete question. Try again.' });
      }

      // Ensure IDs on test cases
      question.testcases = question.testcases.map((tc, i) => ({ ...tc, id: tc.id || i + 1 }));

      res.json(question);
    } catch (err) {
      console.error('AI generation error:', err);
      res.status(500).json({ error: 'Failed to generate question: ' + err.message });
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

    // ── Real-Time Proctor Chat ──────────────────────────────────────────────
    socket.on('get_chat_history', async ({ sessionId }, callback) => {
      try {
        const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
        if (typeof callback === 'function') {
          callback(messages);
        } else {
          socket.emit('chat_history', { sessionId, messages });
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    });

    socket.on('send_chat_message', async ({ sessionId, text, sender, senderName }) => {
      if (!sessionId || !text || !text.trim()) return;
      try {
        const msg = await Message.create({
          sessionId,
          sender: sender || 'candidate',
          senderName: senderName || 'User',
          text: text.trim(),
          timestamp: new Date()
        });

        const msgObj = msg.toObject();
        // Emit to the specific candidate session room
        io.to(sessionId).emit('new_chat_message', msgObj);
        // Emit to recruiter proctor monitors
        io.to('recruiter_monitor').emit('new_chat_message', msgObj);
      } catch (err) {
        console.error('Failed to send chat message:', err);
      }
    });

    socket.on('telemetry_event', async (data) => {
      const { sessionId, eventType, timestamp } = data;
      const session = await Session.findOne({ id: sessionId });
      const exam = await Exam.findOne();

      // Only record telemetry violations if BOTH the candidate session and the exam are active (started by recruiter)
      if (session && session.status === 'active' && exam && exam.status === 'active') {
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
        exam.questions = [];
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
