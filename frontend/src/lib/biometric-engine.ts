/**
 * 🫀 BIOMETRIC MATCHING ENGINE V2 — PRODUCTION READY
 * 
 * FIXED ISSUES FROM CTO REVIEW:
 * ✅ Baseline dinamica (rolling average non statica)
 * ✅ Multi-signal validation (≥2-3 reactions coerenti)
 * ✅ Adaptive threshold (1.5 → 2.0 → 2.5 levels)
 * ✅ Confidence score (affidabilità 0-1)
 * ✅ Context filtering (BPM > 120, instabilità, rumore)
 * ✅ Interest levels (basso, medio, alto)
 */

// ==== CONFIGURAZIONE ADATTIVA ====
export const BIOMETRIC_CONFIG = {
  // Baseline dinamica (rolling average)
  BASELINE_WINDOW_SIZE: 300, // 5 min di dati per baseline
  BASELINE_MIN_SAMPLES: 20,  // minimo 20 letture per baseline valida
  BASELINE_UPDATE_INTERVAL: 30000, // aggiorna baseline ogni 30s
  
  // Thresholds adattivi per livelli di interesse
  THRESHOLD_LOW: 1.5,      // interesse iniziale
  THRESHOLD_MEDIUM: 2.0,   // interesse forte
  THRESHOLD_HIGH: 2.5,     // interesse altissimo
  
  // Multi-signal validation
  MIN_REACTIONS_FOR_VALID_INTEREST: 2,  // minimo 2 reaction coerenti
  MAX_TIME_WINDOW_REACTIONS: 60000,      // reaction entro 60s
  
  // Context filtering (scarta dati sporchi)
  MAX_ACCEPTABLE_BPM: 120,   // sopra = stress/attività fisica
  MIN_ACCEPTABLE_BPM: 45,    // sotto = errore sensore
  MAX_BPM_VARIANCE: 20,      // varianza massima acceptable
  
  // Confidence scoring
  MIN_CONFIDENCE: 0.5,       // sotto = non affidabile
  CONFIDENCE_DECAY: 0.9,     // ogni segnale ambiguo riduce fiducia
  
  // Sampling & calibration
  SAMPLE_INTERVAL_MS: 2000,
  CALIBRATION_DURATION_MS: 120000,
  MOVING_AVERAGE_WINDOW: 5,
};

// ==== TYPES ====
export interface BiometricReading {
  bpm: number;
  timestamp: number;
  context?: 'resting' | 'active' | 'viewing' | 'unknown';
  isValid: boolean;  // passa context filter?
}

export interface BaselineData {
  mean: number;
  stdDev: number;
  samples: number;
  lastUpdate: number;
  rollingWindow: number[];  // rolling window per baseline dinamica
}

export interface BiometricReaction {
  targetUserId: string;
  zScore: number;
  peakBpm: number;
  baselineBpm: number;
  timestamp: number;
  confidence: number;  // 0-1 affidabilità
  level: 'low' | 'medium' | 'high' | 'none';  // livello interesse
}

export interface ConfidenceFactors {
  baselineQuality: number;      // 0-1 baseline affidabile?
  signalStability: number;      // 0-1 BPM stabile?
  contextValidity: number;      // 0-1 context OK?
  multiSignalStrength: number;  // 0-1 più reaction coerenti?
}

// ==== BASELINE DINAMICA (ROLLING AVERAGE) ====
export function updateDynamicBaseline(
  currentBaseline: BaselineData,
  newReading: BiometricReading
): BaselineData {
  // Aggiungi nuovo sample alla finestra rolling
  const window = [...currentBaseline.rollingWindow, newReading.bpm];
  
  // Mantieni solo BASELINE_WINDOW_SIZE samples più recenti
  if (window.length > BIOMETRIC_CONFIG.BASELINE_WINDOW_SIZE) {
    window.shift();
  }
  
  // Ricalcola baseline dinamicamente
  const mean = window.reduce((sum, bpm) => sum + bpm, 0) / window.length;
  const variance = window.reduce((sum, bpm) => sum + Math.pow(bpm - mean, 2), 0) / window.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    mean,
    stdDev,
    samples: window.length,
    lastUpdate: Date.now(),
    rollingWindow: window,
  };
}

export function shouldUpdateBaseline(baseline: BaselineData): boolean {
  return Date.now() - baseline.lastUpdate > BIOMETRIC_CONFIG.BASELINE_UPDATE_INTERVAL;
}

// ==== CONTEXT FILTERING (SCARTA DATI SPORCHI) ====
export function isReadingValid(reading: BiometricReading, recentReadings: BiometricReading[]): boolean {
  const { bpm } = reading;
  
  // 1. BPM fuori range acceptable → invalid
  if (bpm > BIOMETRIC_CONFIG.MAX_ACCEPTABLE_BPM || bpm < BIOMETRIC_CONFIG.MIN_ACCEPTABLE_BPM) {
    return false;
  }
  
  // 2. Varianza troppo alta (instabilità) → invalid
  if (recentReadings.length >= 3) {
    const last3 = recentReadings.slice(-3);
    const bpmValues = last3.map(r => r.bpm);
    const mean = bpmValues.reduce((sum, b) => sum + b, 0) / bpmValues.length;
    const variance = bpmValues.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / bpmValues.length;
    
    if (Math.sqrt(variance) > BIOMETRIC_CONFIG.MAX_BPM_VARIANCE) {
      return false;  // troppo instabile
    }
  }
  
  return true;
}

// ==== Z-SCORE CALCULATION ====
export function calculateZScore(currentBpm: number, baseline: BaselineData): number {
  if (baseline.stdDev === 0) return 0;
  return (currentBpm - baseline.mean) / baseline.stdDev;
}

// ==== ADAPTIVE THRESHOLD (LIVELLI DI INTERESSE) ====
export function determineInterestLevel(zScore: number): 'low' | 'medium' | 'high' | 'none' {
  if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_HIGH) return 'high';
  if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_MEDIUM) return 'medium';
  if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_LOW) return 'low';
  return 'none';
}

// ==== CONFIDENCE SCORE CALCULATION ====
export function calculateConfidence(
  baseline: BaselineData,
  reading: BiometricReading,
  recentReactions: BiometricReaction[]
): number {
  const factors: ConfidenceFactors = {
    // 1. Baseline quality: più samples → più affidabile
    baselineQuality: Math.min(1, baseline.samples / BIOMETRIC_CONFIG.BASELINE_MIN_SAMPLES),
    
    // 2. Signal stability: BPM stabile = più fiducia
    signalStability: reading.isValid ? 1.0 : 0.3,
    
    // 3. Context validity: context noto = più fiducia
    contextValidity: reading.context === 'viewing' ? 1.0 : (reading.context === 'resting' ? 0.8 : 0.5),
    
    // 4. Multi-signal strength: più reactions coerenti = più fiducia
    multiSignalStrength: Math.min(1, recentReactions.length / BIOMETRIC_CONFIG.MIN_REACTIONS_FOR_VALID_INTEREST),
  };
  
  // Confidence totale = weighted average
  const weights = [0.3, 0.25, 0.2, 0.25];  // somma = 1
  const scores = Object.values(factors);
  const confidence = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
  
  return Math.max(0, Math.min(1, confidence));
}

// ==== MULTI-SIGNAL VALIDATION ====
export function validateMultiSignal(
  reactions: BiometricReaction[],
  targetUserId: string
): { isValid: boolean; avgZScore: number; avgConfidence: number } {
  // Filtra reactions per target entro finestra temporale
  const now = Date.now();
  const recentReactions = reactions.filter(
    r => r.targetUserId === targetUserId && 
         (now - r.timestamp) < BIOMETRIC_CONFIG.MAX_TIME_WINDOW_REACTIONS
  );
  
  // Serve minimo MIN_REACTIONS_FOR_VALID_INTEREST reactions
  if (recentReactions.length < BIOMETRIC_CONFIG.MIN_REACTIONS_FOR_VALID_INTEREST) {
    return { isValid: false, avgZScore: 0, avgConfidence: 0 };
  }
  
  // Calcola medie
  const avgZScore = recentReactions.reduce((sum, r) => sum + r.zScore, 0) / recentReactions.length;
  const avgConfidence = recentReactions.reduce((sum, r) => sum + r.confidence, 0) / recentReactions.length;
  
  // Valid solo se avg confidence >= threshold
  return {
    isValid: avgConfidence >= BIOMETRIC_CONFIG.MIN_CONFIDENCE,
    avgZScore,
    avgConfidence,
  };
}

// ==== CARDIAC SCORE (0-100) ====
export function calculateCardiacScore(
  zScore1: number,
  zScore2: number,
  confidence1: number,
  confidence2: number
): { score: number; confidence: number } {
  // z=2 → ~66, z=3 → ~99, z=4 → 100
  const rawScore = Math.min(100, Math.round(((zScore1 + zScore2) / 2) * 33));
  const combinedConfidence = (confidence1 + confidence2) / 2;
  
  return {
    score: Math.max(0, rawScore),
    confidence: Math.max(0, Math.min(1, combinedConfidence)),
  };
}

// ==== DISPLAY HELPERS ====
export function getBpmDisplayClass(zScore: number): string {
  if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_HIGH) return 'text-rose-400 animate-pulse';
  if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_MEDIUM) return 'text-orange-400';
  if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_LOW) return 'text-yellow-400';
  return 'text-green-400';
}

export function getReactionMessage(level: 'low' | 'medium' | 'high' | 'none'): string {
  switch (level) {
    case 'high': return '❤️‍🔥 Il tuo cuore batte forte';
    case 'medium': return '💓 Interessante...';
    case 'low': return '💭 Potrebbe piacerti';
    default: return '🫀 Nessuna reazione';
  }
}

// ==== MOVING AVERAGE (SMOOTHING) ====
export function applyMovingAverage(values: number[], windowSize: number = BIOMETRIC_CONFIG.MOVING_AVERAGE_WINDOW): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((sum, val) => sum + val, 0) / window.length;
}

// ==== EXPORT DEFAULT CONFIG ====
export default BIOMETRIC_CONFIG;
