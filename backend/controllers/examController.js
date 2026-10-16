import Exam from '../models/Exam.js';
import Session from '../models/Session.js';
import Telemetry from '../models/Telemetry.js';
import Invite from '../models/Invite.js';
import { clearTelemetryBuffer } from '../services/telemetryBuffer.js';

export async function getExamHandler(req, res) {
  try {
    let exam = await Exam.findOne();
    if (!exam) {
      exam = await Exam.create({ duration: 3600, status: 'draft', questions: [] });
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
}

export async function updateExamHandler(req, res) {
  try {
    const { duration, questions } = req.body;
    const update = {};
    if (duration !== undefined) update.duration = duration;
    if (questions !== undefined) update.questions = questions;

    const exam = await Exam.findOneAndUpdate(
      {},
      { $set: update },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('exam_updated', exam.toObject());
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('updateExam error:', err);
    res.status(500).json({ error: 'Failed to update exam' });
  }
}

export async function startExamHandler(req, res) {
  try {
    const exam = await Exam.findOneAndUpdate(
      {},
      { $set: { status: 'active' } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('exam_started', exam.toObject());
      io.emit('exam_updated', exam.toObject());
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('startExam error:', err);
    res.status(500).json({ error: 'Failed to start exam' });
  }
}

export async function endExamHandler(req, res) {
  try {
    const exam = await Exam.findOneAndUpdate(
      {},
      { $set: { status: 'finished' } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    // Auto-submit all active candidate sessions in MongoDB
    const now = Date.now();
    await Session.updateMany({ status: 'active' }, { $set: { status: 'submitted', endTime: now } });

    const io = req.app.get('io');
    if (io) {
      io.emit('exam_updated', exam.toObject());
      io.emit('exam_ended', exam.toObject());
      io.emit('test_submitted_auto');

      const allSessions = await Session.find();
      io.to('recruiter_monitor').emit('initial_state', allSessions.map(s => s.toObject()));
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('endExam error:', err);
    res.status(500).json({ error: 'Failed to end exam' });
  }
}

export async function resetExamHandler(req, res) {
  try {
    const exam = await Exam.findOneAndUpdate(
      {},
      { $set: { status: 'draft', questions: [] } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    await Session.deleteMany({});
    await Telemetry.deleteMany({});
    await Invite.deleteMany({});
    clearTelemetryBuffer();

    const io = req.app.get('io');
    if (io) {
      if (exam) io.emit('exam_updated', exam.toObject());
      io.to('recruiter_monitor').emit('initial_state', []);
      io.emit('invites_reset');
    }

    res.json({ success: true, exam });
  } catch (err) {
    console.error('resetExam error:', err);
    res.status(500).json({ error: 'Failed to reset exam' });
  }
}

