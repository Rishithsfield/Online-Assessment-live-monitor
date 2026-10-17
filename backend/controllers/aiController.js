import { generateQuestionWithGemini } from '../services/geminiService.js';

// In-memory rate limiter: max 5 AI generation requests per 60 seconds per user/IP
const aiRequestTimestamps = new Map();

function isAiRateLimited(key, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();
  const history = (aiRequestTimestamps.get(key) || []).filter(ts => now - ts < windowMs);
  if (history.length >= maxRequests) {
    return true;
  }
  history.push(now);
  aiRequestTimestamps.set(key, history);
  return false;
}

export async function generateQuestion(req, res) {
  const recruiterId = req.user?.userId || req.ip || 'anonymous';
  if (isAiRateLimited(recruiterId)) {
    return res.status(429).json({
      error: 'Rate limit reached: Gemini API free tier allows up to 5 generations per minute. Please wait a moment and try again.'
    });
  }

  const { topic, difficulty, testCaseCount } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    const question = await generateQuestionWithGemini({ topic, difficulty, testCaseCount });
    res.json(question);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to generate question' });
  }
}
