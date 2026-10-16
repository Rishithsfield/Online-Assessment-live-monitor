import mongoose from 'mongoose';

const codeHistorySchema = new mongoose.Schema({
  questionId: { type: Number, required: true },
  code: { type: String, required: true },
  score: {
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  timestamp: { type: Number, required: true },
  id: { type: String, required: true }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  candidateId: { type: String, required: true },
  name: { type: String, default: 'Anonymous Candidate' },
  code: { type: String, default: '// Write your code here' },
  language: { type: String, default: 'javascript' },
  status: { type: String, enum: ['active', 'submitted', 'disqualified', 'left'], default: 'active' },
  fraudScore: { type: Number, default: 0 },
  stats: {
    blur: { type: Number, default: 0 },
    paste: { type: Number, default: 0 },
    macro: { type: Number, default: 0 },
    copy: { type: Number, default: 0 }
  },
  scores: { type: mongoose.Schema.Types.Mixed, default: {} },
  codeHistory: [codeHistorySchema],
  startTime: { type: Number, required: true },
  endTime: { type: Number }
});

sessionSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  let sc = obj.scores;
  if (sc instanceof Map) {
    sc = Object.fromEntries(sc);
  }
  if (sc && typeof sc === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(sc)) {
      if (k !== 'final') clean[k] = v;
    }
    obj.scores = clean;
  } else {
    obj.scores = {};
  }
  return obj;
};

export default mongoose.model('Session', sessionSchema);
