import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, SafeAreaView,
} from 'react-native';
import api from '../constants/api_client';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function MatchesScreen({ navigation }) {
  const { token } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
            const { data } = await api.get('/api/matching/my-matches');
        
      });
      setMatches(data);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Chat', { matchId: item.id, user: item.other_user })}
    >
      <View style={styles.avatarContainer}>
        {item.other_user.photos?.[0] ? (
          <Image source={{ uri: item.other_user.photos[0] }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{item.other_user.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.heartBadge}>
          <Text style={styles.heartBadgeText}>❤️</Text>
        </View>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.other_user.name}</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{item.cardiac_score}%</Text>
          </View>
        </View>
        {item.other_user.city && <Text style={styles.city}>📍 {item.other_user.city}</Text>}
        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.last_message || 'Inizia la conversazione 💬'}
        </Text>
      </View>
      {item.unread_count ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>I tuoi Match</Text>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#f43f5e" /></View>
      ) : matches.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>💕</Text>
          <Text style={styles.emptyTitle}>Nessun match ancora</Text>
          <Text style={styles.emptyText}>Il tuo cuore troverà qualcuno!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={fetchMatches}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 26, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f43f5e', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 20 },
  heartBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 10, padding: 1 },
  heartBadgeText: { fontSize: 14 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  scoreBadge: { backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  scoreText: { fontSize: 11, fontWeight: '700', color: '#f43f5e' },
  city: { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  lastMsg: { fontSize: 13, color: '#6b7280' },
  unreadBadge: { backgroundColor: '#f43f5e', borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
