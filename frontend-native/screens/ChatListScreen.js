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
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function ChatListScreen({ navigation }) {
  const { token } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/chat/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(data || []);
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const onRefresh = () => { setRefreshing(true); fetchChats(); };

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
        <Text style={styles.title}>Messaggi 💬</Text>
      </View>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e91e63" />}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Nessun messaggio</Text>
            <Text style={styles.emptyText}>Hai un match? Inizia a chattare!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatCard}
            onPress={() => navigation.navigate('Chat', { matchId: item.matchId || item.id, user: item.otherUser })}
          >
            <View style={styles.avatarContainer}>
              <Text style={styles.avatar}>👤</Text>
              {item.unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread}</Text>
                </View>
              )}
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.otherUser?.displayName || 'Utente'}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage || 'Nessun messaggio'}
              </Text>
            </View>
            <Text style={styles.time}>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
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
  list: { padding: 16 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { fontSize: 36 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e91e63',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 17, fontWeight: '600', color: '#fff' },
  lastMessage: { fontSize: 13, color: '#888', marginTop: 2 },
  time: { fontSize: 12, color: '#555' },
  emptyView: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
});
