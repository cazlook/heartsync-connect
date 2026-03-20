const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, BiometricProfile } = require('./User.model');
const { Reaction } = require('../biometrics/Reaction.model');
const { Match } = require('../matching/Match.model');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (payload.type !== 'access') return res.status(401).json({ error: 'Invalid token' });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/discovery
// Returns other users for the discovery feed (passive, no swipe)
router.get('/discovery', requireAuth, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.userId }, biometricConsentGiven: true },
      { displayName: 1, bio: 1, age: 1 } // only public fields
    ).limit(20);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/me
 * GDPR right to erasure - deletes ALL user data
 * Profile, biometric profile, reactions, matches
 */
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Delete all biometric data first (high priority)
    await BiometricProfile.deleteOne({ userId });
    await Reaction.deleteMany({ $or: [{ viewer_id: userId }, { target_id: userId }] });
    await Match.deleteMany({ $or: [{ user1_id: userId }, { user2_id: userId }] });

    // Delete user profile last
    await User.findByIdAndDelete(userId);

    logger.info({ msg: 'Account deleted - all data wiped', userId });
    res.json({ deleted: true, message: 'All data permanently deleted' });
  } catch (err) {
    logger.error({ msg: 'Delete account error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
