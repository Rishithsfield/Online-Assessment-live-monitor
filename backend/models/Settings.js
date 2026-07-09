import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  weights: {
    blur: { type: Number, default: 15 },
    paste: { type: Number, default: 25 },
    macro: { type: Number, default: 40 }
  },
  thresholds: {
    suspicious: { type: Number, default: 40 },
    danger: { type: Number, default: 75 }
  }
});

export default mongoose.model('Settings', settingsSchema);
