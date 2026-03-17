import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useHeartRate } from "@/contexts/HeartRateContext";
import { API_URL } from "@/constants/api";

const INTERESTS = [
  "Musica", "Sport", "Arte", "Viaggi", "Cucina", "Lettura",
  "Cinema", "Yoga", "Gaming", "Natura", "Fotografia", "Danza",
  "Tecnologia", "Moda", "Animali",
];

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth();
  const { baselineBpm } = useHeartRate();
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permesso richiesto", "Serve accesso alla libreria foto");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setUploading(true);
    try {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const { data } = await axios.post(
        `${API_URL}/api/profile/photos`,
        { photo: base64 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser(data);
    } catch {
      Alert.alert("Errore", "Impossibile caricare la foto");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Esci", "Vuoi davvero uscire?", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profilo</Text>

      <View style={styles.photoSection}>
        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading} style={styles.photoContainer}>
          {user.photos?.[0] ? (
            <Image source={{ uri: user.photos[0] }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.photoPlaceholderText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.photoEditBadge}>
            {uploading ? <ActivityIndicator size="small" color="#f43f5e" /> : <Text style={styles.photoEditIcon}>📷</Text>}
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>Tocca per cambiare foto</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informazioni</Text>
        <Row label="Nome" value={user.name} />
        <Row label="Email" value={user.email} />
        {user.age && <Row label="Età" value={`${user.age} anni`} />}
        {user.city && <Row label="Città" value={user.city} />}
      </View>

      {baselineBpm && (
        <View style={[styles.card, styles.heartCard]}>
          <Text style={styles.cardTitle}>❤️ Battito Cardiaco</Text>
          <View style={styles.bpmDisplay}>
            <Text style={styles.bpmNumber}>{baselineBpm}</Text>
            <Text style={styles.bpmUnit}>BPM a riposo</Text>
          </View>
          <Text style={styles.heartDesc}>
            HeartSync usa questo valore per misurare la tua reazione ai profili.
            Più alto è il delta, più forte è l'attrazione!
          </Text>
          <TouchableOpacity style={styles.recalibrateBtn} onPress={() => router.push("/heartrate-setup")}>
            <Text style={styles.recalibrateBtnText}>Ricalibra</Text>
          </TouchableOpacity>
        </View>
      )}

      {!baselineBpm && (
        <TouchableOpacity style={styles.setupCard} onPress={() => router.push("/heartrate-setup")}>
          <Text style={styles.setupCardEmoji}>❤️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.setupCardTitle}>Misura il tuo battito</Text>
            <Text style={styles.setupCardSub}>Sblocca match basati sul battito cardiaco</Text>
          </View>
          <Text style={styles.setupCardArrow}>→</Text>
        </TouchableOpacity>
      )}

      {user.interests?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Interessi</Text>
          <View style={styles.tags}>
            {user.interests.map((i) => (
              <View key={i} style={styles.tag}><Text style={styles.tagText}>{i}</Text></View>
            ))}
          </View>
        </View>
      )}

      {user.bio && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bio</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Esci dall'account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  label: { fontSize: 14, color: "#6b7280" },
  value: { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  content: { paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "900", color: "#1a1a2e", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  photoSection: { alignItems: "center", marginBottom: 24 },
  photoContainer: { position: "relative" },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { backgroundColor: "#f43f5e", alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { fontSize: 40, fontWeight: "900", color: "#fff" },
  photoEditBadge: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#fff", borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  photoEditIcon: { fontSize: 16 },
  photoHint: { marginTop: 8, fontSize: 12, color: "#9ca3af" },
  card: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  heartCard: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecdd3" },
  bpmDisplay: { flexDirection: "row", alignItems: "baseline", gap: 6, marginVertical: 8 },
  bpmNumber: { fontSize: 48, fontWeight: "900", color: "#f43f5e" },
  bpmUnit: { fontSize: 14, color: "#f43f5e", fontWeight: "600" },
  heartDesc: { fontSize: 13, color: "#6b7280", lineHeight: 18, marginBottom: 12 },
  recalibrateBtn: { alignSelf: "flex-start", backgroundColor: "#f43f5e", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  recalibrateBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  setupCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecdd3", borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, gap: 12 },
  setupCardEmoji: { fontSize: 28 },
  setupCardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  setupCardSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  setupCardArrow: { fontSize: 18, color: "#f43f5e" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tag: { backgroundColor: "#f3f4f6", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  bioText: { fontSize: 14, color: "#374151", lineHeight: 22 },
  logoutBtn: { marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: "#fecdd3", alignItems: "center" },
  logoutText: { color: "#f43f5e", fontWeight: "700", fontSize: 15 },
});
