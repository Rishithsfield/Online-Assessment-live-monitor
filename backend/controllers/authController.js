import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Recruiter from '../models/Recruiter.js';
import Invite from '../models/Invite.js';
import Session from '../models/Session.js';

export async function registerRecruiter(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required and cannot be blank' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required and cannot be blank' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required and cannot be blank' });
    }

    const existing = await Recruiter.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Recruiter account already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const recruiter = await Recruiter.create({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      name: name.trim()
    });

    const token = jwt.sign(
      { userId: recruiter._id, role: 'recruiter', name: recruiter.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ token, role: 'recruiter', name: recruiter.name });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
}

export async function loginRecruiter(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required and cannot be blank' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required and cannot be blank' });
    }

    const recruiter = await Recruiter.findOne({ email: email.trim().toLowerCase() });
    if (!recruiter) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password.trim(), recruiter.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: recruiter._id, role: 'recruiter', name: recruiter.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role: 'recruiter', name: recruiter.name });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}

export async function loginCandidate(req, res) {
  try {
    const { role, name, accessCode } = req.body;
    const userId = `user_${Date.now()}`;

    if (role === 'candidate') {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Candidate name is required and cannot be blank' });
      }
      if (!accessCode || !accessCode.trim()) {
        return res.status(400).json({ error: 'Access code is required and cannot be blank' });
      }

      const invite = await Invite.findOne({ code: accessCode.trim().toUpperCase() });
      if (!invite) {
        return res.status(401).json({ error: 'Invalid access code' });
      }

      if (invite.status === 'used') {
        return res.status(403).json({ error: 'This access code has already been used' });
      }

      const cleanedName = name.trim();
      const activeSessionsCount = await Session.countDocuments({
        recruiterId: invite.recruiterId,
        status: 'active'
      });

      if (activeSessionsCount >= 100) {
        return res.status(403).json({
          error: 'Exam room is currently at maximum candidate capacity (100). Please contact the recruiter.'
        });
      }

      const sessionId = `session_${Date.now()}`;
      const session = await Session.create({
        id: sessionId,
        recruiterId: invite.recruiterId,
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

      const token = jwt.sign(
        {
          userId: session.candidateId,
          role: 'candidate',
          sessionId: session.id,
          name: session.name,
          recruiterId: invite.recruiterId ? String(invite.recruiterId) : null
        },
        process.env.JWT_SECRET,
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
}
