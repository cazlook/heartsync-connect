import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const HeartRateContext = createContext(null);

export function HeartRateProvider({ children }) {
  const [heartRate, setHeartRate] = useState(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationData, setCalibrationData] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef(null);

  // Simulate heart rate reading (replace with actual sensor in production)
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    setIsMonitoring(true);
    intervalRef.current = setInterval(() => {
      // Simulated BPM between 60-100
      const bpm = Math.floor(Math.random() * 40) + 60;
      setHeartRate(bpm);
    }, 1000);
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  const calibrate = useCallback((readings) => {
    if (!readings || readings.length === 0) return;
    const avg = readings.reduce((sum, r) => sum + r, 0) / readings.length;
    const min = Math.min(...readings);
    const max = Math.max(...readings);
    const data = { avg, min, max, timestamp: Date.now() };
    setCalibrationData(data);
    setIsCalibrated(true);
    return data;
  }, []);

  const resetCalibration = useCallback(() => {
    setCalibrationData(null);
    setIsCalibrated(false);
    setHeartRate(null);
  }, []);

  // Calculate compatibility score based on heart rate sync
  const calculateSyncScore = useCallback((myReadings, partnerReadings) => {
    if (!myReadings?.length || !partnerReadings?.length) return 0;
    const myAvg = myReadings.reduce((s, r) => s + r, 0) / myReadings.length;
    const partnerAvg = partnerReadings.reduce((s, r) => s + r, 0) / partnerReadings.length;
    const diff = Math.abs(myAvg - partnerAvg);
    // Closer heart rates = higher score (max 100)
    const score = Math.max(0, 100 - diff * 2);
    return Math.round(score);
  }, []);

  return (
    <HeartRateContext.Provider
      value={{
        heartRate,
        isCalibrated,
        calibrationData,
        isMonitoring,
        startMonitoring,
        stopMonitoring,
        calibrate,
        resetCalibration,
        calculateSyncScore,
      }}
    >
      {children}
    </HeartRateContext.Provider>
  );
}

export function useHeartRate() {
  const context = useContext(HeartRateContext);
  if (!context) {
    throw new Error('useHeartRate must be used within a HeartRateProvider');
  }
  return context;
}

export default HeartRateContext;
