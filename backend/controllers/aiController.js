import { generateQuestionWithGemini } from '../services/geminiService.js';

export async function generateQuestion(req, res) {
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
