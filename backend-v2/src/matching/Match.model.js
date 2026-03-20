const mongoose = require('mongoose');

// Match: created ONLY by the engine when A->B AND B->A reactions are valid
// No manual input ever creates a match
const matchSchema = new mongoose.Schema({
  user1_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // cardiac_score: 0-100, derived from z_scores average
  cardiac_score: { type: Number, required: true, min: 0, max: 100 },
  // Breakdown for auditability (why was this match created)
  a_to_b_z: { type: Number, required: true },
  b_to_a_z: { type: Number, required: true },
  a_to_b_confidence: { type: Number, required: true },
  b_to_a_confidence: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
  // Status
  notified: { type: Boolean, default: false }
});

// Prevent duplicate matches for same pair regardless of order
matchSchema.index(
  { user1_id: 1, user2_id: 1 },
  { unique: true }
);

// Helper: normalize pair order so (A,B) == (B,A)
matchSchema.statics.findOrCreateMatch = async function(data) {
  const [u1, u2] = [data.user1_id, data.user2_id].sort();
  return this.findOneAndUpdate(
    { user1_id: u1, user2_id: u2 },
    { ...data, user1_id: u1, user2_id: u2 },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const Match = mongoose.model('Match', matchSchema);
module.exports = { Match };
