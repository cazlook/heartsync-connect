/**
 * debug.routes.js - FASE 2: Debug & Simulation endpoints
 *
 * ONLY active in non-production environments
 * Allows testing the biometric pipeline without real sensors
 *
 * Endpoints:
 *   POST /api/debug/simulate-bpm      - simulate a BPM window for a user
 *   POST /api/debug/simulate-reaction - force-inject a reaction for testing
 *   GET  /api/debug/scenarios         - list available test scenarios
 */

const express = require('express');
const router = express.Router();
const { processWindow, updateBaseline, CONFIG } = require('../biometrics/SignalProcessor');
const { checkAndCreateMatch } = require('../matching/MatchingEngine');
const { Reaction } = require('../biometrics/Reaction.model');
const logger = require('../utils/logger');

// Guard: only available in non-production
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Debug endpoints disabled in production' });
  }
  next();
});

// --- BPM SCENARIO GENERATORS ---
const SCENARIOS = {
  // No reaction: BPM stays near baseline
  no_reaction: (baseline = 70) => {
    const ts = Date.now();
    return Array.from({ length: 6 }, (_, i) => ({
      bpm: baseline + Math.round((Math.random() - 0.5) * 4), // +-2 BPM noise
      timestamp_ms: ts + i * 1000
    }));
  },

  // Medium reaction: moderate sustained increase
  medium: (baseline = 70) => {
    const ts = Date.now();
    return Array.from({ length: 6 }, (_, i) => ({
      bpm: baseline + 10 + Math.round((Math.random() - 0.5) * 2), // ~+10 BPM sustained
      timestamp_ms: ts + i * 1000
    }));
  },

  // High reaction: strong sustained increase
  high: (baseline = 70) => {
    const ts = Date.now();
    return Array.from({ length: 8 }, (_, i) => ({
      bpm: baseline + 20 + Math.round((Math.random() - 0.5) * 2), // ~+20 BPM sustained
      timestamp_ms: ts + i * 1000
    }));
  },

  // Noise: random BPM with no pattern
  noise: (baseline = 70) => {
    const ts = Date.now();
    return Array.from({ length: 6 }, (_, i) => ({
      bpm: 55 + Math.round(Math.random() * 30), // completely random
      timestamp_ms: ts + i * 1000
    }));
  },

  // Spike: single brief spike then returns to baseline (should be rejected)
  spike: (baseline = 70) => {
    const ts = Date.now();
    return [
      { bpm: baseline + 1, timestamp_ms: ts },
      { bpm: baseline + 25, timestamp_ms: ts + 500 }, // spike - too brief
      { bpm: baseline + 2, timestamp_ms: ts + 1000 },
      { bpm: baseline + 1, timestamp_ms: ts + 1500 },
      { bpm: baseline + 2, timestamp_ms: ts + 2000 },
      { bpm: baseline + 1, timestamp_ms: ts + 2500 }
    ];
  }
};

/**
 * POST /api/debug/simulate-bpm
 * Body: { scenario: string, baseline_mean: number, baseline_std: number, events: [...] }
 *
 * Runs BPM events through SignalProcessor and returns the result
 * Does NOT save to DB - pure simulation
 */
router.post('/simulate-bpm', (req, res) => {
  const { scenario, baseline_mean = 70, baseline_std = 5, events } = req.body;

  // Build a fake profile for simulation
  const fakeProfile = {
    baseline_mean,
    baseline_std,
    baseline_m2: 0,
    baseline_count: 20, // pretend calibrated
    is_calibrated: true,
    z_threshold: CONFIG.Z_THRESHOLD
  };

  // Use provided events or generate from scenario
  let inputEvents = events;
  if (!inputEvents) {
    if (!SCENARIOS[scenario]) {
      return res.status(400).json({
        error: `Unknown scenario. Available: ${Object.keys(SCENARIOS).join(', ')}`
      });
    }
    inputEvents = SCENARIOS[scenario](baseline_mean);
  }

  const result = processWindow(inputEvents, fakeProfile);

  // Log every event for debug
  logger.info({
    msg: 'DEBUG simulate-bpm',
    scenario: scenario || 'custom',
    baseline_mean,
    baseline_std,
    event_count: inputEvents.length,
    decision: result.decision,
    confidence: result.confidence,
    avg_z: result.avg_z,
    duration: result.duration
  });

  res.json({
    scenario: scenario || 'custom',
    input: { baseline_mean, baseline_std, events: inputEvents },
    output: result
  });
});

/**
 * POST /api/debug/simulate-reaction
 * Body: { viewer_id, target_id, scenario?, force_match? }
 *
 * Simulates a validated reaction being saved for viewer->target
 * Then checks if a match should be created
 * Optionally force_match: also creates reverse reaction
 */
router.post('/simulate-reaction', async (req, res) => {
  try {
    const { viewer_id, target_id, scenario = 'high', force_match = false, baseline_mean = 70, baseline_std = 5 } = req.body;

    if (!viewer_id || !target_id) {
      return res.status(400).json({ error: 'viewer_id and target_id required' });
    }

    const fakeProfile = {
      baseline_mean,
      baseline_std,
      baseline_m2: 0,
      baseline_count: 20,
      is_calibrated: true,
      z_threshold: CONFIG.Z_THRESHOLD
    };

    const events = SCENARIOS[scenario] ? SCENARIOS[scenario](baseline_mean) : SCENARIOS.high(baseline_mean);
    const result = processWindow(events, fakeProfile);

    if (result.decision !== 'VALID_REACTION') {
      return res.json({
        saved: false,
        reason: result.decision,
        result
      });
    }

    // Save reaction A->B
    const reactionAtoB = await Reaction.create({
      viewer_id,
      target_id,
      z_score: result.z_score,
      confidence: result.confidence,
      duration: result.duration,
      signal_count: result.signal_count,
      avg_z: result.avg_z,
      bpm_max: result.bpm_max
    });

    logger.info({ msg: 'DEBUG reaction saved', viewer_id, target_id, confidence: result.confidence });

    let reverseReaction = null;
    if (force_match) {
      // Also create B->A reaction to force a match
      reverseReaction = await Reaction.create({
        viewer_id: target_id,
        target_id: viewer_id,
        z_score: result.z_score,
        confidence: result.confidence,
        duration: result.duration,
        signal_count: result.signal_count,
        avg_z: result.avg_z,
        bpm_max: result.bpm_max
      });
      logger.info({ msg: 'DEBUG reverse reaction saved (force_match)', viewer_id: target_id, target_id: viewer_id });
    }

    // Check match
    const matchResult = await checkAndCreateMatch(viewer_id, target_id);

    res.json({
      saved: true,
      reaction: reactionAtoB,
      reverse_reaction: reverseReaction,
      match_check: matchResult
    });
  } catch (err) {
    logger.error({ msg: 'Debug simulate-reaction error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/debug/scenarios
 * Returns available scenarios and their descriptions
 */
router.get('/scenarios', (req, res) => {
  res.json({
    scenarios: {
      no_reaction: 'BPM near baseline - expected: INSUFFICIENT_SIGNAL or Z_BELOW_THRESHOLD',
      medium: 'Moderate sustained increase ~+10 BPM - expected: VALID_REACTION with medium confidence',
      high: 'Strong sustained increase ~+20 BPM - expected: VALID_REACTION with high confidence',
      noise: 'Random BPM values - expected: INSUFFICIENT_SIGNAL or SIGNAL_UNSTABLE',
      spike: 'Single brief spike then baseline - expected: DURATION_TOO_SHORT'
    },
    config: CONFIG
  });
});

module.exports = router;
