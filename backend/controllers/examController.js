import jwt from 'jsonwebtoken';
import Exam from '../models/Exam.js';
import Session from '../models/Session.js';
import Telemetry from '../models/Telemetry.js';
import Invite from '../models/Invite.js';
import { clearTelemetryBuffer } from '../services/telemetryBuffer.js';

export async function getExamHandler(req, res) {
  try {
    let recruiterId = req.user?.userId;
    if (!recruiterId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
        recruiterId = decoded.role === 'recruiter' ? decoded.userId : decoded.recruiterId;
      } catch (_) {}
    }
    if (!recruiterId && req.query.recruiterId) {
      recruiterId = req.query.recruiterId;
    }

    let exam = null;
    if (recruiterId) {
      exam = await Exam.findOne({ recruiterId });
      if (!exam) {
        exam = await Exam.create({ recruiterId, duration: 3600, status: 'draft', questions: [] });
      }
    } else {
      exam = await Exam.findOne();
      if (!exam) {
        exam = await Exam.create({ duration: 3600, status: 'draft', questions: [] });
      }
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
}

export async function updateExamHandler(req, res) {
  try {
    const recruiterId = req.user.userId;
    const { duration, questions } = req.body;
    const update = {};
    if (duration !== undefined) update.duration = duration;
    if (questions !== undefined) update.questions = questions;

    const exam = await Exam.findOneAndUpdate(
      { recruiterId },
      { $set: update },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
      io.to(`recruiter_monitor_${recruiterId}`).emit('exam_updated', exam.toObject());
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('updateExam error:', err);
    res.status(500).json({ error: 'Failed to update exam' });
  }
}

export async function startExamHandler(req, res) {
  try {
    const recruiterId = req.user.userId;
    const exam = await Exam.findOneAndUpdate(
      { recruiterId },
      { $set: { status: 'active' } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${recruiterId}`).emit('exam_started', exam.toObject());
      io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
      io.to(`recruiter_monitor_${recruiterId}`).emit('exam_started', exam.toObject());
      io.to(`recruiter_monitor_${recruiterId}`).emit('exam_updated', exam.toObject());
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('startExam error:', err);
    res.status(500).json({ error: 'Failed to start exam' });
  }
}

export async function endExamHandler(req, res) {
  try {
    const recruiterId = req.user.userId;
    const exam = await Exam.findOneAndUpdate(
      { recruiterId },
      { $set: { status: 'finished' } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    // Auto-submit all active candidate sessions belonging to this recruiter
    const now = Date.now();
    await Session.updateMany(
      { recruiterId, status: 'active' },
      { $set: { status: 'submitted', endTime: now } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
      io.to(`exam_${recruiterId}`).emit('exam_ended', exam.toObject());
      io.to(`exam_${recruiterId}`).emit('test_submitted_auto');

      const allSessions = await Session.find({ recruiterId });
      io.to(`recruiter_monitor_${recruiterId}`).emit('initial_state', allSessions.map(s => s.toObject()));
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('endExam error:', err);
    res.status(500).json({ error: 'Failed to end exam' });
  }
}

export async function resetExamHandler(req, res) {
  try {
    const recruiterId = req.user.userId;
    const exam = await Exam.findOneAndUpdate(
      { recruiterId },
      { $set: { status: 'draft', questions: [] } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    const mySessions = await Session.find({ recruiterId });
    const mySessionIds = mySessions.map(s => s.id);
    await Session.deleteMany({ recruiterId });
    if (mySessionIds.length > 0) {
      await Telemetry.deleteMany({ sessionId: { $in: mySessionIds } });
    }
    await Invite.deleteMany({ recruiterId });
    clearTelemetryBuffer();

    const io = req.app.get('io');
    if (io) {
      if (exam) {
        io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
      }
      io.to(`recruiter_monitor_${recruiterId}`).emit('initial_state', []);
      io.to(`recruiter_monitor_${recruiterId}`).emit('invites_reset');
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('resetExam error:', err);
    res.status(500).json({ error: 'Failed to reset exam' });
  }
}

