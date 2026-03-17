import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  ActivityIndicator, Pressable, Animated, PanResponder, Alert, Image, Easing
} from "react-native";
import * as Haptics from "expo-haptics";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useHeartRate } from "@/contexts/HeartRateContext";
import { API_URL } from "@/constants/api";
import { router } from "expo-router";

const { width: SW, height: SH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SW * 0.38;
const ROTATION_FACTOR = 12;

// Soglia reazione cardiaca: +15% sopra baseline per >3s → auto match
const BPM_SPIKE_THRESHOLD_PCT = 0.15;
const BPM_SPIKE_DURATION_MS = 3000;

interface Profile {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  city?: string;
  interests: string[];
  photos: string[];
  verified: boolean;
  premium: boolean;
}

// ─── BPM Wave Indicator ──────────────────────────────────────────────────────

function BpmWave({ bpm, baseline }: { bpm: number | null; baseline: number | null }) {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const deltaPct = bpm && baseline ? (bpm - baseline) / baseline : 0;
  const isElevated = deltaPct > BPM_SPIKE_THRESHOLD_PCT;
  const color = isElevated ? "#f43f5e" : bpm ? "#22c55e" : "#9ca3af";

  useEffect(() => {
    if (!bpm) return;
    const pulse = Animated.sequence([
      Animated.timing(pulseAnim, { toValue: isElevated ? 1.4 : 1.15, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: Math.max(200, 60000 / bpm - 200), useNativeDriver: true }),
    ]);
    const loop = Animated.loop(pulse);
    loop.start();
    return () => loop.stop();
  }, [bpm, isElevated]);

  if (!bpm) {
    return (
      <View style={bpmStyles.container}>
        <Text style={bpmStyles.noBpm}>Calibra battito per iniziare</Text>
      </View>
    );
  }

  return (
    <View style={bpmStyles.container}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Text style={[bpmStyles.heart, { color }]}>❤</Text>
      </Animated.View>
      <View style={bpmStyles.textBox}>
        <Text style={[bpmStyles.bpmValue, { color }]}>{bpm}</Text>
        <Text style={bpmStyles.bpmLabel}>BPM</Text>
      </View>
      {isElevated && (
        <View style={bpmStyles.spikeTag}>
          <Text style={bpmStyles.spikeTagText}>
            +{Math.round(deltaPct * 100)}% ↑
          </Text>
        </View>
      )}
    </View>
  );
}

const bpmStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 32, marginHorizontal: 40, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  heart: { fontSize: 28 },
  textBox: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  bpmValue: { fontSize: 26, fontWeight: "900" },
  bpmLabel: { fontSize: 12, fontWeight: "600", color: "#9ca3af" },
  noBpm: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  spikeTag: { backgroundColor: "#fef2f2", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  spikeTagText: { fontSize: 11, color: "#f43f5e", fontWeight: "700" },
});

// ─── Tap BPM Measurement ─────────────────────────────────────────────────────

interface TapBpmProps {
  baseline: number | null;
  onMeasured: (bpm: number, delta: number) => void;
}

function TapBpmBar({ baseline, onMeasured }: TapBpmProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tapTimestamps = useRef<number[]>([]);
  const [liveReading, setLiveReading] = useState<number | null>(null);

  const handleTap = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = Date.now();
    tapTimestamps.current.push(now);

    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const recent = tapTimestamps.current.filter((t) => now - t < 8000);
    tapTimestamps.current = recent;

    if (recent.length >= 4) {
      const intervals = recent.slice(-6).map((t, i, arr) =>
        i > 0 ? t - arr[i - 1] : null
      ).filter(Boolean) as number[];
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const measured = Math.max(40, Math.min(Math.round(60000 / avgInterval), 200));
      setLiveReading(measured);
      const delta = baseline ? measured - baseline : 0;
      onMeasured(measured, delta);
    }
  };

  return (
    <Pressable onPress={handleTap} style={tapStyles.container}>
      <Animated.Text style={[tapStyles.heart, { transform: [{ scale: pulseAnim }] }]}>❤️</Animated.Text>
      <Text style={tapStyles.label}>
        {liveReading ? `${liveReading} BPM` : "Tocca a ritmo"}
      </Text>
    </Pressable>
  );
}

const tapStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8 },
  heart: { fontSize: 22 },
  label: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
});

// ─── Swipe Card ───────────────────────────────────────────────────────────────

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (dir: "like" | "dislike") => void;
  isTop: boolean;
  stackIndex: number;
  baselineBpm: number | null;
  currentBpm: number | null;
  onBpmReaction: (profile_id: string, bpm_delta: number) => void;
}

function SwipeCard({ profile, onSwipe, isTop, stackIndex, baselineBpm, currentBpm, onBpmReaction }: SwipeCardProps) {
  const position = useRef(new Animated.ValueXY()).current;
  const viewStartRef = useRef(Date.now());
  const spikeStartRef = useRef<number | null>(null);
  const isSwipedOut = useRef(false);
  const autoFiredRef = useRef(false);

  useEffect(() => {
    if (!isTop) return;
    viewStartRef.current = Date.now();
    spikeStartRef.current = null;
    autoFiredRef.current = false;
    position.setValue({ x: 0, y: 0 });
  }, [isTop, profile.id]);

  // Monitoraggio continuo BPM per auto-match
  useEffect(() => {
    if (!isTop || !currentBpm || !baselineBpm || autoFiredRef.current) return;
    const deltaPct = (currentBpm - baselineBpm) / baselineBpm;

    if (deltaPct > BPM_SPIKE_THRESHOLD_PCT) {
      if (!spikeStartRef.current) {
        spikeStartRef.current = Date.now();
      } else if (Date.now() - spikeStartRef.current >= BPM_SPIKE_DURATION_MS) {
        autoFiredRef.current = true;
        onBpmReaction(profile.id, currentBpm - baselineBpm);
        triggerSwipe("like");
      }
    } else {
      spikeStartRef.current = null;
    }
  }, [currentBpm, isTop]);

  const scale = 1 - stackIndex * 0.04;
  const translateY = stackIndex * 10;

  const rotate = position.x.interpolate({
    inputRange: [-SW, 0, SW],
    outputRange: [`-${ROTATION_FACTOR}deg`, "0deg", `${ROTATION_FACTOR}deg`],
    extrapolate: "clamp",
  });

  const likeOpacity = position.x.interpolate({ inputRange: [30, 100], outputRange: [0, 1], extrapolate: "clamp" });
  const nopeOpacity = position.x.interpolate({ inputRange: [-100, -30], outputRange: [1, 0], extrapolate: "clamp" });

  const triggerSwipe = useCallback((dir: "like" | "dislike") => {
    if (isSwipedOut.current) return;
    isSwipedOut.current = true;

    const toX = dir === "like" ? SW * 1.5 : -SW * 1.5;
    Animated.timing(position, { toValue: { x: toX, y: 0 }, duration: 350, useNativeDriver: true })
      .start(() => onSwipe(dir));
  }, [onSwipe]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: () => isTop,
      onPanResponderMove: (_, g) => { position.setValue({ x: g.dx, y: g.dy }); },
      onPanResponderRelease: (_, g) => {
        const { dx, vx } = g;
        const isLike = dx > SWIPE_THRESHOLD || vx > 0.8;
        const isDislike = dx < -SWIPE_THRESHOLD || vx < -0.8;
        if (isLike) { triggerSwipe("like"); }
        else if (isDislike) { triggerSwipe("dislike"); }
        else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!isTop) {
    return (
      <Animated.View style={[styles.card, { transform: [{ scale }, { translateY }], zIndex: 10 - stackIndex }]}>
        {profile.photos?.[0] ? (
          <Image source={{ uri: profile.photos[0] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.placeholderBg]}>
            <Text style={styles.placeholderLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </Animated.View>
    );
  }

  const deltaPct = currentBpm && baselineBpm ? (currentBpm - baselineBpm) / baselineBpm : 0;
  const isElevated = deltaPct > BPM_SPIKE_THRESHOLD_PCT;

  return (
    <Animated.View
      style={[styles.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }], zIndex: 20 }]}
      {...panResponder.panHandlers}
    >
      {profile.photos?.[0] ? (
        <Image source={{ uri: profile.photos[0] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.placeholderBg]}>
          <Text style={styles.placeholderLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.overlay} />

      {/* Badge swipe */}
      <Animated.View style={[styles.badge, styles.likeBadge, { opacity: likeOpacity }]}>
        <Text style={styles.badgeLike}>SINTONIA</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.nopeBadge, { opacity: nopeOpacity }]}>
        <Text style={styles.badgeNope}>PASSA</Text>
      </Animated.View>

      {/* Pulsante automatico quando BPM elevato */}
      {isElevated && (
        <View style={styles.bpmAlertBadge}>
          <Text style={styles.bpmAlertText}>Il tuo cuore sta reagendo...</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name}>{profile.name}{profile.age ? `, ${profile.age}` : ""}</Text>
        {profile.city && <Text style={styles.city}>📍 {profile.city}</Text>}
        {profile.bio && <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>}
        {profile.interests?.length > 0 && (
          <View style={styles.tags}>
            {profile.interests.slice(0, 4).map((t) => (
              <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
            ))}
          </View>
        )}

        {/* Tap BPM (quando non c'è sorgente live) */}
        <View style={styles.tapRow}>
          <TapBpmBar baseline={baselineBpm} onMeasured={(bpm, delta) => {
            if (delta > 0) onBpmReaction(profile.id, delta);
          }} />
          <Text style={styles.swipeHint}>← Scorri per saltare</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Match Overlay ────────────────────────────────────────────────────────────

const MATCH_PHRASES = [
  "Il tuo cuore ha parlato. E anche il suo.",
  "Due battiti che si sono trovati.",
  "La scienza dice caso. Il cuore dice destino.",
  "Il ritmo era giusto. La persona anche.",
  "Qualcosa di raro è appena successo.",
  "I cuori si riconoscono tra mille.",
];

function MatchOverlay({ match, onClose, onChat }: { match: { name: string; id: string }, onClose: () => void, onChat: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const heartScale1 = useRef(new Animated.Value(0)).current;
  const heartScale2 = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(40)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const phrase = useRef(MATCH_PHRASES[Math.floor(Math.random() * MATCH_PHRASES.length)]).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(heartScale1, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.spring(heartScale2, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    const pulse = () => {
      Animated.sequence([
        Animated.timing(heartScale1, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(heartScale1, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) pulse(); });
    };
    const timer = setTimeout(pulse, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.matchOverlay, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.matchCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.matchHeartsRow}>
          <Animated.Text style={[styles.matchHeart, { transform: [{ scale: heartScale1 }, { rotate: "-15deg" }] }]}>❤️</Animated.Text>
          <Animated.Text style={[styles.matchHeartBig, { transform: [{ scale: heartScale2 }] }]}>💗</Animated.Text>
          <Animated.Text style={[styles.matchHeart, { transform: [{ scale: heartScale1 }, { rotate: "15deg" }] }]}>❤️</Animated.Text>
        </View>
        <Animated.View style={{ transform: [{ translateY: titleSlide }], opacity: titleOpacity }}>
          <Text style={styles.matchTitle}>È un Match!</Text>
          <Text style={styles.matchName}>{match.name} ha sentito lo stesso.</Text>
          <Text style={styles.matchPhrase}>"{phrase}"</Text>
        </Animated.View>
        <View style={styles.matchDivider} />
        <View style={styles.matchButtons}>
          <TouchableOpacity style={styles.matchBtnSecondary} onPress={onClose}>
            <Text style={styles.matchBtnSecondaryText}>Continua a scoprire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.matchBtnPrimary} onPress={onChat}>
            <Text style={styles.matchBtnPrimaryText}>💬  Scrivi ora</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Discovery Screen ─────────────────────────────────────────────────────────

export default function DiscoveryScreen() {
  const { token } = useAuth();
  const { baselineBpm, currentBpm, addProfileReaction, calculateMatchBonus, setCurrentBpm } = useHeartRate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [match, setMatch] = useState<{ name: string; id: string } | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/discovery/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfiles(data);
      setIdx(0);
    } catch {
      Alert.alert("Errore", "Impossibile caricare i profili");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleSwipe = useCallback(async (dir: "like" | "dislike") => {
    if (!profiles[idx] || swiping) return;
    const profile = profiles[idx];
    setSwiping(true);
    const cardiacBonus = calculateMatchBonus(profile.id);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/discovery/swipe`,
        { profile_id: profile.id, direction: dir, cardiac_bonus: cardiacBonus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.match) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMatch({ name: data.other_name || profile.name, id: data.match_id });
      }
    } catch {}
    setTimeout(() => { setSwiping(false); setIdx((i) => i + 1); }, 300);
  }, [profiles, idx, swiping, token, calculateMatchBonus]);

  const handleBpmReaction = useCallback((profile_id: string, bpm_delta: number) => {
    addProfileReaction(profile_id, bpm_delta);
  }, [addProfileReaction]);

  const current = profiles[idx];
  const hasMore = idx < profiles.length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scopri</Text>
        {!baselineBpm && (
          <TouchableOpacity onPress={() => router.push("/heartrate-setup")} style={styles.setupBtn}>
            <Text style={styles.setupBtnText}>Calibra battito</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f43f5e" />
        </View>
      )}

      {!loading && !hasMore && (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>💕</Text>
          <Text style={styles.emptyTitle}>Hai visto tutti!</Text>
          <Text style={styles.emptyText}>Torna più tardi per nuovi profili</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={fetchProfiles}>
            <Text style={styles.reloadBtnText}>Ricarica</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && hasMore && current && (
        <View style={styles.cardArea}>
          <View style={styles.cardStack}>
            {profiles[idx + 2] && (
              <SwipeCard key={profiles[idx + 2].id} profile={profiles[idx + 2]} onSwipe={() => {}}
                isTop={false} stackIndex={2} baselineBpm={baselineBpm} currentBpm={null} onBpmReaction={handleBpmReaction} />
            )}
            {profiles[idx + 1] && (
              <SwipeCard key={profiles[idx + 1].id} profile={profiles[idx + 1]} onSwipe={() => {}}
                isTop={false} stackIndex={1} baselineBpm={baselineBpm} currentBpm={null} onBpmReaction={handleBpmReaction} />
            )}
            <SwipeCard key={current.id} profile={current} onSwipe={handleSwipe}
              isTop={true} stackIndex={0} baselineBpm={baselineBpm} currentBpm={currentBpm} onBpmReaction={handleBpmReaction} />
          </View>

          {/* BPM Monitor — invece dei 3 bottoni */}
          <View style={styles.bpmMonitorRow}>
            <BpmWave bpm={currentBpm} baseline={baselineBpm} />
          </View>
        </View>
      )}

      {match && (
        <MatchOverlay
          match={match}
          onClose={() => setMatch(null)}
          onChat={() => { setMatch(null); router.push(`/(app)/chat/${match.id}`); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#1a1a2e" },
  setupBtn: { backgroundColor: "#fef2f2", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  setupBtnText: { fontSize: 12, fontWeight: "600", color: "#f43f5e" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a2e", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 24 },
  reloadBtn: { backgroundColor: "#f43f5e", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  reloadBtnText: { color: "#fff", fontWeight: "700" },
  cardArea: { flex: 1, paddingBottom: 16 },
  cardStack: { flex: 1, position: "relative", marginHorizontal: 16, marginTop: 4 },
  card: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: "hidden", backgroundColor: "#e5e7eb" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  placeholderBg: { backgroundColor: "#f43f5e", alignItems: "center", justifyContent: "center" },
  placeholderLetter: { fontSize: 80, fontWeight: "900", color: "#fff", opacity: 0.8 },
  badge: { position: "absolute", top: 40, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 4 },
  likeBadge: { left: 20, borderColor: "#f43f5e", transform: [{ rotate: "-15deg" }] },
  nopeBadge: { right: 20, borderColor: "#6b7280", transform: [{ rotate: "15deg" }] },
  badgeLike: { fontSize: 20, fontWeight: "900", color: "#f43f5e" },
  badgeNope: { fontSize: 20, fontWeight: "900", color: "#6b7280" },
  bpmAlertBadge: { position: "absolute", top: 14, left: 0, right: 0, alignItems: "center" },
  bpmAlertText: { backgroundColor: "rgba(244,63,94,0.85)", color: "#fff", fontSize: 13, fontWeight: "700", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  info: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "rgba(0,0,0,0.5)" },
  name: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  city: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 6 },
  bio: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 8, lineHeight: 18 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: "#fff", fontWeight: "600" },
  tapRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  swipeHint: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  bpmMonitorRow: { paddingBottom: 20, paddingTop: 8 },
  matchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,0,30,0.85)", alignItems: "center", justifyContent: "center", zIndex: 100 },
  matchCard: { backgroundColor: "#fff", borderRadius: 32, padding: 32, marginHorizontal: 20, alignItems: "center", shadowColor: "#f43f5e", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  matchHeartsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 8 },
  matchHeart: { fontSize: 36 },
  matchHeartBig: { fontSize: 56 },
  matchTitle: { fontSize: 32, fontWeight: "900", color: "#f43f5e", textAlign: "center", marginBottom: 8 },
  matchName: { fontSize: 17, fontWeight: "600", color: "#1a1a2e", textAlign: "center", marginBottom: 12 },
  matchPhrase: { fontSize: 14, color: "#6b7280", textAlign: "center", fontStyle: "italic", lineHeight: 22, paddingHorizontal: 8, marginBottom: 4 },
  matchDivider: { width: "80%", height: 1, backgroundColor: "#f3f4f6", marginVertical: 20 },
  matchButtons: { flexDirection: "column", gap: 10, width: "100%" },
  matchBtnSecondary: { borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  matchBtnSecondaryText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
  matchBtnPrimary: { backgroundColor: "#f43f5e", borderRadius: 16, paddingVertical: 16, alignItems: "center", shadowColor: "#f43f5e", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  matchBtnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
