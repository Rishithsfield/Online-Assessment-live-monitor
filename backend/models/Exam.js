import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  functionName: { type: String },
  text: { type: String, required: true },
  constraints: { type: String },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  tags: { type: [String], default: [] },
  boilerplate: {
    javascript: { type: String, default: '' },
    python: { type: String, default: '' },
    cpp: { type: String, default: '' },
    java: { type: String, default: '' }
  },
  testcases: [testCaseSchema]
}, { _id: false });

const examSchema = new mongoose.Schema({
  recruiterId: { type: mongoose.Schema.Types.Mixed, ref: 'Recruiter', index: true },
  duration: { type: Number, default: 3600 },
  status: { type: String, enum: ['draft', 'active', 'finished'], default: 'draft' },
  questions: [questionSchema]
});

export default mongoose.model('Exam', examSchema);
