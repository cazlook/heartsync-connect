/**
 * BpmSimulatorService.js
 * Debug BPM simulator for use in Expo Go / simulators without real HealthKit.
 * Generates a sinusoidal signal with Gaussian noise, range 55-95 BPM.
 * Activates automatically when __DEV__ is true and no real biometric source is available.
 */

// Simulator parameters per spec
const SIM_BASE_BPM = 72;       // resting baseline
const SIM_AMPLITUDE = 10;      // sinusoidal amplitude (±10 bpm)
const SIM_PERIOD_MS = 30000;   // 30s sinusoidal cycle
const SIM_NOISE_STD = 2.5;     // Gaussian noise std dev
const SIM_MIN_BPM = 55;
const SIM_MAX_BPM = 95;
const SIM_INTERVAL_MS = 1500;  // emit every 1.5 seconds

let _running = false;
let _interval = null;
let _startTime = null;
let _bpmCallback = null;

/**
 * Box-Muller transform for Gaussian noise.
 */
function gaussianNoise(std) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return n * std;
}

/**
 * Generate a simulated BPM reading.
 * Formula: base + amplitude * sin(2π * t / period) + noise
 * Clamped to [SIM_MIN_BPM, SIM_MAX_BPM].
 */
function generateBpm() {
  const elapsed = Date.now() - _startTime;
  const sinusoidal = SIM_AMPLITUDE * Math.sin((2 * Math.PI * elapsed) / SIM_PERIOD_MS);
  const noise = gaussianNoise(SIM_NOISE_STD);
  const raw = SIM_BASE_BPM + sinusoidal + noise;
  return Math.round(Math.min(SIM_MAX_BPM, Math.max(SIM_MIN_BPM, raw)));
}

/**
 * Start the BPM simulator.
 * @param {Function} callback - called with { bpm: number, timestamp: number, simulated: true }
 * @returns {Function} stop function
 */
export function startSimulator(callback) {
  if (_running) {
    console.warn('BpmSimulator already running');
    return () => stopSimulator();
  }

  _bpmCallback = callback;
  _startTime = Date.now();
  _running = true;

  // Emit first reading immediately
  const firstBpm = generateBpm();
  if (_bpmCallback) {
    _bpmCallback({ bpm: firstBpm, timestamp: Date.now(), simulated: true });
  }

  _interval = setInterval(() => {
    if (!_running) return;
    const bpm = generateBpm();
    if (_bpmCallback) {
      _bpmCallback({ bpm, timestamp: Date.now(), simulated: true });
    }
  }, SIM_INTERVAL_MS);

  return () => stopSimulator();
}

/**
 * Stop the BPM simulator.
 */
export function stopSimulator() {
  _running = false;
  _bpmCallback = null;
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}

/**
 * Whether the simulator is currently active.
 */
export function isRunning() {
  return _running;
}

/**
 * Whether this device should auto-activate the simulator.
 * Activates in __DEV__ mode (Expo Go, simulators).
 */
export function shouldAutoActivate() {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Get a single simulated BPM reading synchronously (for testing).
 */
export function getInstantReading() {
  const ts = _startTime || Date.now();
  const elapsed = Date.now() - ts;
  const sinusoidal = SIM_AMPLITUDE * Math.sin((2 * Math.PI * elapsed) / SIM_PERIOD_MS);
  const noise = gaussianNoise(SIM_NOISE_STD);
  const raw = SIM_BASE_BPM + sinusoidal + noise;
  return {
    bpm: Math.round(Math.min(SIM_MAX_BPM, Math.max(SIM_MIN_BPM, raw))),
    timestamp: Date.now(),
    simulated: true,
  };
}

export default {
  startSimulator,
  stopSimulator,
  isRunning,
  shouldAutoActivate,
  getInstantReading,
};
