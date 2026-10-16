import Telemetry from '../models/Telemetry.js';

let telemetryQueue = [];
const telemetryCounts = new Map(); // sessionId -> count
let flushInterval = null;

export const MAX_TELEMETRY_PER_SESSION = 150;

/**
 * Initializes the background 4-second batch flush to MongoDB.
 */
export function startTelemetryBuffer() {
  if (flushInterval) return;

  flushInterval = setInterval(async () => {
    if (telemetryQueue.length === 0) return;
    const currentBatch = [...telemetryQueue];
    telemetryQueue = [];

    try {
      await Telemetry.insertMany(currentBatch);
    } catch (err) {
      console.error('Failed to flush telemetry batch:', err.message);
    }
  }, 4000);
}

/**
 * Checks if the candidate session has exceeded the 150 telemetry event cap.
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export async function canRecordTelemetry(sessionId) {
  let currentCount = telemetryCounts.get(sessionId);
  if (currentCount === undefined) {
    currentCount = await Telemetry.countDocuments({ sessionId });
    telemetryCounts.set(sessionId, currentCount);
  }
  return currentCount < MAX_TELEMETRY_PER_SESSION;
}

/**
 * Queues a telemetry event to be flushed to MongoDB.
 *
 * @param {Object} event
 */
export function pushTelemetry({ sessionId, eventType, timestamp }) {
  telemetryQueue.push({
    sessionId,
    eventType,
    timestamp: timestamp || Date.now()
  });

  const count = (telemetryCounts.get(sessionId) || 0) + 1;
  telemetryCounts.set(sessionId, count);
}

/**
 * Clears in-memory buffer and counts (used during exam reset).
 */
export function clearTelemetryBuffer() {
  telemetryQueue = [];
  telemetryCounts.clear();
}
