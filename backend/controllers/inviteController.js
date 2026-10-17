import Invite from '../models/Invite.js';

export async function createInvite(req, res) {
  try {
    const code = `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const recruiterId = req.user?.userId;
    const invite = await Invite.create({ code, recruiterId });
    res.status(201).json(invite.toObject());
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invite: ' + err.message });
  }
}

export async function getInvites(req, res) {
  try {
    const filter = req.user?.userId ? { recruiterId: req.user.userId } : {};
    const invites = await Invite.find(filter).sort({ createdAt: -1 });
    res.json(invites.map(i => i.toObject()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invites: ' + err.message });
  }
}
