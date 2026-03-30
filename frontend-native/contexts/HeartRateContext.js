import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_URL } from '../constants/api';
import BiometricService from '../src/services/BiometricService';

const HeartRateContext = createContext(null);

export function HeartRateProvider({ children }) {
  const { token } = useAuth();
  const [heartRate, setHeartRate] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [baseline, setBaseline] = useState({ mean: 70, std: 5, count: 0 });
  const [currentZScore, setCurrentZScore] = useState(0);
  const [reactionActive, setReactionActive] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [lastMatch, setLastMatch] = useState(null);
  const [cardiacSource, setCardiacSource] = useState('simulator');

  const monitorRef = useRef(null);  // { stop: fn } from BiometricService
  const welfordRef = useRef({ mean: 70, M2: 25, count: 0 });
  const tokenRef = useRef(token);
  const targetRef = useRef(targetUserId);

  // Keep refs in sync
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { targetRef.current = targetUserId; }, [targetUserId]);

  // Welford update (client-side mirror, server is authoritative)
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
    if (w.count >= 30) {
      setIsCalibrated(true);
    }
  }, []);

  /**
   * processBpm: called on every BPM reading from BiometricService.
   * Sends BPM to backend cardiac engine; handles response.
   */
  const processBpm = useCallback(async ({ bpm }) => {
    if (!bpm || bpm <= 0 || bpm > 200) return;
    setHeartRate(bpm);
    updateBaseline(bpm);

    const currentToken = tokenRef.current;
    const currentTarget = targetRef.current;

    if (!currentToken) return;

    try {
      const body = { bpm };
      if (currentTarget) body.target_id = currentTarget;

      const res = await axios.post(
        `${API_URL}/api/biometrics/cardiac/heartbeat`,
        body,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );

      const data = res.data;

      // Update z_score from server (authoritative)
      if (typeof data.z_score === 'number') {
        setCurrentZScore(data.z_score);
      }
      // Update calibration from server
      if (data.is_calibrated) {
        setIsCalibrated(true);
      }
      // Update baseline from server
      if (data.baseline_mean) {
        setBaseline(prev => ({
          ...prev,
          mean: data.baseline_mean,
          std: data.baseline_std || prev.std,
          count: data.count || prev.count,
        }));
      }
      // Reaction detected
      if (data.reaction && data.reaction !== 'below_confidence_threshold') {
        setReactionActive(true);
      } else {
        setReactionActive(false);
      }
      // Match created!
      if (data.match_created) {
        setLastMatch({
          matchId: data.match_id,
          cardiacScore: data.cardiac_score,
        });
      }
    } catch (e) {
      // Silently fail - don't interrupt BPM stream
      if (__DEV__) console.warn('[HeartRateContext] cardiac/heartbeat error:', e.message);
    }
  }, [updateBaseline]);

  const startMonitoring = useCallback((userId = null) => {
    if (monitorRef.current) return; // already monitoring
    setTargetUserId(userId);
    setIsMonitoring(true);

    const monitor = BiometricService.startMonitoring(processBpm);
    monitorRef.current = monitor;
    setCardiacSource(monitor.source);
    console.log('[HeartRateContext] Monitoring started, source:', monitor.source);
  }, [processBpm]);

  const stopMonitoring = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.stop();
      monitorRef.current = null;
    }
    BiometricService.stopMonitoring();
    setIsMonitoring(false);
    setReactionActive(false);
  }, []);

  const resetBaseline = useCallback(() => {
    welfordRef.current = { mean: 70, M2: 25, count: 0 };
    setBaseline({ mean: 70, std: 5, count: 0 });
    setIsCalibrated(false);
    setCurrentZScore(0);
  }, []);

  useEffect(() => {
    return () => {
      if (monitorRef.current) {
        monitorRef.current.stop();
        monitorRef.current = null;
      }
      BiometricService.stopMonitoring();
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
        lastMatch,
        cardiacSource,
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
