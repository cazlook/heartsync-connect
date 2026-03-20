const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { BiometricProfile } = require('../users/User.model');
const { Reaction } = require('./Reaction.model');
const { processWindow, updateBaseline } = require('./SignalProcessor');
const { checkAndCreateMatch } = require('../matching/MatchingEngine');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

// Auth middleware
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

/**
 * POST /api/biometrics/consent
 * User must explicitly consent before any BPM is processed
 */
router.post('/consent', requireAuth, async (req, res) => {
  try {
    const { User } = require('../users/User.model');
    await User.findByIdAndUpdate(req.userId, {
      biometricConsentGiven: true,
      biometricConsentAt: new Date()
    });
    logger.info({ msg: 'Biometric consent given', userId: req.userId });
    res.json({ consented: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/biometrics/baseline
 * Submit resting BPM samples to update baseline (Welford)
 * Body: { bpm_samples: [72, 71, 73, ...] }
 */
router.post('/baseline', requireAuth, [
  body('bpm_samples').isArray({ min: 1, max: 50 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { User } = require('../users/User.model');
    const user = await User.findById(req.userId);
    if (!user || !user.biometricConsentGiven) {
      return res.status(403).json({ error: 'Biometric consent required' });
    }

    let profile = await BiometricProfile.findOne({ userId: req.userId });
    if (!profile) profile = await BiometricProfile.create({ userId: req.userId });

    for (const bpm of req.body.bpm_samples) {
      if (typeof bpm === 'number' && bpm > 30 && bpm < 200) {
        updateBaseline(profile, bpm);
      }
    }

    await profile.save();
    logger.info({ msg: 'Baseline updated', userId: req.userId, count: profile.baseline_count });

    // Return only summary - never raw data
    res.json({
      baseline_mean: Math.round(profile.baseline_mean * 10) / 10,
      baseline_std: Math.round(profile.baseline_std * 10) / 10,
      sample_count: profile.baseline_count,
      is_calibrated: profile.is_calibrated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/biometrics/ingest
 * Submit BPM window while viewing a target user
 * Body: { target_user_id, events: [{ bpm, timestamp_ms }, ...] }
 *
 * This is the main real-time endpoint.
 * The mobile app sends BPM events -> server processes -> may create reaction -> may create match
 */
router.post('/ingest', requireAuth, [
  body('target_user_id').notEmpty(),
  body('events').isArray({ min: 1, max: 20 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { User } = require('../users/User.model');
    const user = await User.findById(req.userId);
    if (!user || !user.biometricConsentGiven) {
      return res.status(403).json({ error: 'Biometric consent required' });
    }

    const profile = await BiometricProfile.findOne({ userId: req.userId });
    if (!profile) return res.status(400).json({ error: 'Baseline not set' });

    const { target_user_id, events } = req.body;

    // Process window - all in memory, no raw BPM stored
    const result = processWindow(events, profile);

    logger.info({
      msg: 'BPM ingest',
      userId: req.userId,
      target: target_user_id,
      decision: result.decision,
      confidence: result.confidence
    });

    let reactionSaved = null;
    let matchResult = null;

    if (result.decision === 'VALID_REACTION') {
      reactionSaved = await Reaction.create({
        viewer_id: req.userId,
        target_id: target_user_id,
        z_score: result.z_score,
        confidence: result.confidence,
        duration: result.duration,
        signal_count: result.signal_count,
        avg_z: result.avg_z,
        bpm_max: result.bpm_max
      });

      matchResult = await checkAndCreateMatch(req.userId, target_user_id);
    }

    // Return only what client needs - no raw biometric data
    res.json({
      decision: result.decision,
      confidence: result.confidence,
      reaction_saved: !!reactionSaved,
      match: matchResult?.matched ? { cardiac_score: matchResult.match.cardiac_score } : null
    });
  } catch (err) {
    logger.error({ msg: 'Ingest error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
