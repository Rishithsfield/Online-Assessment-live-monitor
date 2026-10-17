import Session from '../models/Session.js';
import Exam from '../models/Exam.js';
import Settings from '../models/Settings.js';
import Invite from '../models/Invite.js';
import Telemetry from '../models/Telemetry.js';
import { calculateFraudScore } from '../services/fraudScore.js';
import { clearTelemetryBuffer } from '../services/telemetryBuffer.js';

export function registerRecruiterHandlers(io, socket, activeSockets) {
  const recruiterId = socket.user?.userId;

  // Recruiter joins their private monitoring room and gets their current sessions
  socket.on('join_recruiter', async () => {
    if (recruiterId) {
      socket.join(`recruiter_monitor_${recruiterId}`);
    }
    socket.join('recruiter_monitor');

    try {
      const filter = recruiterId ? { recruiterId } : {};
      const sessions = await Session.find(filter);
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
      const filter = recruiterId ? { recruiterId } : {};
      let exam = await Exam.findOne(filter);
      if (!exam && recruiterId) {
        exam = await Exam.create({ recruiterId, duration: 3600, status: 'draft', questions: [] });
      }
      callback(exam);
    }
  });

  socket.on('update_exam', async (newExam) => {
    try {
      if (newExam && newExam.questions) {
        const update = { questions: newExam.questions };
        if (newExam.duration !== undefined) update.duration = newExam.duration;
        const filter = recruiterId ? { recruiterId } : {};
        const exam = await Exam.findOneAndUpdate(
          filter,
          { $set: update },
          { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );
        if (exam) {
          if (recruiterId) {
            io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
            io.to(`recruiter_monitor_${recruiterId}`).emit('exam_updated', exam.toObject());
          } else {
            io.emit('exam_updated', exam.toObject());
          }
        }
      }
    } catch (err) {
      console.error('update_exam error:', err);
    }
  });

  socket.on('start_exam', async (callback) => {
    try {
      const filter = recruiterId ? { recruiterId } : {};
      const exam = await Exam.findOneAndUpdate(
        filter,
        { $set: { status: 'active' } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      if (recruiterId) {
        io.to(`exam_${recruiterId}`).emit('exam_started', exam.toObject());
        io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
        io.to(`recruiter_monitor_${recruiterId}`).emit('exam_started', exam.toObject());
        io.to(`recruiter_monitor_${recruiterId}`).emit('exam_updated', exam.toObject());
      } else {
        io.emit('exam_started', exam.toObject());
        io.emit('exam_updated', exam.toObject());
      }
      if (typeof callback === 'function') callback({ success: true, exam: exam.toObject() });
    } catch (err) {
      console.error('start_exam error:', err);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('end_exam', async (callback) => {
    try {
      const filter = recruiterId ? { recruiterId } : {};
      const exam = await Exam.findOneAndUpdate(
        filter,
        { $set: { status: 'finished' } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );

      // Automatically submit active candidate sessions for this recruiter
      const now = Date.now();
      const sessionFilter = recruiterId ? { recruiterId, status: 'active' } : { status: 'active' };
      await Session.updateMany(sessionFilter, { $set: { status: 'submitted', endTime: now } });

      if (recruiterId) {
        io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
        io.to(`exam_${recruiterId}`).emit('exam_ended', exam.toObject());
        io.to(`exam_${recruiterId}`).emit('test_submitted_auto');

        const sessions = await Session.find({ recruiterId });
        io.to(`recruiter_monitor_${recruiterId}`).emit('initial_state', sessions.map(s => s.toObject()));
      } else {
        io.emit('exam_updated', exam.toObject());
        io.emit('exam_ended', exam.toObject());
        io.emit('test_submitted_auto');
        const sessions = await Session.find();
        io.to('recruiter_monitor').emit('initial_state', sessions.map(s => s.toObject()));
      }

      if (typeof callback === 'function') callback({ success: true, status: 'finished' });
    } catch (err) {
      console.error('end_exam error:', err);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('reset_exam', async (callback) => {
    try {
      const filter = recruiterId ? { recruiterId } : {};
      const exam = await Exam.findOneAndUpdate(
        filter,
        { $set: { status: 'draft', questions: [] } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );

      // Clean this recruiter's sessions, telemetry, and invites
      const sessionFilter = recruiterId ? { recruiterId } : {};
      const sessions = await Session.find(sessionFilter);
      const sessionIds = sessions.map(s => s.id);

      await Session.deleteMany(sessionFilter);
      if (sessionIds.length > 0) {
        await Telemetry.deleteMany({ sessionId: { $in: sessionIds } });
        for (const sid of sessionIds) {
          activeSockets.delete(sid);
        }
      }
      await Invite.deleteMany(sessionFilter);
      clearTelemetryBuffer();

      if (recruiterId) {
        if (exam) io.to(`exam_${recruiterId}`).emit('exam_updated', exam.toObject());
        io.to(`recruiter_monitor_${recruiterId}`).emit('initial_state', []);
        io.to(`recruiter_monitor_${recruiterId}`).emit('invites_reset');
      } else {
        if (exam) io.emit('exam_updated', exam.toObject());
        io.to('recruiter_monitor').emit('initial_state', []);
        io.emit('invites_reset');
      }

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

        const activeSessions = await Session.find(recruiterId ? { recruiterId, status: 'active' } : { status: 'active' });
        const monitorRoom = recruiterId ? `recruiter_monitor_${recruiterId}` : 'recruiter_monitor';
        for (const session of activeSessions) {
          session.fraudScore = await calculateFraudScore(
            session.stats.blur,
            session.stats.paste,
            session.stats.macro,
            session.stats.copy || 0
          );
          await session.save();
          io.to(monitorRoom).emit('session_updated', session.toSafeJSON ? session.toSafeJSON() : session.toObject());
        }
        io.to(monitorRoom).emit('settings_updated', settings);
      }
    }
  });

  socket.on('force_lockout', async ({ sessionId }) => {
    const session = await Session.findOne({ id: sessionId });
    if (session) {
      session.status = 'disqualified';
      await session.save();
      const monitorRoom = session.recruiterId ? `recruiter_monitor_${session.recruiterId}` : 'recruiter_monitor';
      io.to(sessionId).emit('test_disqualified', { reason: 'Manual recruiter lockout' });
      io.to(monitorRoom).emit('session_updated', session.toSafeJSON ? session.toSafeJSON() : session.toObject());
    }
  });
}
