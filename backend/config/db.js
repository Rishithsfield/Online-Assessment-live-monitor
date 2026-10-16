import mongoose from 'mongoose';
import Settings from '../models/Settings.js';
import Exam from '../models/Exam.js';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ MongoDB connected');

    // Seed default settings if not present
    let settings = await Settings.findOne();
    if (!settings) {
      await Settings.create({
        weights: { blur: 15, paste: 25, macro: 40 },
        thresholds: { suspicious: 40, danger: 75 }
      });
      console.log('  → Default settings seeded');
    }

    // Seed default exam if not present
    let exam = await Exam.findOne();
    if (!exam) {
      await Exam.create({
        duration: 3600,
        status: 'draft',
        questions: []
      });
      console.log('  → Default exam seeded');
    }
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
}
