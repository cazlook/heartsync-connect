import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Alert,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useHeartRate } from '../contexts/HeartRateContext';
import { API_URL } from '../constants/api';

export default function CalibrationScreen({ navigation }) {
  const { token } = useAuth();
  const { startMonitoring, stopMonitoring, heartRate, isCalibrated, baseline, resetBaseline } = useHeartRate();
  const [phase, setPhase] = useState('intro'); // intro | calibrating | done
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    if (pulseLoop.current) pulseLoop.current.stop();
    pulseAnim.setValue(1);
  };

  useEffect(() => {
    if (phase === 'calibrating') {
      startPulse();
      startMonitoring();
    } else {
      stopPulse();
      if (phase !== 'calibrating') stopMonitoring();
    }
    return () => {
      stopPulse();
    };
  }, [phase]);

  useEffect(() => {
    if (isCalibrated && phase === 'calibrating') {
      setPhase('done');
      saveBaseline();
    }
  }, [isCalibrated, phase]);

  const saveBaseline = async () => {
    try {
      await axios.post(
        `${API_URL}/api/biometrics/baseline`,
        { baselineMean: baseline.mean, baselineStd: baseline.std },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.error('Failed to save baseline:', e);
    }
  };

  const handleStart = () => {
    resetBaseline();
    setPhase('calibrating');
  };

  const handleDone = () => {
    navigation.replace('Main');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {phase === 'intro' && (
          <>
            <Text style={styles.title}>Calibrazione</Text>
            <Text style={styles.description}>
              Siediti comodamente e rilassati per 30 secondi.{`\n`}
              Misureremo il tuo battito a riposo per creare la tua baseline personale.
            </Text>
            <Animated.Text style={styles.heartIcon}>❤️</Animated.Text>
            <TouchableOpacity style={styles.button} onPress={handleStart}>
              <Text style={styles.buttonText}>Inizia calibrazione</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'calibrating' && (
          <>
            <Text style={styles.title}>Rilassati...</Text>
            <Text style={styles.description}>Acquisizione baseline in corso</Text>
            <Animated.Text style={[styles.heartIcon, { transform: [{ scale: pulseAnim }] }]}>❤️</Animated.Text>
            <Text style={styles.bpmText}>{heartRate ? `${Math.round(heartRate)} BPM` : '...'}</Text>
            <Text style={styles.hint}>Non muoverti, siediti in silenzio</Text>
          </>
        )}

        {phase === 'done' && (
          <>
            <Text style={styles.title}>Perfetto! ✅</Text>
            <Text style={styles.description}>
              Baseline acquisita{`\n`}
              Media: {Math.round(baseline.mean)} BPM
            </Text>
            <Text style={styles.heartIcon}>💚</Text>
            <TouchableOpacity style={styles.button} onPress={handleDone}>
              <Text style={styles.buttonText}>Continua</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
  description: { fontSize: 16, color: '#aaa', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  heartIcon: { fontSize: 80, marginBottom: 24 },
  bpmText: { fontSize: 48, fontWeight: 'bold', color: '#e91e63', marginBottom: 12 },
  hint: { fontSize: 14, color: '#555', textAlign: 'center' },
  button: {
    backgroundColor: '#e91e63',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
