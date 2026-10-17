import Session from '../models/Session.js';
import Exam from '../models/Exam.js';
import Settings from '../models/Settings.js';
import { calculateFraudScore } from '../services/fraudScore.js';
import { canRecordTelemetry, pushTelemetry } from '../services/telemetryBuffer.js';

export function registerTelemetryHandlers(io, socket) {
  socket.on('telemetry_event', async (data) => {
    try {
      const { sessionId, eventType, timestamp } = data;
      const session = await Session.findOne({ id: sessionId });
      const exam = session?.recruiterId ? await Exam.findOne({ recruiterId: session.recruiterId }) : await Exam.findOne();

      // Record telemetry violations whenever the candidate session is active
      if (session && session.status === 'active' && (!exam || exam.status !== 'finished')) {
        const allowed = await canRecordTelemetry(sessionId);
        if (allowed) {
          pushTelemetry({ sessionId, eventType, timestamp: timestamp || Date.now() });
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

        const recruiterRoom = session.recruiterId ? `recruiter_monitor_${session.recruiterId}` : 'recruiter_monitor';

        io.to(recruiterRoom).emit('session_updated', session.toSafeJSON ? session.toSafeJSON() : session.toObject());
        io.to(recruiterRoom).emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'violation',
          message: `Violation detected: ${eventType}`,
          timestamp: Date.now()
        });

        if (session.fraudScore > oldScore) {
          io.to(recruiterRoom).emit('fraud_alert_triggered', {
            sessionId,
            candidateName: session.name,
            eventType,
            fraudScore: session.fraudScore,
            timestamp
          });
        }

        const settings = await Settings.findOne();
        if (settings && session.fraudScore >= settings.thresholds.danger) {
          io.to(sessionId).emit('warning_prompt', {
            message: 'High risk anomaly detected. Please remain on this page.'
          });
        }
      }
    } catch (err) {
      console.error('telemetry_event error:', err.message);
    }
  });
}
