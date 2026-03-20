/**
 * HealthConnectService.js
 * Android Health Connect heart rate integration — lazy require edition.
 *
 * CRITICAL: react-native-health-connect uses TurboModules and CANNOT be required
 * at module scope in Expo Go. All requires are deferred inside functions.
 */
import { Platform } from 'react-native';

const MIN_BPM = 30;
const MAX_BPM = 220;

let _subscriptionActive = false;
let _lastBpm = null;
let _pollInterval = null;
let _bpmCallback = null;

/**
 * Lazily load react-native-health-connect. Returns null if unavailable.
 */
function getHealthConnect() {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-health-connect').default;
  } catch {
    return null;
  }
}

/**
 * Validate a BPM reading.
 */
export function validateBpm(bpm) {
  if (typeof bpm !== 'number' || isNaN(bpm)) return null;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return bpm;
}

/**
 * Check if Health Connect is available. Safe in Expo Go.
 */
export async function isAvailable() {
  const HealthConnect = getHealthConnect();
  if (!HealthConnect) return false;
  try {
    const result = await HealthConnect.getSdkStatus();
    return result === 3; // SdkAvailabilityStatus.SDK_AVAILABLE
  } catch {
    return false;
  }
}

/**
 * Request Health Connect heart rate read permission.
 * Returns false (no crash) when module is absent.
 */
export async function requestAuthorization() {
  const HealthConnect = getHealthConnect();
  if (!HealthConnect) return false;
  try {
    const granted = await HealthConnect.requestPermission([
      { accessType: 'read', recordType: 'HeartRate' },
    ]);
    return Array.isArray(granted) && granted.length > 0;
  } catch (e) {
    console.warn('Health Connect auth error:', e.message);
    return false;
  }
}

/**
 * Internal: fetch the most recent HR sample.
 */
async function fetchLatestBpm() {
  const HealthConnect = getHealthConnect();
  if (!HealthConnect) return null;
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 10000);
    const records = await HealthConnect.readRecords('HeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: past.toISOString(),
        endTime: now.toISOString(),
      },
    });
    if (!records || records.length === 0) return null;
    const latest = records[records.length - 1];
    if (!latest.samples || latest.samples.length === 0) return null;
    const bpm = validateBpm(
      Math.round(latest.samples[latest.samples.length - 1].beatsPerMinute)
    );
    if (bpm === null) return null;
    return { bpm, timestamp: new Date(latest.endTime).getTime() };
  } catch (e) {
    console.warn('Health Connect read error:', e.message);
    return null;
  }
}

/**
 * Start monitoring heart rate via 2-second polling.
 * Returns a no-op if Health Connect is unavailable.
 *
 * @param {Function} callback - ({ bpm, timestamp }) => void
 * @returns {Function} unsubscribe
 */
export function startMonitoring(callback) {
  const HealthConnect = getHealthConnect();
  if (!HealthConnect) {
    console.warn('Health Connect not available — use BpmSimulatorService in Expo Go');
    return () => {};
  }

  _bpmCallback = callback;
  _subscriptionActive = true;

  _pollInterval = setInterval(async () => {
    if (!_subscriptionActive) return;
    const reading = await fetchLatestBpm();
    if (reading && reading.bpm !== _lastBpm) {
      _lastBpm = reading.bpm;
      if (_bpmCallback) _bpmCallback(reading);
    }
  }, 2000);

  return () => stopMonitoring();
}

/**
 * Stop monitoring.
 */
export function stopMonitoring() {
  _subscriptionActive = false;
  _bpmCallback = null;
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
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
