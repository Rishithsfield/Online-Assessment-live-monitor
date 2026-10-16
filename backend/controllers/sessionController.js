import Session from '../models/Session.js';

export async function getSessions(req, res) {
  try {
    const sessions = await Session.find();
    res.json(sessions.map(s => s.toObject()));
  } catch (err) {
    console.error('Sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions: ' + err.message });
  }
}
