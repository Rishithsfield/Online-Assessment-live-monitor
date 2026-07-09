import mongoose from 'mongoose';

const RecruiterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'Recruiter Admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Recruiter', RecruiterSchema);
