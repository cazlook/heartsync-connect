import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, SafeAreaView,
} from 'react-native';
import api from '../constants/api_client';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function ChatListScreen({ navigation }) {
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
      {item.other_user.photos?.[0] ? (
        <Image source={{ uri: item.other_user.photos[0] }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{item.other_user.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{item.other_user.name}</Text>
        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.last_message || 'Inizia a chattare 💬'}
        </Text>
      </View>
      {item.unread_count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Chat</Text>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#f43f5e" /></View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.empty}>💜 Nessuna chat ancora</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 26, fontWeight: '900', color: '#1a1a2e', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontSize: 16, color: '#9ca3af' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  avatarFallback: { backgroundColor: '#f43f5e', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 20 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 3 },
  lastMsg: { fontSize: 13, color: '#6b7280' },
  badge: { backgroundColor: '#f43f5e', borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
