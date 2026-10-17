import Session from '../models/Session.js';
import Exam from '../models/Exam.js';
import { calculateFraudScore } from '../services/fraudScore.js';
import { buildRecruiterFilter } from '../utils/recruiterQuery.js';

export function registerCandidateHandlers(io, socket, activeSockets) {
  // Candidate joins their personal room
  socket.on('join_candidate', async ({ sessionId }) => {
    socket.join(sessionId);

    const session = await Session.findOne({ id: sessionId });
    const rawRecruiterId = session?.recruiterId || socket.user?.recruiterId;
    const rId = rawRecruiterId ? String(rawRecruiterId) : null;

    if (rId) {
      socket.join(`exam_${rId}`);
      socket.recruiterId = rId;
    }

    const recruiterRoom = rId ? `recruiter_monitor_${rId}` : 'recruiter_monitor';

    // Multi-device prevention check
    const existingSocket = activeSockets.get(sessionId);
    if (existingSocket && existingSocket.id !== socket.id) {
      existingSocket.emit('force_logout', { reason: 'Duplicate session detected. Logged in from another device/tab.' });
      setTimeout(() => {
        existingSocket.disconnect(true);
      }, 500);

      if (session) {
        session.stats.macro += 1;
        session.fraudScore = await calculateFraudScore(
          session.stats.blur,
          session.stats.paste,
          session.stats.macro,
          session.stats.copy || 0
        );
        await session.save();

        const sObj = session.toSafeJSON ? session.toSafeJSON() : session.toObject();
        io.to(recruiterRoom).emit('session_updated', sObj);

        const alertMsg = 'Multi-device login warning. Previous device disconnected.';
        io.to(recruiterRoom).emit('fraud_alert_triggered', {
          id: `alert_${Date.now()}`,
          sessionId,
          candidateName: session.name,
          eventType: 'macro',
          fraudScore: session.fraudScore,
          timestamp: Date.now(),
          message: alertMsg
        });

        io.to(recruiterRoom).emit('candidate_activity', {
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

    // Immediately notify recruiter monitoring room that candidate joined/connected
    if (session) {
      const sObj = session.toSafeJSON ? session.toSafeJSON() : session.toObject();
      io.to(recruiterRoom).emit('session_updated', sObj);
      io.to(recruiterRoom).emit('candidate_activity', {
        sessionId,
        candidateName: session.name,
        type: 'join',
        message: 'Candidate entered the assessment workspace',
        timestamp: Date.now()
      });
    }

    // Send server-authoritative session synchronization (accurate remaining timer and scores)
    try {
      const exam = rId
        ? (await Exam.findOne(buildRecruiterFilter(rId)) || await Exam.findOne({ status: 'active' }) || await Exam.findOne())
        : await Exam.findOne();
      const duration = exam?.duration || 3600;
      let remainingSeconds = duration;
      if (session && session.startTime) {
        const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        remainingSeconds = Math.max(0, duration - elapsed);
      }

      let scoresObj = {};
      if (session?.scores) {
        scoresObj = session.scores instanceof Map ? Object.fromEntries(session.scores) : session.scores;
      }

      socket.emit('session_sync', {
        startTime: session?.startTime,
        duration,
        remainingSeconds,
        scores: scoresObj,
        status: session?.status,
        code: session?.code,
        language: session?.language,
        codeHistory: session?.codeHistory || []
      });

      // Also ensure candidate receives current questions for this recruiter's exam
      if (exam) {
        socket.emit('exam_updated', exam.toObject());
      }
    } catch (err) {
      console.error('session_sync error:', err);
    }
  });

  socket.on('language_update', async ({ sessionId, language }) => {
    try {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        session.language = language;
        await session.save();
        const sObj = session.toSafeJSON ? session.toSafeJSON() : session.toObject();
        const rId = session.recruiterId ? String(session.recruiterId) : null;
        const recruiterRoom = rId ? `recruiter_monitor_${rId}` : 'recruiter_monitor';
        io.to(recruiterRoom).emit('session_updated', sObj);
      }
    } catch (err) {
      console.error('language_update error:', err.message);
    }
  });

  socket.on('code_update', async ({ sessionId, code }) => {
    try {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        session.code = code;
        await session.save();
        const sObj = session.toSafeJSON ? session.toSafeJSON() : session.toObject();
        const rId = session.recruiterId ? String(session.recruiterId) : null;
        const recruiterRoom = rId ? `recruiter_monitor_${rId}` : 'recruiter_monitor';
        io.to(recruiterRoom).emit('session_updated', sObj);
      }
    } catch (err) {
      console.error('code_update error:', err.message);
    }
  });

  socket.on('candidate_run', async ({ sessionId }) => {
    try {
      const session = await Session.findOne({ id: sessionId });
      if (session) {
        const rId = session.recruiterId ? String(session.recruiterId) : null;
        const recruiterRoom = rId ? `recruiter_monitor_${rId}` : 'recruiter_monitor';
        io.to(recruiterRoom).emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'run',
          message: 'Ran code against sample testcases',
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('candidate_run error:', err.message);
    }
  });

  socket.on('submit_code', async ({ sessionId, questionId, code, score }) => {
    try {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        const currentScores = session.scores
          ? (session.scores instanceof Map ? Object.fromEntries(session.scores) : { ...session.scores })
          : {};
        delete currentScores['final'];
        currentScores[String(questionId)] = {
          passed: Number(score?.passed) || 0,
          total: Number(score?.total) || 0
        };
        session.scores = currentScores;
        session.markModified('scores');

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

        const sessionObj = session.toSafeJSON ? session.toSafeJSON() : session.toObject();
        const rId = session.recruiterId ? String(session.recruiterId) : null;
        const recruiterRoom = rId ? `recruiter_monitor_${rId}` : 'recruiter_monitor';

        io.to(recruiterRoom).emit('session_updated', sessionObj);
        io.to(recruiterRoom).emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'submit',
          message: `Submitted answer for Q${Number(questionId) + 1}. Passed ${score?.passed || 0}/${score?.total || 0} testcases.`,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('submit_code error:', err.message);
    }
  });

  socket.on('submit_test', async ({ sessionId, score }) => {
    try {
      const session = await Session.findOne({ id: sessionId });
      if (session && session.status === 'active') {
        session.status = 'submitted';
        session.endTime = Date.now();
        const currentScores = session.scores
          ? (session.scores instanceof Map ? Object.fromEntries(session.scores) : { ...session.scores })
          : {};
        delete currentScores['final'];
        session.scores = currentScores;
        session.markModified('scores');
        await session.save();

        const sessionObj = session.toSafeJSON ? session.toSafeJSON() : session.toObject();
        const rId = session.recruiterId ? String(session.recruiterId) : null;
        const recruiterRoom = rId ? `recruiter_monitor_${rId}` : 'recruiter_monitor';

        io.to(recruiterRoom).emit('session_updated', sessionObj);
        io.to(recruiterRoom).emit('candidate_activity', {
          sessionId,
          candidateName: session.name,
          type: 'submit',
          message: score
            ? `Submitted the test. Final score: ${score.passed}/${score.total} testcases.`
            : 'Submitted the test.',
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('submit_test error:', err.message);
    }
  });
}
