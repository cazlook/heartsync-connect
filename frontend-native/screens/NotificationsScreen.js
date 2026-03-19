import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function NotificationsScreen({ navigation }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(data);
    } catch {
      // Notifiche demo
      setNotifications([
        { id: '1', type: 'match', title: 'Nuovo Match!', body: 'Il tuo cuore ha trovato sintonia', time: '2 min fa', read: false },
        { id: '2', type: 'message', title: 'Nuovo messaggio', body: 'Hai un messaggio da leggere', time: '1 ora fa', read: false },
        { id: '3', type: 'reveal', title: 'Qualcuno ti guarda 👀', body: 'Scopri chi ha fatto battere il tuo cuore', time: '3 ore fa', read: true },
      ]);
    }
    setLoading(false);
  };

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    try {
      await axios.patch(`${API_URL}/api/users/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const getEmoji = (type) => {
    switch (type) {
      case 'match': return '💕';
      case 'message': return '💬';
      case 'reveal': return '👀';
      default: return '🔔';
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => markRead(item.id)}
    >
      <Text style={styles.emoji}>{getEmoji(item.type)}</Text>
      <View style={styles.content}>
        <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      {!item.read && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifiche</Text>
      </View>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#f43f5e" /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.empty}>🔔 Nessuna notifica</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  back: { fontSize: 22, color: '#f43f5e', marginRight: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontSize: 16, color: '#9ca3af' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardUnread: { backgroundColor: '#fff5f6', borderLeftWidth: 3, borderLeftColor: '#f43f5e' },
  emoji: { fontSize: 28, marginRight: 14 },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', marginBottom: 2 },
  titleUnread: { fontWeight: '800', color: '#f43f5e' },
  body: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  time: { fontSize: 11, color: '#9ca3af' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f43f5e', marginLeft: 8 },
});
