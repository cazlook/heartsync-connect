import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Platform, Alert, Switch
} from "react-native";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/constants/api";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

const EVENT_TYPES = [
  { key: "social", label: "Social", emoji: "🥂" },
  { key: "sport", label: "Sport", emoji: "⚽" },
  { key: "cena", label: "Cena", emoji: "🍝" },
  { key: "trekking", label: "Trekking", emoji: "🏔️" },
  { key: "concerto", label: "Concerto", emoji: "🎵" },
  { key: "arte", label: "Arte", emoji: "🎨" },
  { key: "party", label: "Party", emoji: "🎉" },
  { key: "cinema", label: "Cinema", emoji: "🎬" },
];

function addHours(h: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateEventScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [eventType, setEventType] = useState("social");
  const [startTime, setStartTime] = useState(toLocalISOString(addHours(2)));
  const [endTime, setEndTime] = useState(toLocalISOString(addHours(5)));
  const [hasMaxAttendees, setHasMaxAttendees] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState("20");
  const [lat, setLat] = useState("45.4642");
  const [lon, setLon] = useState("9.1900");

  const handleCreate = useCallback(async () => {
    if (!title.trim()) { Alert.alert("Errore", "Inserisci un titolo"); return; }
    if (!address.trim()) { Alert.alert("Errore", "Inserisci un indirizzo"); return; }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime())) { Alert.alert("Errore", "Data inizio non valida"); return; }
    if (endDate <= startDate) { Alert.alert("Errore", "La fine deve essere dopo l'inizio"); return; }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim() || undefined,
        event_type: eventType,
        latitude: parseFloat(lat) || 45.4642,
        longitude: parseFloat(lon) || 9.1900,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        max_attendees: hasMaxAttendees ? parseInt(maxAttendees) || 20 : undefined,
      };
      const { data } = await axios.post(`${API_URL}/api/events`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert("Evento creato!", `"${data.title}" è ora visibile agli altri utenti.`, [
        { text: "Vedi evento", onPress: () => router.replace(`/(app)/events/${data.id}`) },
        { text: "Torna agli eventi", onPress: () => router.replace("/(app)/events") },
      ]);
    } catch (e: any) {
      Alert.alert("Errore", e?.response?.data?.detail || "Impossibile creare l'evento");
    } finally {
      setLoading(false);
    }
  }, [title, description, address, city, eventType, startTime, endTime, hasMaxAttendees, maxAttendees, lat, lon, token]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuovo evento</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Tipo evento */}
        <Text style={styles.label}>Tipo di evento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
          {EVENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeChip, eventType === t.key && styles.typeChipActive]}
              onPress={() => setEventType(t.key)}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeText, eventType === t.key && styles.typeTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Titolo */}
        <Text style={styles.label}>Titolo *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Es. Aperitivo in centro"
          placeholderTextColor="#9ca3af"
          maxLength={80}
        />

        {/* Descrizione */}
        <Text style={styles.label}>Descrizione</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder="Raccontaci dell'evento..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        {/* Indirizzo */}
        <Text style={styles.label}>Indirizzo *</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Via Roma 1, Milano"
          placeholderTextColor="#9ca3af"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Città</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Milano" placeholderTextColor="#9ca3af" />
          </View>
        </View>

        {/* Coordinate (semplificate) */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Latitudine</Text>
            <TextInput style={styles.input} value={lat} onChangeText={setLat} placeholder="45.4642" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Longitudine</Text>
            <TextInput style={styles.input} value={lon} onChangeText={setLon} placeholder="9.1900" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>
        </View>

        {/* Date */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Inizio</Text>
            <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor="#9ca3af" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fine</Text>
            <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor="#9ca3af" />
          </View>
        </View>

        {/* Max partecipanti */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Limite partecipanti</Text>
          <Switch value={hasMaxAttendees} onValueChange={setHasMaxAttendees} trackColor={{ true: "#f43f5e" }} />
        </View>
        {hasMaxAttendees && (
          <TextInput
            style={[styles.input, { marginTop: 4 }]}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            placeholder="20"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        )}

        <TouchableOpacity style={[styles.createBtn, loading && { opacity: 0.6 }]} onPress={handleCreate} disabled={loading}>
          <Text style={styles.createBtnText}>{loading ? "Creazione..." : "Crea evento 🎉"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  content: { padding: 20, paddingBottom: 40, gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1a1a2e", borderWidth: 1.5, borderColor: "#e5e7eb" },
  inputMulti: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  typeRow: { flexDirection: "row", marginBottom: 4 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", marginRight: 8 },
  typeChipActive: { backgroundColor: "#f43f5e", borderColor: "#f43f5e" },
  typeEmoji: { fontSize: 16 },
  typeText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  typeTextActive: { color: "#fff" },
  createBtn: { backgroundColor: "#f43f5e", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 20, shadowColor: "#f43f5e", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
