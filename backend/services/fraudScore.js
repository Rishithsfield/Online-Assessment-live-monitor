import Settings from '../models/Settings.js';

/**
 * Computes the weighted fraud score for a candidate session.
 *
 * @param {number} blur
 * @param {number} paste
 * @param {number} macro
 * @param {number} copy
 * @returns {Promise<number>} Anomaly score capped at 100
 */
export async function calculateFraudScore(blur, paste, macro, copy = 0) {
  const settings = await Settings.findOne();
  if (!settings) {
    return Math.min(100, blur * 15 + paste * 25 + macro * 40 + copy * 25);
  }
  const { weights } = settings;
  return Math.min(
    100,
    blur * weights.blur +
    paste * weights.paste +
    macro * weights.macro +
    copy * weights.paste
  );
}
