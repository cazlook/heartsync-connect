import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useSocket } from '../contexts/SocketContext';

export default function NotificationsScreen({ navigation }) {
  const { notifications, clearNotifications } = useSocket();

  const getIcon = (type) => {
    switch (type) {
      case 'match': return '💓';
      case 'message': return '💬';
      case 'reaction': return '❤️';
      default: return '🔔';
    }
  };

  const getTitle = (type) => {
    switch (type) {
      case 'match': return 'Nuovo Match!';
      case 'message': return 'Nuovo Messaggio';
      case 'reaction': return 'Qualcuno ha fatto battere il tuo cuore 👀';
      default: return 'Notifica';
    }
  };

  const handlePress = (item) => {
    if (item.type === 'match' || item.type === 'reaction') {
      navigation.navigate('PostMatch', { matchData: item.data });
    } else if (item.type === 'message') {
      navigation.navigate('Chat', { matchId: item.data?.matchId, user: item.data?.user });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifiche 🔔</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={clearNotifications}>
            <Text style={styles.clearText}>Cancella tutto</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Tutto in silenzio</Text>
            <Text style={styles.emptyText}>Nessuna notifica per ora</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.notifCard} onPress={() => handlePress(item)}>
            <Text style={styles.notifIcon}>{getIcon(item.type)}</Text>
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>{getTitle(item.type)}</Text>
              {item.data?.message && (
                <Text style={styles.notifBody} numberOfLines={2}>{item.data.message}</Text>
              )}
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  clearText: { fontSize: 13, color: '#e91e63' },
  list: { padding: 16 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  notifIcon: { fontSize: 32, marginRight: 16 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  notifBody: { fontSize: 13, color: '#888', marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e91e63',
    marginLeft: 8,
  },
  emptyView: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
});
