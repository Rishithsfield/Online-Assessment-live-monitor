import mongoose from 'mongoose';

const InviteSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['unused', 'used'],
    default: 'unused'
  },
  usedBy: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Invite', InviteSchema);
