import mongoose from 'mongoose';

const telemetrySchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  eventType: { type: String, required: true },
  timestamp: { type: Number, required: true }
});

export default mongoose.model('Telemetry', telemetrySchema);
