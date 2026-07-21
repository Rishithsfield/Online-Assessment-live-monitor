import mongoose from 'mongoose';

const templateTestCaseSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true }
}, { _id: false });

const questionTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  functionName: { type: String, default: 'solution' },
  text: { type: String, required: true },
  constraints: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  tags: { type: [String], default: [] },
  boilerplate: {
    javascript: { type: String, default: '' },
    python: { type: String, default: '' }
  },
  testcases: [templateTestCaseSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('QuestionTemplate', questionTemplateSchema);
