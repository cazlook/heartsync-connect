from 'react-native'  from 'react-native-safe-area-context'
  import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Animated, Alert,
} from 'react-native';
import api from '../constants/api_client';
import { useAuth } from '../contexts/AuthContext';
import { useHeartRate } from '../contexts/HeartRateContext';
import { API_URL } from '../constants/api';
export default function CalibrationScreen({ navigation }) {
  const { token } = useAuth();
  const { baselineBpm } = useHeartRate();
  const [phase, setPhase] = useState('intro'); // intro | measuring | done
  const [bpm, setBpm] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase === 'measuring') {
      startPulse();
      // Simula acquisizione BPM da sensore
      const t = setTimeout(() => {
        const simulatedBpm = Math.floor(60 + Math.random() * 30);
        setBpm(simulatedBpm);
        setPhase('done');
        saveBpm(simulatedBpm);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  };

  const saveBpm = async (bpmValue) => {
    try {
      await api.post('/api/biometrics/baseline', { bpm: bpmValue });
        
      });
    } catch {}


  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Calibrazione</Text>
        <Text style={styles.subtitle}>Misura il tuo battito cardiaco a riposo</Text>

        <View style={styles.center}>
          <Animated.Text style={[styles.heart, { transform: [{ scale: pulseAnim }] }]}>
            {phase === 'done' ? '💖' : '❤️'}
          </Animated.Text>
          {phase === 'measuring' && (
            <Text style={styles.measuring}>Misurazione in corso...</Text>
          )}
          {phase === 'done' && bpm && (
            <View style={styles.resultBox}>
              <Text style={styles.bpmValue}>{bpm}</Text>
              <Text style={styles.bpmLabel}>BPM a riposo</Text>
              <Text style={styles.bpmNote}>🎉 Calibrazione completata!</Text>
            </View>
          )}
        </View>

        {phase === 'intro' && (
          <TouchableOpacity style={styles.btn} onPress={() => setPhase('measuring')}>
            <Text style={styles.btnText}>Inizia calibrazione</Text>
          </TouchableOpacity>
        )}
        {phase === 'done' && (
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Main')}>
            <Text style={styles.btnText}>Continua</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff9fb' },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#1a1a2e', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#9ca3af', marginTop: 8, marginBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heart: { fontSize: 100 },
  measuring: { marginTop: 24, fontSize: 16, color: '#f43f5e', fontWeight: '600' },
  resultBox: { alignItems: 'center', marginTop: 24 },
  bpmValue: { fontSize: 72, fontWeight: '900', color: '#f43f5e' },
  bpmLabel: { fontSize: 18, color: '#6b7280', marginTop: 4 },
  bpmNote: { fontSize: 16, marginTop: 12 },
  btn: { backgroundColor: '#f43f5e', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 32 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
