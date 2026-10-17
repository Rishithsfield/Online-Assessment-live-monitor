import Session from '../models/Session.js';

export async function getSessions(req, res) {
  try {
    const filter = req.user?.userId ? { recruiterId: req.user.userId } : {};
    const sessions = await Session.find(filter);
    res.json(sessions.map(s => s.toObject()));
  } catch (err) {
    console.error('Sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions: ' + err.message });
  }
}
