import Session from '../models/Session.js';
import { checkAllSessionsPlagiarism } from '../services/plagiarism.js';

export async function getPlagiarismReport(req, res) {
  try {
    const sessions = await Session.find();
    const report = checkAllSessionsPlagiarism(sessions.map(s => s.toObject()));
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate plagiarism report: ' + err.message });
  }
}
