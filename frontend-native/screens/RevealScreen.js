import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useHeartRate } from '../contexts/HeartRateContext';
import { API_URL } from '../constants/api';

export default function RevealScreen({ navigation }) {
  const { token, user } = useAuth();
  const { startMonitoring, stopMonitoring, heartRate, currentZScore, reactionActive, setTargetUserId } = useHeartRate();
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();

    loadNearbyUsers();
    return () => stopMonitoring();
  }, []);

  const loadNearbyUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/nearby`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNearbyUsers(res.data.users || []);
    } catch (e) {
      console.error('Failed to load nearby users:', e);
    }
  };

  const startObserving = (user) => {
    setActiveUser(user);
    setTargetUserId(user.id);
    startMonitoring(user.id);
  };

  const stopObserving = () => {
    setActiveUser(null);
    setTargetUserId(null);
    stopMonitoring();
  };

  const zColor = currentZScore >= 1.5 ? '#e91e63' : currentZScore >= 0.8 ? '#ff9800' : '#4caf50';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Intorno a te</Text>
        <Text style={styles.subtitle}>Il tuo cuore ti guida 💗</Text>
      </View>

      {activeUser ? (
        <View style={styles.monitoringView}>
          <Text style={styles.monitoringLabel}>Osservando</Text>
          <Text style={styles.monitoringName}>{activeUser.displayName}</Text>
          <Animated.Text
            style={[
              styles.heartMonitor,
              { transform: [{ scale: pulseAnim }], opacity: opacityAnim },
            ]}
          >
            ❤️
          </Animated.Text>
          <Text style={[styles.bpmText, { color: zColor }]}>
            {heartRate ? `${Math.round(heartRate)} BPM` : '...'}
          </Text>
          <Text style={styles.zScoreText}>Z-score: {currentZScore.toFixed(2)}</Text>
          {reactionActive && (
            <Text style={styles.reactionBadge}>🔥 Reazione cardiaca rilevata!</Text>
          )}
          <TouchableOpacity style={styles.stopButton} onPress={stopObserving}>
            <Text style={styles.stopButtonText}>Smetti di osservare</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={nearbyUsers}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>Nessuno nelle vicinanze</Text>
              <TouchableOpacity onPress={loadNearbyUsers}>
                <Text style={styles.refreshText}>Aggiorna</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userCard}
              onPress={() => startObserving(item)}
            >
              <Text style={styles.userAvatar}>👤</Text>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName}</Text>
                <Text style={styles.userHint}>Tocca per osservare</Text>
              </View>
              <Text style={styles.userArrow}>❯</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  monitoringView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  monitoringLabel: { fontSize: 14, color: '#888', marginBottom: 4 },
  monitoringName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  heartMonitor: { fontSize: 96, marginBottom: 16 },
  bpmText: { fontSize: 48, fontWeight: 'bold', marginBottom: 8 },
  zScoreText: { fontSize: 14, color: '#888', marginBottom: 16 },
  reactionBadge: { fontSize: 18, color: '#e91e63', fontWeight: 'bold', marginBottom: 24 },
  stopButton: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  stopButtonText: { color: '#888', fontSize: 14 },
  list: { padding: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  userAvatar: { fontSize: 40, marginRight: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '600', color: '#fff' },
  userHint: { fontSize: 13, color: '#888', marginTop: 2 },
  userArrow: { color: '#555', fontSize: 18 },
  emptyView: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#888', marginBottom: 16 },
  refreshText: { color: '#e91e63', fontSize: 14 },
});
