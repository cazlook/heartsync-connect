import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';

export default function RevealScreen({ navigation }) {
  // Animazione pulse: cuore che pulsa
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Loop pulse continuo
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* Cerchi concentrici pulsanti */}
        <View style={styles.circlesContainer}>
          <Animated.View
            style={[
              styles.outerCircle,
              { opacity: opacityAnim, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.middleCircle,
              { opacity: opacityAnim, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Animated.Text
            style={[
              styles.heart,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            💞
          </Animated.Text>
        </View>

        <Text style={styles.title}>Qualcuno ha fatto{"\n"}battere il tuo cuore 👀</Text>
        <Text style={styles.subtitle}>
          Il tuo battito ha accelerato mentre eri vicino a qualcuno.
          Potrebbe essere la connessione che stavi cercando...
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Matches')}
          >
            <Text style={styles.btnPrimaryText}>💕 Scopri chi è</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnSecondaryText}>Dopo, forse...</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  circlesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  outerCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  middleCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(244, 63, 94, 0.22)',
  },
  heart: {
    fontSize: 80,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  buttons: {
    width: '100%',
    gap: 14,
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
