/**
 * BiometricEngine - core logic for biometric-based attraction detection
 * 
 * Algoritmo:
 * 1. Baseline personalizzata (mean_bpm, std_dev) raccolta in calibrazione
 * 2. Campionamento BPM ogni 2 secondi durante il browsing
 * 3. Filtro anti-rumore: media mobile (finestra 5 campioni)
 * 4. Calcolo z-score: (bpm_filtrato - baseline_mean) / baseline_std
 * 5. Reazione rilevata se z_score >= 2.0 (sigma)
 * 6. Match = entrambi gli utenti hanno reazione mutua
 */

export const BIOMETRIC_CONFIG = {
  Z_SCORE_THRESHOLD: 2.0,       // soglia reazione significativa
  SAMPLE_INTERVAL_MS: 2000,     // intervallo campionamento
  MOVING_AVG_WINDOW: 5,         // finestra media mobile anti-rumore
  MIN_SAMPLES_FOR_MATCH: 3,     // campioni minimi prima di valutare
  CALIBRATION_DURATION_S: 120,  // durata calibrazione in secondi
  CALIBRATION_SAMPLE_INTERVAL: 2000, // ms tra campioni calibrazione
} as const;

export interface BiometricBaseline {
  mean_bpm: number;
  std_dev: number;
  samples_count: number;
  calibrated_at: string;
  baseline_calibrated: boolean;
}

export interface BiometricSample {
  bpm: number;
  timestamp: number;
  filtered_bpm: number;
  z_score: number;
}

export interface ReactionEvent {
  profileId: string;
  z_score: number;
  peak_bpm: number;
  detected_at: string;
}

/**
 * Calcola z-score rispetto alla baseline
 */
export function calculateZScore(
  bpm: number,
  baseline: BiometricBaseline
): number {
  if (baseline.std_dev === 0) return 0;
  return (bpm - baseline.mean_bpm) / baseline.std_dev;
}

/**
 * Applica media mobile per filtrare il rumore del segnale BPM
 */
export function applyMovingAverage(samples: number[], window: number): number {
  if (samples.length === 0) return 0;
  const slice = samples.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Calcola baseline dalla lista di campioni BPM
 */
export function computeBaseline(bpmSamples: number[]): Omit<BiometricBaseline, 'calibrated_at' | 'baseline_calibrated'> {
  const n = bpmSamples.length;
  if (n === 0) return { mean_bpm: 72, std_dev: 5, samples_count: 0 };

  const mean = bpmSamples.reduce((a, b) => a + b, 0) / n;
  const variance = bpmSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    mean_bpm: Math.round(mean),
    std_dev: parseFloat(stdDev.toFixed(2)),
    samples_count: n,
  };
}

/**
 * Determina il colore del BPM display in base al z-score
 */
export function getBpmDisplayClass(zScore: number): string {
  if (zScore >= BIOMETRIC_CONFIG.Z_SCORE_THRESHOLD) return 'text-rose-400 animate-pulse';
  if (zScore >= 1) return 'text-orange-400';
  if (zScore >= 0.5) return 'text-yellow-400';
  return 'text-green-400';
}

/**
 * Calcola il cardiac_score per il match (0-100)
 * Basato sulla media dei z-score dei due utenti
 */
export function calculateCardiacScore(zScore1: number, zScore2: number): number {
  const avg = (zScore1 + zScore2) / 2;
  // z=2 -> ~66, z=3 -> ~99, z=4 -> 100
  const score = Math.min(100, Math.round(avg * 33));
  return Math.max(0, score);
}

/**
 * Genera un messaggio per l'utente in base all'intensita' della reazione
 */
export function getReactionMessage(zScore: number): string {
  if (zScore >= 4) return 'Reazione fortissima! Il tuo cuore sta battendo veloce 💗';
  if (zScore >= 3) return 'Forte reazione biometrica rilevata 💓';
  if (zScore >= 2) return 'Il tuo cuore ha reagito 💓';
  return 'Nessuna reazione significativa';
}
