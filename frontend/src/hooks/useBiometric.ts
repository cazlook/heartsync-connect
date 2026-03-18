import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface BiometricReading {
  bpm: number;
  timestamp: number;
  profileId: string;
}

export interface BiometricReaction {
  profileId: string;
  zScore: number;
  reacted: boolean; // z_score >= 2.0
  peakBpm: number;
}

const Z_SCORE_THRESHOLD = 2.0; // soglia reazione significativa
const SAMPLE_INTERVAL_MS = 2000;
const FILTER_WINDOW = 5; // campioni per media mobile

// Calcola z-score: (bpm_attuale - baseline_mean) / baseline_std
export function calcZScore(bpm: number, baselineMean: number, baselineStd: number): number {
  if (baselineStd === 0) return 0;
  return (bpm - baselineMean) / baselineStd;
}

// Filtro anti-rumore: media mobile
export function movingAverage(samples: number[], window: number): number {
  const slice = samples.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function useBiometric(viewingProfileId: string | null) {
  const { user } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const [reaction, setReaction] = useState<BiometricReaction | null>(null);
  const samplesRef = useRef<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseline = (user as any)?.biometrics as {
    mean_bpm: number;
    std_dev: number;
    baseline_calibrated: boolean;
  } | undefined;

  // Simula lettura BPM (rimpiazzare con Web Bluetooth / wearable SDK)
  const readRawBpm = useCallback((): number => {
    const base = baseline?.mean_bpm ?? 72;
    // Simula piccole variazioni + eventuale spike se viewingProfileId attivo
    const noise = (Math.random() - 0.5) * 6;
    return Math.round(base + noise);
  }, [baseline]);

  const startMonitoring = useCallback(() => {
    if (!baseline?.baseline_calibrated || !viewingProfileId) return;
    samplesRef.current = [];
    setReaction(null);
    setIsMonitoring(true);

    intervalRef.current = setInterval(() => {
      const raw = readRawBpm();
      samplesRef.current.push(raw);

      const filteredBpm = movingAverage(samplesRef.current, FILTER_WINDOW);
      const rounded = Math.round(filteredBpm);
      setCurrentBpm(rounded);

      const z = calcZScore(rounded, baseline.mean_bpm, baseline.std_dev);

      if (z >= Z_SCORE_THRESHOLD) {
        const reactionData: BiometricReaction = {
          profileId: viewingProfileId,
          zScore: parseFloat(z.toFixed(2)),
          reacted: true,
          peakBpm: rounded,
        };
        setReaction(reactionData);
        saveReaction(reactionData);
        stopMonitoring();
      }
    }, SAMPLE_INTERVAL_MS);
  }, [baseline, viewingProfileId, readRawBpm]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  const saveReaction = async (r: BiometricReaction) => {
    if (!user) return;
    await supabase.from('biometric_reactions').insert({
      user_id: user.id,
      target_profile_id: r.profileId,
      z_score: r.zScore,
      peak_bpm: r.peakBpm,
      reacted_at: new Date().toISOString(),
    });
  };

  // Ferma monitoring quando cambia profilo
  useEffect(() => {
    stopMonitoring();
    if (viewingProfileId && baseline?.baseline_calibrated) {
      const delay = setTimeout(() => startMonitoring(), 1500);
      return () => clearTimeout(delay);
    }
  }, [viewingProfileId]);

  useEffect(() => {
    return () => stopMonitoring();
  }, []);

  return {
    isMonitoring,
    currentBpm,
    reaction,
    startMonitoring,
    stopMonitoring,
    zScore: currentBpm && baseline
      ? calcZScore(currentBpm, baseline.mean_bpm, baseline.std_dev)
      : 0,
  };
}
