import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_URL } from '../constants/api';

const HeartRateContext = createContext(null);

const BASELINE_WINDOW = 30; // seconds
const Z_THRESHOLD = 1.5;
const MIN_DURATION_MS = 2000;
const MAX_BPM_VALID = 120;

export function HeartRateProvider({ children }) {
  const { token } = useAuth();
  const [heartRate, setHeartRate] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [baseline, setBaseline] = useState({ mean: 70, std: 5, count: 0 });
  const [currentZScore, setCurrentZScore] = useState(0);
  const [reactionActive, setReactionActive] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);

  const intervalRef = useRef(null);
  const reactionStartRef = useRef(null);
  const bpmHistoryRef = useRef([]);
  const welfordRef = useRef({ mean: 70, M2: 25, count: 0 });

  // Welford online algorithm for dynamic baseline
  const updateBaseline = useCallback((bpm) => {
    const w = welfordRef.current;
    w.count += 1;
    const delta = bpm - w.mean;
    w.mean += delta / w.count;
    const delta2 = bpm - w.mean;
    w.M2 += delta * delta2;
    const variance = w.count > 1 ? w.M2 / (w.count - 1) : 25;
    const std = Math.sqrt(variance);
    welfordRef.current = { ...w, std };
    setBaseline({ mean: w.mean, std, count: w.count });
    if (w.count >= BASELINE_WINDOW) {
      setIsCalibrated(true);
    }
  }, []);

  const computeZScore = useCallback((bpm) => {
    const { mean, std } = welfordRef.current;
    const effectiveStd = Math.max(std || 5, 3);
    return (bpm - mean) / effectiveStd;
  }, []);

  const processBpm = useCallback(async (bpm) => {
    if (!bpm || bpm <= 0 || bpm > 200) return;
    updateBaseline(bpm);
    const z = computeZScore(bpm);
    setCurrentZScore(z);

    const isValidReaction =
      isCalibrated &&
      z >= Z_THRESHOLD &&
      bpm < MAX_BPM_VALID &&
      targetUserId;

    if (isValidReaction) {
      if (!reactionStartRef.current) {
        reactionStartRef.current = Date.now();
      }
      const duration = Date.now() - reactionStartRef.current;
      if (duration >= MIN_DURATION_MS) {
        setReactionActive(true);
        // Send reaction to backend
        try {
          await axios.post(
            `${API_URL}/api/biometrics/reaction`,
            {
              targetUserId,
              zScore: z,
              bpm,
              duration,
              confidence: Math.min(1.0, duration / 5000),
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {
          console.error('Failed to send reaction:', e);
        }
      }
    } else {
      reactionStartRef.current = null;
      setReactionActive(false);
    }
  }, [isCalibrated, targetUserId, token, updateBaseline, computeZScore]);

  const startMonitoring = useCallback((userId = null) => {
    if (isMonitoring) return;
    setTargetUserId(userId);
    setIsMonitoring(true);
    intervalRef.current = setInterval(() => {
      // Simulator fallback - replace with HealthKit/Health Connect in production
      const simulatedBpm = Math.floor(Math.random() * 40) + 60;
      setHeartRate(simulatedBpm);
      processBpm(simulatedBpm);
    }, 1000);
  }, [isMonitoring, processBpm]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
    setReactionActive(false);
    reactionStartRef.current = null;
  }, []);

  const resetBaseline = useCallback(() => {
    welfordRef.current = { mean: 70, M2: 25, count: 0 };
    setBaseline({ mean: 70, std: 5, count: 0 });
    setIsCalibrated(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <HeartRateContext.Provider
      value={{
        heartRate,
        isMonitoring,
        isCalibrated,
        baseline,
        currentZScore,
        reactionActive,
        targetUserId,
        startMonitoring,
        stopMonitoring,
        resetBaseline,
        setTargetUserId,
      }}
    >
      {children}
    </HeartRateContext.Provider>
  );
}

export function useHeartRate() {
  const ctx = useContext(HeartRateContext);
  if (!ctx) throw new Error('useHeartRate must be used within HeartRateProvider');
  return ctx;
}
