import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useHeartRate } from '../contexts/HeartRateContext';
import { API_URL } from '../constants/api';

export default function InsightsScreen() {
  const { token, user } = useAuth();
  const { baseline, heartRate, currentZScore, cardiacSource, isCalibrated } = useHeartRate();
  const [reactions, setReactions] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchInsights(); }, []);

  const fetchInsights = async () => {
    try {
      const userId = user?.id || user?._id;
      if (!userId) return;

      // Fetch cardiac reactions
      const [reactRes, matchRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/cardiac/reactions/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/cardiac/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (reactRes.status === 'fulfilled') {
        setReactions(reactRes.value.data.reactions || []);
      }
      if (matchRes.status === 'fulfilled') {
        setMatchCount(matchRes.value.data.count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch insights:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchInsights(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#e91e63" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const avgZ = reactions.length > 0
    ? reactions.reduce((s, r) => s + r.avg_z, 0) / reactions.length
    : 0;

  const StatCard = ({ icon, label, value, unit }) => (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}{unit && <Text style={styles.statUnit}>{unit}</Text>}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e91e63" />}
      >
        <Text style={styles.title}>Insights 📊</Text>
        <Text style={styles.subtitle}>La tua attività cardiaca</Text>

        {/* Live BPM card */}
        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>LIVE • {cardiacSource?.toUpperCase()}</Text>
          <Text style={styles.liveBpm}>{heartRate ? `${Math.round(heartRate)} BPM` : '-- BPM'}</Text>
          <Text style={styles.liveZ}>Z-score: {currentZScore.toFixed(2)}</Text>
          <View style={styles.baselineRow}>
            <Text style={styles.baselineStat}>Baseline: {Math.round(baseline.mean)} BPM</Text>
            <Text style={styles.baselineStat}>Std: {baseline.std?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.baselineStat}>{isCalibrated ? '✅ Calibrato' : '⏳ Calibrazione...'}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard icon="❤️" label="Match cardiaci" value={matchCount} />
          <StatCard icon="🔬" label="Reazioni rilevate" value={reactions.length} />
          <StatCard icon="📈" label="Z-score medio" value={avgZ.toFixed(2)} />
          <StatCard icon="🧐" label="Baseline BPM" value={Math.round(baseline.mean)} />
        </View>

        {/* Last reactions */}
        {reactions.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Ultime reazioni cardiache</Text>
            {reactions.slice(0, 5).map((r, i) => (
              <View key={i} style={styles.reactionRow}>
                <Text style={styles.reactionName}>{r.target_name || 'Utente'}</Text>
                <Text style={styles.reactionZ}>z={r.avg_z?.toFixed(2)} conf={r.confidence?.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Come funziona</Text>
          <Text style={styles.infoText}>
            Il tuo cuore risponde in modo involontario agli stimoli emotivi.{`\n\n`}
            Quando il tuo BPM supera la soglia z-score ≥ 1.5 per almeno 2 secondi, generiamo una reazione.{`\n\n`}
            Se anche l'altra persona reagisce a te, nasce un match autentico.{`\n\n`}
            Nessun swipe. Solo fisiologia reale.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20, marginTop: 4 },
  liveCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e91e6340' },
  liveTitle: { fontSize: 12, color: '#e91e63', fontWeight: 'bold', marginBottom: 8 },
  liveBpm: { fontSize: 48, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  liveZ: { fontSize: 14, color: '#888', marginBottom: 12 },
  baselineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  baselineStat: { fontSize: 12, color: '#555' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, alignItems: 'center' },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  statUnit: { fontSize: 16, color: '#888' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4, textAlign: 'center' },
  infoCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  infoText: { fontSize: 14, color: '#888', lineHeight: 22 },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  reactionName: { fontSize: 14, color: '#fff' },
  reactionZ: { fontSize: 12, color: '#e91e63' },
});
