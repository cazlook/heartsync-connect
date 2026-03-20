const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Profile data - public info
const userProfileSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, required: true },
  age: { type: Number, min: 18, max: 99 },
  bio: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Consent - required before any biometric access
  biometricConsentGiven: { type: Boolean, default: false },
  biometricConsentAt: { type: Date }
});

// Biometric data - SEPARATE from profile, HIGH RISK
// Only baseline stats stored - never raw BPM stream
const biometricProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Welford online algorithm state
  baseline_mean: { type: Number, default: 70 },
  baseline_std: { type: Number, default: 5 },
  baseline_m2: { type: Number, default: 0 }, // sum of squared deviations
  baseline_count: { type: Number, default: 0 },
  baseline_updated_at: { type: Date, default: Date.now },
  // Config
  z_threshold: { type: Number, default: 1.5 }, // adaptive
  is_calibrated: { type: Boolean, default: false }
});

userProfileSchema.pre('save', async function(next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  this.updatedAt = new Date();
  next();
});

userProfileSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model('User', userProfileSchema);
const BiometricProfile = mongoose.model('BiometricProfile', biometricProfileSchema);

module.exports = { User, BiometricProfile };
