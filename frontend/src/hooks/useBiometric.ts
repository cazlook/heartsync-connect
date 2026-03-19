import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  BIOMETRIC_CONFIG,
  BiometricReading,
  BiometricReaction,
  BaselineData,
  calculateZScore,
  updateDynamicBaseline,
  shouldUpdateBaseline,
  isReadingValid,
  calculateConfidence,
  determineInterestLevel,
  validateMultiSignal,
  applyMovingAverage,
  getReactionMessage,
  getBpmDisplayClass,
} from '@/lib/biometric-engine';

/**
 * 🫀 useBiometric V2 - PRODUCTION READY HOOK
 * 
 * KEY FEATURES:
 * ✅ Baseline dinamica (rolling window, aggiornamento continuo)
 * ✅ Multi-signal validation (no singoli spike casuali)
 * ✅ Adaptive threshold (1.5/2.0/2.5 livelli)
 * ✅ Confidence scoring (affidabilità 0-1)
 * ✅ Context filtering (scarta BPM > 120, instabilità)
 * ✅ Interest levels (low/medium/high)
 */

export function useBiometric(profileId?: string) {
  const { user } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentBpm, setCurrentBpm] = useState<number>(0);
  const [baseline, setBaseline] = useState<BaselineData>({
    mean: 70,
    stdDev: 5,
    samples: 0,
    lastUpdate: Date.now(),
    rollingWindow: [],
  });
  
  // State per multi-signal validation
  const [reactions, setReactions] = useState<BiometricReaction[]>([]);
  const [recentReadings, setRecentReadings] = useState<BiometricReading[]>([]);
  const [currentReaction, setCurrentReaction] = useState<BiometricReaction | null>(null);
  const [interestLevel, setInterestLevel] = useState<'low' | 'medium' | 'high' | 'none'>('none');
  const [confidence, setConfidence] = useState<number>(0);
  
  const intervalRef = useRef<number | null>(null);
  const bpmHistory = useRef<number[]>([]);

  // Simula lettura BPM (in produzione usare Web Bluetooth API)
  const simulateBpmReading = useCallback((): number => {
    // Simula baseline + rumore Gaussiano
    const noise = (Math.random() - 0.5) * 10;
    return Math.round(baseline.mean + noise + (Math.random() * 5));
  }, [baseline.mean]);

  // Avvia monitoraggio BPM
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    
    intervalRef.current = window.setInterval(() => {
      const rawBpm = simulateBpmReading();
      const smoothedBpm = Math.round(
        applyMovingAverage([...bpmHistory.current, rawBpm])
      );
      
      bpmHistory.current = [...bpmHistory.current, smoothedBpm].slice(-BIOMETRIC_CONFIG.MOVING_AVERAGE_WINDOW);
      setCurrentBpm(smoothedBpm);
      
      // Crea BiometricReading
      const reading: BiometricReading = {
        bpm: smoothedBpm,
        timestamp: Date.now(),
        context: profileId ? 'viewing' : 'resting',
        isValid: false,  // validate dopo
      };
      
      // Context filtering
      reading.isValid = isReadingValid(reading, recentReadings);
      
      // Aggiorna recentReadings
      setRecentReadings(prev => [
        ...prev.slice(-20),  // mantieni solo ultimi 20
        reading,
      ]);
      
      // Baseline dinamica: aggiorna se necessario
      setBaseline(prev => {
        if (reading.isValid && reading.context === 'resting') {
          if (shouldUpdateBaseline(prev)) {
            return updateDynamicBaseline(prev, reading);
          }
        }
        return prev;
      });
      
      // Calcola Z-score e reaction
      if (profileId && reading.isValid) {
        const zScore = calculateZScore(smoothedBpm, baseline);
        const level = determineInterestLevel(zScore);
        const conf = calculateConfidence(baseline, reading, reactions);
        
        setInterestLevel(level);
        setConfidence(conf);
        
        // Se z-score >= threshold minimo, crea reaction
        if (zScore >= BIOMETRIC_CONFIG.THRESHOLD_LOW) {
          const reaction: BiometricReaction = {
            targetUserId: profileId,
            zScore,
            peakBpm: smoothedBpm,
            baselineBpm: baseline.mean,
            timestamp: Date.now(),
            confidence: conf,
            level,
          };
          
          setCurrentReaction(reaction);
          setReactions(prev => [...prev, reaction]);
          
          // Valida multi-signal
          const validation = validateMultiSignal(reactions, profileId);
          
          // Se multi-signal validation passa → salva al backend
          if (validation.isValid && conf >= BIOMETRIC_CONFIG.MIN_CONFIDENCE) {
            supabase.from('biometric_reactions').insert({
              user_id: user?.id,
              target_profile_id: profileId,
              z_score: validation.avgZScore,
              peak_bpm: smoothedBpm,
              confidence: validation.avgConfidence,
              level,
              reacted_at: new Date().toISOString(),
            });
          }
        }
      }
    }, BIOMETRIC_CONFIG.SAMPLE_INTERVAL_MS);
  }, [isMonitoring, simulateBpmReading, profileId, user, baseline, reactions, recentReadings]);

  // Stop monitoraggio
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopMonitoring();
  }, [stopMonitoring]);

  // Helper: baseline calibrata?
  const isBaselineCalibrated = baseline.samples >= BIOMETRIC_CONFIG.BASELINE_MIN_SAMPLES;

  return {
    // Monitoring state
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    
    // BPM data
    currentBpm,
    baseline,
    isBaselineCalibrated,
    
    // Reaction data (V2 features)
    currentReaction,
    interestLevel,
    confidence,
    reactions,
    
    // Helpers
    zScore: currentReaction?.zScore ?? 0,
    reactionMessage: getReactionMessage(interestLevel),
    bpmDisplayClass: getBpmDisplayClass(currentReaction?.zScore ?? 0),
    
    // Multi-signal validation result
    multiSignalValidation: profileId ? validateMultiSignal(reactions, profileId) : null,
  };
}
