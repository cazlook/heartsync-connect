import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';

export default function PostMatchScreen({ navigation, route }) {
  const { matchData } = route.params || {};
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const cardiacScore = matchData?.cardiacScore || 0;
  const matchedUser = matchData?.matchedUser || { displayName: 'Qualcuno speciale' };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <Text style={styles.eyesEmoji}>👀</Text>
        <Text style={styles.title}>Qualcuno ha fatto{`\n`}battere il tuo cuore</Text>
        <Text style={styles.nameReveal}>{matchedUser.displayName}</Text>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Sintonia cardiaca</Text>
          <Text style={styles.scoreValue}>{Math.round(cardiacScore)}%</Text>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreBarFill, { width: `${Math.min(cardiacScore, 100)}%` }]} />
          </View>
        </View>

        <Text style={styles.description}>
          I vostri battiti cardiaci si sono sincronizzati reciprocamente.
          Questo è un match autentico, non c'è stato nessun swipe.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => navigation.navigate('Chat', { matchId: matchData?.id, user: matchedUser })}
          >
            <Text style={styles.chatButtonText}>💬 Scrivi un messaggio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.laterButton}
            onPress={() => navigation.navigate('Main')}
          >
            <Text style={styles.laterButtonText}>Dopo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  eyesEmoji: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', lineHeight: 34, marginBottom: 12 },
  nameReveal: { fontSize: 32, fontWeight: 'bold', color: '#e91e63', marginBottom: 32 },
  scoreCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  scoreLabel: { fontSize: 14, color: '#888', marginBottom: 8 },
  scoreValue: { fontSize: 48, fontWeight: 'bold', color: '#e91e63', marginBottom: 12 },
  scoreBar: { height: 8, backgroundColor: '#2a2a4e', borderRadius: 4 },
  scoreBarFill: { height: 8, backgroundColor: '#e91e63', borderRadius: 4 },
  description: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  actions: { width: '100%', gap: 12 },
  chatButton: {
    backgroundColor: '#e91e63',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  chatButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  laterButton: { padding: 16, alignItems: 'center' },
  laterButtonText: { color: '#888', fontSize: 14 },
});
