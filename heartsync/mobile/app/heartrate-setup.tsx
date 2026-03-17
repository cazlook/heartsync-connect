import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, Pressable, Animated,
  StyleSheet, Dimensions, Platform
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useHeartRate } from "@/contexts/HeartRateContext";

const { width } = Dimensions.get("window");
const TARGET_TAPS = 12;
const MEASURE_SECONDS = 15;

export default function HeartRateSetupScreen() {
  const { setBaseline } = useHeartRate();
  const [phase, setPhase] = useState<"intro" | "measuring" | "done">("intro");
  const [tapCount, setTapCount] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MEASURE_SECONDS);
  const tapTimestamps = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  };

  const startMeasuring = () => {
    setPhase("measuring");
    tapTimestamps.current = [];
    setTapCount(0);
    setSecondsLeft(MEASURE_SECONDS);
    startPulse();

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          finalize();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleTap = useCallback(async () => {
    if (phase !== "measuring") return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = Date.now();
    tapTimestamps.current.push(now);
    setTapCount((c) => c + 1);

    if (tapTimestamps.current.length >= TARGET_TAPS) {
      clearInterval(timerRef.current!);
      finalize();
    }
  }, [phase]);

  const finalize = () => {
    const timestamps = tapTimestamps.current;
    let calculatedBpm = 70;

    if (timestamps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      calculatedBpm = Math.round(60000 / avgInterval);
      calculatedBpm = Math.max(45, Math.min(calculatedBpm, 180));
    }

    setBpm(calculatedBpm);
    setPhase("done");
    pulseAnim.stopAnimation();
  };

  const handleSave = async () => {
    if (bpm) await setBaseline(bpm);
    router.replace("/(app)");
  };

  if (phase === "intro") {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.heartIcon}>❤️</Text>
        </View>
        <Text style={styles.title}>Misura il tuo battito</Text>
        <Text style={styles.subtitle}>
          Per trovare il tuo match perfetto, SyncLove misura le tue reazioni cardiache.{"\n\n"}
          Prima di tutto, abbiamo bisogno del tuo <Text style={styles.bold}>battito a riposo</Text>.
        </Text>
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>Come funziona</Text>
          <Text style={styles.instruction}>1. Siediti e rilassati per qualche secondo</Text>
          <Text style={styles.instruction}>2. Premi il grande cuore rosso in ritmo con il tuo battito</Text>
          <Text style={styles.instruction}>3. Continua per 12 battiti o 15 secondi</Text>
        </View>
        <TouchableOpacity style={styles.startBtn} onPress={startMeasuring}>
          <Text style={styles.startBtnText}>Inizia misurazione</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/(app)")} style={styles.skipBtn}>
          <Text style={styles.skipText}>Salta per ora</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === "measuring") {
    return (
      <View style={styles.container}>
        <Text style={styles.timerText}>{secondsLeft}s</Text>
        <Text style={styles.tapPrompt}>Tocca in ritmo con il tuo cuore</Text>
        <Text style={styles.tapCount}>{tapCount} / {TARGET_TAPS} battiti</Text>

        <Pressable onPress={handleTap}>
          <Animated.View style={[styles.heartButton, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.heartButtonEmoji}>❤️</Text>
          </Animated.View>
        </Pressable>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(tapCount / TARGET_TAPS) * 100}%` }]} />
        </View>
        <Text style={styles.hint}>Rilassati e tocca naturalmente</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.doneIcon}>✅</Text>
      <Text style={styles.title}>Misurazione completata!</Text>
      <View style={styles.bpmCard}>
        <Text style={styles.bpmLabel}>Il tuo battito a riposo</Text>
        <Text style={styles.bpmValue}>{bpm}</Text>
        <Text style={styles.bpmUnit}>BPM</Text>
        <Text style={styles.bpmHint}>
          {bpm && bpm < 60 ? "Ottimo! Battito da atleta 🏃" :
           bpm && bpm < 80 ? "Perfetto! Battito sano ✅" :
           bpm && bpm < 100 ? "Nella norma 👍" : "Un po' elevato, prova a rilassarti 😌"}
        </Text>
      </View>
      <Text style={styles.explanation}>
        Quando scorri i profili, SyncLove misurerà le variazioni rispetto a questo valore.
        Un aumento del battito = attrazione reale. 💕
      </Text>
      <TouchableOpacity style={styles.startBtn} onPress={handleSave}>
        <Text style={styles.startBtnText}>Inizia a trovare match</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={startMeasuring} style={styles.skipBtn}>
        <Text style={styles.skipText}>Misura di nuovo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff8f8", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  iconContainer: { marginBottom: 16 },
  heartIcon: { fontSize: 64 },
  title: { fontSize: 26, fontWeight: "800", color: "#1a1a2e", textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 15, color: "#6b7280", textAlign: "center", lineHeight: 24, marginBottom: 24 },
  bold: { fontWeight: "700", color: "#f43f5e" },
  instructionBox: { backgroundColor: "#fef2f2", borderRadius: 16, padding: 20, width: "100%", marginBottom: 32 },
  instructionTitle: { fontSize: 14, fontWeight: "700", color: "#f43f5e", marginBottom: 10 },
  instruction: { fontSize: 14, color: "#374151", marginBottom: 6, lineHeight: 20 },
  startBtn: { backgroundColor: "#f43f5e", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48, width: "100%", alignItems: "center", shadowColor: "#f43f5e", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  skipBtn: { marginTop: 16, padding: 8 },
  skipText: { color: "#9ca3af", fontSize: 14 },
  timerText: { fontSize: 56, fontWeight: "900", color: "#f43f5e", marginBottom: 8 },
  tapPrompt: { fontSize: 20, fontWeight: "700", color: "#1a1a2e", marginBottom: 4 },
  tapCount: { fontSize: 16, color: "#6b7280", marginBottom: 40 },
  heartButton: { width: 180, height: 180, borderRadius: 90, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#f43f5e", shadowColor: "#f43f5e", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  heartButtonEmoji: { fontSize: 80 },
  progressBar: { width: "80%", height: 8, backgroundColor: "#fce7f3", borderRadius: 4, marginTop: 40, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#f43f5e", borderRadius: 4 },
  hint: { marginTop: 12, fontSize: 13, color: "#9ca3af" },
  doneIcon: { fontSize: 56, marginBottom: 16 },
  bpmCard: { backgroundColor: "#fef2f2", borderRadius: 24, padding: 32, alignItems: "center", width: "100%", marginBottom: 20 },
  bpmLabel: { fontSize: 14, color: "#9ca3af", marginBottom: 8 },
  bpmValue: { fontSize: 80, fontWeight: "900", color: "#f43f5e", lineHeight: 88 },
  bpmUnit: { fontSize: 18, color: "#f43f5e", fontWeight: "600", marginBottom: 8 },
  bpmHint: { fontSize: 14, color: "#374151", textAlign: "center" },
  explanation: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 28 },
});
