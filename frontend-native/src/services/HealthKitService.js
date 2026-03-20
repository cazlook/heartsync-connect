/**
 * HealthKitService.js
 * iOS HealthKit heart rate integration — lazy require edition.
 *
 * CRITICAL: react-native-health uses TurboModules and CANNOT be required at
 * module scope in Expo Go or when the native binary hasn't linked the module.
 * All requires are deferred inside functions so they only execute when called.
 */
import { Platform } from 'react-native';

const MIN_BPM = 30;
const MAX_BPM = 220;

let _subscriptionActive = false;
let _lastBpm = null;
let _bpmCallback = null;

/**
 * Lazily load AppleHealthKit. Returns null if unavailable.
 * Never called at module load time.
 */
function getAppleHealthKit() {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('react-native-health').default;
  } catch {
    return null;
  }
}

/**
 * Build HealthKit permissions object.
 * Only called after confirming we're on iOS.
 */
function buildPermissions(AppleHealthKit) {
  return {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.HeartRate],
      write: [],
    },
  };
}

/**
 * Check if HealthKit is available on this device/environment.
 * Safe to call in Expo Go — returns false without crashing.
 */
export function isAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    const hk = require('react-native-health').default;
    return !!hk;
  } catch {
    return false;
  }
}

/**
 * Validate a BPM reading. Returns null if out of range.
 */
export function validateBpm(bpm) {
  if (typeof bpm !== 'number' || isNaN(bpm)) return null;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return bpm;
}

/**
 * Request HealthKit authorization.
 * Returns false (no crash) in Expo Go / when module is absent.
 */
export async function requestAuthorization() {
  const AppleHealthKit = getAppleHealthKit();
  if (!AppleHealthKit) return false;
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(buildPermissions(AppleHealthKit), (err) => {
      if (err) {
        console.warn('HealthKit auth error:', err);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Start streaming heart rate from HealthKit.
 * Primary: observer subscription (~1-2 sec latency).
 * Fallback: polling every 2 seconds.
 * Returns a no-op unsubscribe if HealthKit is unavailable.
 *
 * @param {Function} callback - ({ bpm, timestamp }) => void
 * @returns {Function} unsubscribe
 */
export function startMonitoring(callback) {
  const AppleHealthKit = getAppleHealthKit();
  if (!AppleHealthKit) {
    console.warn('HealthKit not available — use BpmSimulatorService in Expo Go');
    return () => {};
  }

  _bpmCallback = callback;
  _subscriptionActive = true;

  function fetchLatest() {
    const options = {
      unit: 'bpm',
      startDate: new Date(Date.now() - 10000).toISOString(),
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

  // Primary: observer for new HK samples
  let observer = null;
  try {
    observer = AppleHealthKit.subscribeToChanges(
      AppleHealthKit.Constants.Permissions.HeartRate,
      () => { if (_subscriptionActive) fetchLatest(); }
    );
  } catch (e) {
    console.warn('HealthKit subscribeToChanges failed, using polling only:', e.message);
  }

  // Fallback: polling every 2 seconds
  const pollInterval = setInterval(() => {
    if (_subscriptionActive) fetchLatest();
  }, 2000);

  return () => {
    _subscriptionActive = false;
    _bpmCallback = null;
    clearInterval(pollInterval);
    if (observer && typeof observer.remove === 'function') observer.remove();
  };
}

export function stopMonitoring() {
  _subscriptionActive = false;
  _bpmCallback = null;
}

export function getLastBpm() {
  return _lastBpm;
}

export default {
  isAvailable,
  requestAuthorization,
  validateBpm,
  startMonitoring,
  stopMonitoring,
  getLastBpm,
};
