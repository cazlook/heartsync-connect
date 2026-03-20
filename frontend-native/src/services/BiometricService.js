/**
 * BiometricService.js
 * Unified biometric abstraction layer for HeartsSync.
 *
 * Priority cascade:
 *   1. iOS real device with HealthKit linked  → HealthKitService
 *   2. Android real device with Health Connect → HealthConnectService
 *   3. Expo Go / simulator / any other env   → BpmSimulatorService (auto)
 *
 * This is the ONLY file the rest of the app (contexts, screens) should import.
 * It guarantees no crash in Expo Go because all native requires are lazy.
 */
import { Platform } from 'react-native';
import BpmSimulatorService from './BpmSimulatorService';

// Source identifiers
export const SOURCE = {
  HEALTHKIT: 'healthkit',
  HEALTH_CONNECT: 'health_connect',
  SIMULATOR: 'simulator',
};

let _activeSource = null;  // which source is currently active
let _stopFn = null;        // current unsubscribe/stop function

/**
 * Detect which biometric source to use on this device/environment.
 * Returns SOURCE constant.
 * Fully safe to call in Expo Go — never crashes.
 */
export function detectSource() {
  // iOS: try HealthKit
  if (Platform.OS === 'ios') {
    try {
      const HealthKitService = require('./HealthKitService').default;
      if (HealthKitService.isAvailable()) return SOURCE.HEALTHKIT;
    } catch { /* not available */ }
  }
  // Android: try Health Connect
  if (Platform.OS === 'android') {
    try {
      const HealthConnectService = require('./HealthConnectService').default;
      // isAvailable() is async; assume available if module loads (auth checked later)
      if (HealthConnectService) return SOURCE.HEALTH_CONNECT;
    } catch { /* not available */ }
  }
  // Fallback: simulator
  return SOURCE.SIMULATOR;
}

/**
 * Request authorization from whichever source is active.
 * Always returns a Promise<boolean>.
 */
export async function requestAuthorization() {
  const source = detectSource();
  if (source === SOURCE.HEALTHKIT) {
    try {
      const HealthKitService = require('./HealthKitService').default;
      return await HealthKitService.requestAuthorization();
    } catch { return false; }
  }
  if (source === SOURCE.HEALTH_CONNECT) {
    try {
      const HealthConnectService = require('./HealthConnectService').default;
      return await HealthConnectService.requestAuthorization();
    } catch { return false; }
  }
  // Simulator needs no auth
  return true;
}

/**
 * Start monitoring heart rate.
 * Automatically selects the best available source.
 * Falls back to BpmSimulatorService in Expo Go.
 *
 * @param {Function} callback - ({ bpm, timestamp, source, simulated? }) => void
 * @returns {{ source: string, stop: Function }}
 */
export function startMonitoring(callback) {
  // Stop any existing monitoring
  if (_stopFn) {
    _stopFn();
    _stopFn = null;
  }

  const source = detectSource();
  _activeSource = source;

  // Wrap callback to include source metadata
  const wrappedCallback = (reading) => {
    callback({ ...reading, source });
  };

  if (source === SOURCE.HEALTHKIT) {
    try {
      const HealthKitService = require('./HealthKitService').default;
      _stopFn = HealthKitService.startMonitoring(wrappedCallback);
      console.log('[BiometricService] Using HealthKit');
      return { source, stop: () => { if (_stopFn) { _stopFn(); _stopFn = null; } } };
    } catch (e) {
      console.warn('[BiometricService] HealthKit failed, falling back to simulator:', e.message);
    }
  }

  if (source === SOURCE.HEALTH_CONNECT) {
    try {
      const HealthConnectService = require('./HealthConnectService').default;
      _stopFn = HealthConnectService.startMonitoring(wrappedCallback);
      console.log('[BiometricService] Using Health Connect');
      return { source, stop: () => { if (_stopFn) { _stopFn(); _stopFn = null; } } };
    } catch (e) {
      console.warn('[BiometricService] Health Connect failed, falling back to simulator:', e.message);
    }
  }

  // Simulator fallback — always works, including Expo Go
  _activeSource = SOURCE.SIMULATOR;
  _stopFn = BpmSimulatorService.startSimulator(wrappedCallback);
  console.log('[BiometricService] Using BPM Simulator (Expo Go / debug mode)');
  return {
    source: SOURCE.SIMULATOR,
    stop: () => {
      BpmSimulatorService.stopSimulator();
      _stopFn = null;
    },
  };
}

/**
 * Stop all monitoring.
 */
export function stopMonitoring() {
  if (_stopFn) {
    _stopFn();
    _stopFn = null;
  }
  if (_activeSource === SOURCE.SIMULATOR) {
    BpmSimulatorService.stopSimulator();
  }
  _activeSource = null;
}

/**
 * Get the currently active source identifier.
 */
export function getActiveSource() {
  return _activeSource;
}

/**
 * Whether the simulator is being used (Expo Go / debug).
 */
export function isSimulated() {
  return _activeSource === SOURCE.SIMULATOR;
}

export default {
  SOURCE,
  detectSource,
  requestAuthorization,
  startMonitoring,
  stopMonitoring,
  getActiveSource,
  isSimulated,
};
