/**
 * SignalProcessor - Core biometric signal processing engine
 *
 * Responsibilities:
 * 1. Update baseline using Welford online algorithm (dynamic, never static)
 * 2. Compute z-score with clamped std
 * 3. Validate individual BPM events
 * 4. Accumulate a signal window and validate multi-signal
 * 5. Compute confidence score
 *
 * NEVER stores raw BPM. Only processes in-memory and returns extracted features.
 */

const logger = require('../utils/logger');

// Config defaults (can be overridden per user)
const CONFIG = {
  Z_THRESHOLD: 1.5,         // minimum z-score to consider a reaction
  MIN_STD_CLAMP: 3,         // minimum std to avoid division instability
  MIN_DURATION_SEC: 2.5,    // minimum seconds of sustained signal
  MAX_BPM_ACTIVITY: 120,    // above this -> likely physical activity, discard
  MIN_SIGNAL_COUNT: 2,      // minimum valid events in window for multi-signal
  WINDOW_SIZE: 10,          // max events to keep in rolling window
  SIGNAL_VARIANCE_LIMIT: 4, // max variance within window for stability check
};

/**
 * Update baseline using Welford online algorithm
 * Modifies biometricProfile in place (caller must save)
 * Only call with resting BPM (bpm < MAX_BPM_ACTIVITY)
 */
function updateBaseline(profile, bpm) {
  if (bpm >= CONFIG.MAX_BPM_ACTIVITY) return profile; // skip non-resting

  profile.baseline_count += 1;
  const n = profile.baseline_count;
  const delta = bpm - profile.baseline_mean;
  profile.baseline_mean += delta / n;
  const delta2 = bpm - profile.baseline_mean;
  profile.baseline_m2 += delta * delta2;

  if (n >= 2) {
    const variance = profile.baseline_m2 / (n - 1);
    profile.baseline_std = Math.sqrt(variance);
  }

  profile.baseline_updated_at = new Date();
  profile.is_calibrated = n >= 10; // calibrated after 10 resting samples
  return profile;
}

/**
 * Compute z-score for a single BPM reading
 * z = (bpm - baseline_mean) / max(baseline_std, MIN_STD_CLAMP)
 */
function computeZScore(bpm, baseline_mean, baseline_std) {
  const clampedStd = Math.max(baseline_std, CONFIG.MIN_STD_CLAMP);
  return (bpm - baseline_mean) / clampedStd;
}

/**
 * Validate a single BPM event against the reaction criteria
 * Returns { valid: bool, z_score: number, reason: string }
 */
function validateEvent(bpm, profile, threshold) {
  const z_threshold = threshold || profile.z_threshold || CONFIG.Z_THRESHOLD;

  // Filter: physical activity
  if (bpm >= CONFIG.MAX_BPM_ACTIVITY) {
    return { valid: false, z_score: null, reason: 'ACTIVITY_FILTERED', bpm };
  }

  // Filter: baseline not calibrated enough
  if (!profile.is_calibrated && profile.baseline_count < 5) {
    return { valid: false, z_score: null, reason: 'BASELINE_NOT_READY', bpm };
  }

  const z = computeZScore(bpm, profile.baseline_mean, profile.baseline_std);

  if (z < z_threshold) {
    return { valid: false, z_score: z, reason: 'Z_BELOW_THRESHOLD', bpm };
  }

  return { valid: true, z_score: z, reason: 'VALID_EVENT', bpm };
}

/**
 * Process a window of BPM events and determine if a valid reaction exists
 *
 * events: Array of { bpm, timestamp_ms }
 * profile: BiometricProfile document
 *
 * Returns:
 * {
 *   decision: 'VALID_REACTION' | 'INVALID_REACTION' | 'INSUFFICIENT_SIGNAL' | 'NOISE' | ...
 *   z_score: number (avg of valid events)
 *   confidence: 0.0 - 1.0
 *   duration: number (seconds)
 *   signal_count: number
 *   avg_z: number
 *   bpm_max: number
 *   events_log: Array (for debug)
 * }
 */
function processWindow(events, profile) {
  if (!events || events.length === 0) {
    return { decision: 'NO_DATA', confidence: 0, z_score: 0, duration: 0, signal_count: 0, avg_z: 0, bpm_max: 0 };
  }

  const validEvents = [];
  const eventsLog = [];

  for (const event of events) {
    const result = validateEvent(event.bpm, profile);
    eventsLog.push({ ...result, timestamp_ms: event.timestamp_ms });
    logger.debug({ msg: 'BPM event', bpm: event.bpm, z_score: result.z_score, decision: result.reason });
    if (result.valid) validEvents.push(result);
  }

  // Multi-signal check
  if (validEvents.length < CONFIG.MIN_SIGNAL_COUNT) {
    return {
      decision: 'INSUFFICIENT_SIGNAL',
      confidence: 0,
      z_score: 0,
      duration: 0,
      signal_count: validEvents.length,
      avg_z: 0,
      bpm_max: Math.max(...events.map(e => e.bpm)),
      events_log: eventsLog
    };
  }

  // Duration: time from first to last valid event
  const timestamps = validEvents.map((_, i) => {
    const idx = eventsLog.findIndex(e => e.z_score === validEvents[i].z_score && e.valid !== false);
    return events[Math.max(idx, 0)]?.timestamp_ms || 0;
  });
  const sortedTs = [...events.map(e => e.timestamp_ms)].sort((a, b) => a - b);
  const durationMs = sortedTs[sortedTs.length - 1] - sortedTs[0];
  const durationSec = durationMs / 1000;

  // Stability: variance of z_scores in valid events
  const zScores = validEvents.map(e => e.z_score);
  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  const variance = zScores.reduce((s, z) => s + (z - avgZ) ** 2, 0) / zScores.length;
  const isStable = variance <= CONFIG.SIGNAL_VARIANCE_LIMIT;

  // Duration check
  if (durationSec < CONFIG.MIN_DURATION_SEC) {
    return {
      decision: 'DURATION_TOO_SHORT',
      confidence: 0,
      z_score: avgZ,
      duration: durationSec,
      signal_count: validEvents.length,
      avg_z: avgZ,
      bpm_max: Math.max(...events.map(e => e.bpm)),
      events_log: eventsLog
    };
  }

  if (!isStable) {
    return {
      decision: 'SIGNAL_UNSTABLE',
      confidence: 0.1,
      z_score: avgZ,
      duration: durationSec,
      signal_count: validEvents.length,
      avg_z: avgZ,
      bpm_max: Math.max(...events.map(e => e.bpm)),
      events_log: eventsLog
    };
  }

  // All checks passed - compute confidence
  const confidence = computeConfidence(durationSec, variance, validEvents.length);

  logger.info({
    msg: 'VALID_REACTION detected',
    avg_z: avgZ,
    confidence,
    duration: durationSec,
    signal_count: validEvents.length
  });

  return {
    decision: 'VALID_REACTION',
    confidence,
    z_score: avgZ,
    duration: durationSec,
    signal_count: validEvents.length,
    avg_z: avgZ,
    bpm_max: Math.max(...events.map(e => e.bpm)),
    events_log: eventsLog
  };
}

/**
 * Compute confidence score 0.0 - 1.0
 * Based on:
 * - duration (longer = more confident, capped at 10s)
 * - stability (lower variance = more confident)
 * - signal count (more signals = more confident)
 */
function computeConfidence(durationSec, variance, signalCount) {
  // Duration score: 0-1, saturates at 10s
  const durationScore = Math.min(durationSec / 10, 1);

  // Stability score: 0-1, variance 0 = perfect, variance >= LIMIT = 0
  const stabilityScore = Math.max(0, 1 - (variance / CONFIG.SIGNAL_VARIANCE_LIMIT));

  // Signal count score: 0-1, saturates at 5 signals
  const countScore = Math.min((signalCount - CONFIG.MIN_SIGNAL_COUNT + 1) / 4, 1);

  // Weighted average
  const confidence = (durationScore * 0.4) + (stabilityScore * 0.35) + (countScore * 0.25);
  return Math.round(confidence * 100) / 100; // 2 decimal places
}

module.exports = { updateBaseline, computeZScore, validateEvent, processWindow, computeConfidence, CONFIG };
