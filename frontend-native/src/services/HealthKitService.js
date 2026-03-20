/**
 * HealthKitService.js
 * iOS HealthKit heart rate integration
 * Abstracts native HealthKit behind a unified BiometricService interface
 */
import { Platform } from 'react-native';

// Constants
const MIN_BPM = 30;
const MAX_BPM = 220;

let AppleHealthKit = null;
if (Platform.OS === 'ios') {
  try {
    AppleHealthKit = require('react-native-health').default;
  } catch (e) {
    console.warn('react-native-health not available, HealthKit disabled');
  }
}

const HK_PERMISSIONS = AppleHealthKit ? {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.HeartRate],
    write: [],
  },
} : null;

let _subscriptionActive = false;
let _lastBpm = null;
let _bpmCallback = null;

/**
 * Request HealthKit authorization.
 * Resolves true if granted, false otherwise.
 */
export async function requestAuthorization() {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(HK_PERMISSIONS, (err) => {
      if (err) {
        console.error('HealthKit auth error:', err);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Validate a BPM reading.
 * Rejects out-of-range values per spec (< 30 or > 220).
 */
export function validateBpm(bpm) {
  if (typeof bpm !== 'number' || isNaN(bpm)) return null;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return bpm;
}

/**
 * Start streaming heart rate from HealthKit.
 * @param {Function} callback - called with { bpm, timestamp } on each reading
 * @returns {Function} unsubscribe function
 */
export function startMonitoring(callback) {
  if (Platform.OS !== 'ios' || !AppleHealthKit) {
    console.warn('HealthKit not available on this platform');
    return () => {};
  }

  _bpmCallback = callback;
  _subscriptionActive = true;

  // Primary: observer query for new HK samples (~1-2s)
  const observer = AppleHealthKit.subscribeToChanges(
    AppleHealthKit.Constants.Permissions.HeartRate,
    () => {
      if (!_subscriptionActive) return;
      const options = {
        unit: 'bpm',
        startDate: new Date(Date.now() - 10000).toISOString(), // last 10 sec
        endDate: new Date().toISOString(),
        ascending: false,
        limit: 1,
      };
      AppleHealthKit.getHeartRateSamples(options, (err, results) => {
        if (err || !results || results.length === 0) return;
        const bpm = validateBpm(Math.round(results[0].value));
        if (bpm !== null) {
          _lastBpm = bpm;
          if (_bpmCallback) {
            _bpmCallback({ bpm, timestamp: new Date(results[0].endDate).getTime() });
          }
        }
      });
    }
  );

  // Fallback: polling every 2 seconds
  const pollInterval = setInterval(() => {
    if (!_subscriptionActive) return;
    const options = {
      unit: 'bpm',
      startDate: new Date(Date.now() - 5000).toISOString(),
      endDate: new Date().toISOString(),
      ascending: false,
      limit: 1,
    };
    AppleHealthKit.getHeartRateSamples(options, (err, results) => {
      if (err || !results || results.length === 0) return;
      const bpm = validateBpm(Math.round(results[0].value));
      if (bpm !== null && bpm !== _lastBpm) {
        _lastBpm = bpm;
        if (_bpmCallback) {
          _bpmCallback({ bpm, timestamp: new Date(results[0].endDate).getTime() });
        }
      }
    });
  }, 2000);

  return () => {
    _subscriptionActive = false;
    _bpmCallback = null;
    clearInterval(pollInterval);
    if (observer && typeof observer.remove === 'function') {
      observer.remove();
    }
  };
}

/**
 * Stop heart rate monitoring.
 */
export function stopMonitoring() {
  _subscriptionActive = false;
  _bpmCallback = null;
}

/**
 * Get the last known BPM reading.
 */
export function getLastBpm() {
  return _lastBpm;
}

export default {
  requestAuthorization,
  validateBpm,
  startMonitoring,
  stopMonitoring,
  getLastBpm,
  isAvailable: () => Platform.OS === 'ios' && AppleHealthKit !== null,
};
