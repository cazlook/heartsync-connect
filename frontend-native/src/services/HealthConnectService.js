/**
 * HealthConnectService.js
 * Android Health Connect (formerly Google Fit) heart rate integration
 * Abstracts Health Connect API behind a unified BiometricService interface
 */
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const MIN_BPM = 30;
const MAX_BPM = 220;

// Health Connect native module (requires react-native-health-connect or custom bridge)
let HealthConnect = null;
let _eventEmitter = null;

if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect').default;
  } catch (e) {
    console.warn('react-native-health-connect not available');
  }
}

let _subscriptionActive = false;
let _lastBpm = null;
let _pollInterval = null;
let _bpmCallback = null;

/**
 * Validate a BPM reading.
 */
export function validateBpm(bpm) {
  if (typeof bpm !== 'number' || isNaN(bpm)) return null;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return bpm;
}

/**
 * Check if Health Connect is available on this device.
 */
export async function isAvailable() {
  if (Platform.OS !== 'android' || !HealthConnect) return false;
  try {
    const result = await HealthConnect.getSdkStatus();
    return result === 3; // 3 = INSTALLED
  } catch {
    return false;
  }
}

/**
 * Request Health Connect permissions for heart rate.
 * Returns true if granted.
 */
export async function requestAuthorization() {
  if (Platform.OS !== 'android' || !HealthConnect) return false;
  try {
    const granted = await HealthConnect.requestPermission([
      { accessType: 'read', recordType: 'HeartRate' },
    ]);
    return granted && granted.length > 0;
  } catch (e) {
    console.error('Health Connect auth error:', e);
    return false;
  }
}

/**
 * Fetch latest heart rate sample from Health Connect.
 * @returns {{ bpm: number, timestamp: number } | null}
 */
async function fetchLatestBpm() {
  if (!HealthConnect) return null;
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 10000); // last 10 sec
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
    const bpm = validateBpm(Math.round(latest.samples[latest.samples.length - 1].beatsPerMinute));
    if (bpm === null) return null;
    return { bpm, timestamp: new Date(latest.endTime).getTime() };
  } catch (e) {
    console.error('Health Connect read error:', e);
    return null;
  }
}

/**
 * Start monitoring heart rate via polling (every 2 seconds).
 * Health Connect does not support real-time streaming natively;
 * polling is the recommended approach.
 * @param {Function} callback - called with { bpm, timestamp }
 * @returns {Function} unsubscribe
 */
export function startMonitoring(callback) {
  if (Platform.OS !== 'android' || !HealthConnect) {
    console.warn('Health Connect not available on this platform');
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
