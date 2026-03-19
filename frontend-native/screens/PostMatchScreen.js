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
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleStartChat = () => {
    navigation.navigate('Chat', { matchId: matchData?._id, matchUser: matchData?.user });
  };

  const handleViewMatches = () => {
    navigation.navigate('MainTabs', { screen: 'Matches' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Heart icon */}
        <View style={styles.heartContainer}>
          <Text style={styles.heartEmoji}>❤️</Text>
        </View>

        <Text style={styles.title}>It's a HeartSync!</Text>
        <Text style={styles.subtitle}>
          Your hearts beat in rhythm with{' '}
          <Text style={styles.nameHighlight}>
            {matchData?.user?.name || 'someone special'}
          </Text>
          .
        </Text>

        {matchData?.syncScore != null && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Heart Sync Score</Text>
            <Text style={styles.scoreValue}>{matchData.syncScore}%</Text>
          </View>
        )}

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleStartChat}>
            <Text style={styles.btnPrimaryText}>Start Chatting 💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleViewMatches}>
            <Text style={styles.btnSecondaryText}>View All Matches</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  heartContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(244,63,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  heartEmoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  nameHighlight: {
    color: '#f43f5e',
    fontWeight: '700',
  },
  scoreContainer: {
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.2)',
  },
  scoreLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#f43f5e',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#f43f5e',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#f43f5e',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  btnSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
});
