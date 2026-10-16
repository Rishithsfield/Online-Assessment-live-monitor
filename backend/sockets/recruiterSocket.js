import Session from '../models/Session.js';
import Exam from '../models/Exam.js';
import Settings from '../models/Settings.js';
import Invite from '../models/Invite.js';
import Telemetry from '../models/Telemetry.js';
import { calculateFraudScore } from '../services/fraudScore.js';
import { clearTelemetryBuffer } from '../services/telemetryBuffer.js';

export function registerRecruiterHandlers(io, socket, activeSockets) {
  // Recruiter joins monitoring room and gets all current sessions
  socket.on('join_recruiter', async () => {
    socket.join('recruiter_monitor');
    try {
      const sessions = await Session.find();
      const mapped = sessions.map(s => (s.toSafeJSON ? s.toSafeJSON() : s.toObject()));
      socket.emit('initial_state', mapped);
    } catch (err) {
      console.error('Failed to send initial state:', err.message);
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
    try {
      if (newExam && newExam.questions) {
        const update = { questions: newExam.questions };
        if (newExam.duration !== undefined) update.duration = newExam.duration;
        const exam = await Exam.findOneAndUpdate(
          {},
          { $set: update },
          { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );
        if (exam) {
          io.emit('exam_updated', exam.toObject());
        }
      }
    } catch (err) {
      console.error('update_exam error:', err);
    }
  });

  socket.on('start_exam', async (callback) => {
    try {
      const exam = await Exam.findOneAndUpdate(
        {},
        { $set: { status: 'active' } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      io.emit('exam_started', exam.toObject());
      io.emit('exam_updated', exam.toObject());
      if (typeof callback === 'function') callback({ success: true, exam: exam.toObject() });
    } catch (err) {
      console.error('start_exam error:', err);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('end_exam', async (callback) => {
    try {
      const exam = await Exam.findOneAndUpdate(
        {},
        { $set: { status: 'finished' } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      io.emit('exam_updated', exam.toObject());
      io.emit('exam_ended', exam.toObject());
      io.emit('test_submitted_auto');

      // Automatically submit all active candidate sessions
      const now = Date.now();
      await Session.updateMany({ status: 'active' }, { $set: { status: 'submitted', endTime: now } });

      // Send updated sessions to recruiter
      const sessions = await Session.find();
      io.to('recruiter_monitor').emit('initial_state', sessions.map(s => s.toObject()));

      if (typeof callback === 'function') callback({ success: true, status: 'finished' });
    } catch (err) {
      console.error('end_exam error:', err);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('reset_exam', async (callback) => {
    try {
      const exam = await Exam.findOneAndUpdate(
        {},
        { $set: { status: 'draft', questions: [] } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      if (exam) {
        io.emit('exam_updated', exam.toObject());
      }

      // Clean all sessions, telemetry, and invites for a fresh start
      await Session.deleteMany({});
      await Telemetry.deleteMany({});
      await Invite.deleteMany({});
      clearTelemetryBuffer();
      activeSockets.clear();
      io.to('recruiter_monitor').emit('initial_state', []);
      io.emit('invites_reset');
      if (typeof callback === 'function') callback({ success: true, status: 'draft' });
    } catch (err) {
      console.error('reset_exam error:', err);
      if (typeof callback === 'function') callback({ error: err.message });
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
          io.to('recruiter_monitor').emit('session_updated', session.toSafeJSON ? session.toSafeJSON() : session.toObject());
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
      io.to('recruiter_monitor').emit('session_updated', session.toSafeJSON ? session.toSafeJSON() : session.toObject());
    }
  });
}
