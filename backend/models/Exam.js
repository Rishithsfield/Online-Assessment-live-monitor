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
  testcases: [testCaseSchema]
}, { _id: false });

const examSchema = new mongoose.Schema({
  duration: { type: Number, default: 3600 },
  status: { type: String, enum: ['draft', 'active', 'finished'], default: 'draft' },
  questions: [questionSchema]
});

export default mongoose.model('Exam', examSchema);
