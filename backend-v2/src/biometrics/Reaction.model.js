const mongoose = require('mongoose');

// Reaction: a validated physiological response from viewer to target
// TTL: auto-deleted after 24h - privacy by design
const reactionSchema = new mongoose.Schema({
  viewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Signal data - only extracted features, NEVER raw BPM stream
  z_score: { type: Number, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  duration: { type: Number, required: true }, // seconds above threshold
  signal_count: { type: Number, required: true }, // how many events validated
  avg_z: { type: Number, required: true },
  // Context
  bpm_max: { type: Number }, // max BPM during reaction (no stream, just max)
  created_at: { type: Date, default: Date.now, expires: 86400 } // TTL 24h
});

// Compound index: one reaction per pair per window
reactionSchema.index({ viewer_id: 1, target_id: 1, created_at: -1 });

const Reaction = mongoose.model('Reaction', reactionSchema);
module.exports = { Reaction };
