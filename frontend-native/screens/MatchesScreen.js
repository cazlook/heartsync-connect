import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useHeartRate } from '../contexts/HeartRateContext';
import { API_URL } from '../constants/api';

export default function MatchesScreen({ navigation }) {
  const { token } = useAuth();
  const { lastMatch } = useHeartRate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastMatchRef = React.useRef(null);

  const fetchMatches = useCallback(async () => {
    try {
      // Try cardiac matches first, fallback to regular matches
      let matchList = [];
      try {
        const { data } = await axios.get(`${API_URL}/api/cardiac/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        matchList = (data.matches || []).map(m => ({
          id: m.id,
          cardiacScore: m.cardiac_score,
          matchedAt: m.created_at,
          otherUser: m.other_user,
          avgZAtoB: m.avg_z_A_to_B,
          avgZBtoA: m.avg_z_B_to_A,
        }));
      } catch {
        // Fallback to standard matches
        const { data } = await axios.get(`${API_URL}/api/chat/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        matchList = (data || []).map(m => ({
          id: m.id,
          cardiacScore: m.cardiac_score,
          matchedAt: m.matched_at,
          otherUser: { id: m.user2_id, name: 'Utente' },
        }));
      }
      setMatches(matchList);
    } catch (e) {
      console.error('Failed to fetch matches:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // React to new cardiac match from HeartRateContext
  useEffect(() => {
    if (lastMatch && lastMatch !== lastMatchRef.current) {
      lastMatchRef.current = lastMatch;
      Alert.alert(
        '💗 Nuovo Match Cardiaco!',
        `Sintonia al ${Math.round(lastMatch.cardiacScore || 0)}%! Il tuo cuore ha riconosciuto qualcuno.`,
        [{ text: 'Vedi Match', onPress: () => fetchMatches() }]
      );
    }
  }, [lastMatch, fetchMatches]);

  const onRefresh = () => { setRefreshing(true); fetchMatches(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#e91e63" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>I tuoi match 💗</Text>
        <Text style={styles.subtitle}>{matches.length} connessioni cardiache</Text>
      </View>
      <FlatList
        data={matches}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e91e63" />}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Text style={styles.emptyIcon}>💓</Text>
            <Text style={styles.emptyTitle}>Nessun match ancora</Text>
            <Text style={styles.emptyText}>Il tuo cuore ti dirà quando è il momento</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchCard}
            onPress={() => navigation.navigate('Chat', { matchId: item.id, user: item.otherUser })}
          >
            <View style={styles.avatarContainer}>
              <Text style={styles.avatar}>👤</Text>
            </View>
            <View style={styles.matchInfo}>
              <Text style={styles.matchName}>{item.otherUser?.name || item.otherUser?.displayName || 'Utente'}</Text>
              <Text style={styles.matchScore}>❤️ Sintonia: {Math.round(item.cardiacScore || 0)}%</Text>
              {item.avgZAtoB !== undefined && (
                <Text style={styles.zScoreText}>z: {item.avgZAtoB?.toFixed(2)} ↔ {item.avgZBtoA?.toFixed(2)}</Text>
              )}
            </View>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  list: { padding: 16 },
  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  avatarContainer: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2a2a4e', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatar: { fontSize: 28 },
  matchInfo: { flex: 1 },
  matchName: { fontSize: 17, fontWeight: '600', color: '#fff' },
  matchScore: { fontSize: 13, color: '#e91e63', marginTop: 2 },
  zScoreText: { fontSize: 11, color: '#666', marginTop: 2 },
  arrow: { color: '#555', fontSize: 18 },
  emptyView: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
});
