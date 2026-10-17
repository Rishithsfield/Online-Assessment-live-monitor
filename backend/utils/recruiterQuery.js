import mongoose from 'mongoose';

/**
 * Builds a query filter for recruiterId that matches both BSON ObjectId and String representations,
 * preventing type mismatch issues when schemas use Mixed type.
 * 
 * @param {string|mongoose.Types.ObjectId} recruiterId
 * @returns {object} MongoDB query filter object
 */
export function buildRecruiterFilter(recruiterId) {
  if (!recruiterId) return {};
  const str = String(recruiterId);
  if (mongoose.Types.ObjectId.isValid(str)) {
    return {
      $or: [
        { recruiterId: new mongoose.Types.ObjectId(str) },
        { recruiterId: str }
      ]
    };
  }
  return { recruiterId: str };
}
