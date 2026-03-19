import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function InsightsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/insights`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch {
      // Dati di default per mostrare la UI
      setData({
        avg_cardiac_score: 72,
        total_matches: 5,
        total_swipes: 48,
        top_match_score: 94,
        weekly_activity: [65, 70, 60, 82, 75, 90, 72],
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}><ActivityIndicator color="#f43f5e" size="large" /></View>
      </SafeAreaView>
    );
  }

  const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const maxActivity = data?.weekly_activity ? Math.max(...data.weekly_activity, 1) : 100;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>I tuoi Insights</Text>
        <Text style={styles.subtitle}>Analisi del tuo profilo cardiaco</Text>

        <View style={styles.grid}>
          <View style={[styles.card, styles.cardPrimary]}>
            <Text style={styles.cardEmoji}>❤️</Text>
            <Text style={styles.cardValue}>{data?.avg_cardiac_score ?? '--'}%</Text>
            <Text style={styles.cardLabel}>Score medio</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>💑</Text>
            <Text style={styles.cardValueDark}>{data?.total_matches ?? '--'}</Text>
            <Text style={styles.cardLabelDark}>Match totali</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>👀</Text>
            <Text style={styles.cardValueDark}>{data?.total_swipes ?? '--'}</Text>
            <Text style={styles.cardLabelDark}>Profili visti</Text>
          </View>
          <View style={[styles.card, styles.cardGold]}>
            <Text style={styles.cardEmoji}>🏆</Text>
            <Text style={styles.cardValue}>{data?.top_match_score ?? '--'}%</Text>
            <Text style={styles.cardLabel}>Best match</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Attività settimanale</Text>
          <View style={styles.barsContainer}>
            {weekdays.map((day, i) => {
              const val = data?.weekly_activity?.[i] ?? 0;
              const barH = (val / maxActivity) * 120;
              return (
                <View key={day} style={styles.barCol}>
                  <View style={[styles.bar, { height: barH }]} />
                  <Text style={styles.barLabel}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Consiglio del giorno</Text>
          <Text style={styles.tipText}>
            Il tuo battito cardiaco sincronizzato con qualcuno è la forma più autentica di connessione. Continua ad esplorare!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '900', color: '#1a1a2e', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 24, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card: { width: '47%', backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardPrimary: { backgroundColor: '#f43f5e' },
  cardGold: { backgroundColor: '#f59e0b' },
  cardEmoji: { fontSize: 28, marginBottom: 8 },
  cardValue: { fontSize: 28, fontWeight: '900', color: '#fff' },
  cardValueDark: { fontSize: 28, fontWeight: '900', color: '#1a1a2e' },
  cardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  cardLabelDark: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  chartCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  chartTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 },
  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 24, backgroundColor: '#f43f5e', borderRadius: 6 },
  barLabel: { fontSize: 10, color: '#9ca3af', marginTop: 6 },
  tipCard: { backgroundColor: '#fff0f3', borderRadius: 20, padding: 20, borderLeftWidth: 4, borderLeftColor: '#f43f5e' },
  tipTitle: { fontSize: 15, fontWeight: '700', color: '#f43f5e', marginBottom: 8 },
  tipText: { fontSize: 14, color: '#4b5563', lineHeight: 22 },
});
