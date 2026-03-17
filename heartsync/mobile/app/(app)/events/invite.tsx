import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Image
} from "react-native";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/constants/api";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";

interface Match {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photos?: string[];
}

export default function InviteToEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { token } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMatches(data || []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const toggleSelect = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) { Alert.alert("Seleziona", "Seleziona almeno un match da invitare"); return; }
    setSending(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/events/${eventId}/invite`,
        { match_ids: Array.from(selected) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Inviti inviati!", `${data.sent} invit${data.sent === 1 ? "o inviato" : "i inviati"} con successo.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Errore", e?.response?.data?.detail || "Impossibile inviare inviti");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invita i tuoi match</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#f43f5e" /></View>
      ) : matches.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>💔</Text>
          <Text style={styles.emptyTitle}>Nessun match ancora</Text>
          <Text style={styles.emptyText}>Ottieni dei match per poterli invitare agli eventi</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.other_user_id);
            return (
              <TouchableOpacity style={[styles.matchRow, isSelected && styles.matchRowSelected]} onPress={() => toggleSelect(item.other_user_id)}>
                {item.other_user_photos?.[0] ? (
                  <Image source={{ uri: item.other_user_photos[0] }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]}>
                    <Text style={styles.photoInitial}>{item.other_user_name.charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.matchName}>{item.other_user_name}</Text>
                <View style={[styles.checkBox, isSelected && styles.checkBoxSelected]}>
                  {isSelected && <Check size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {matches.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.selectedCount}>{selected.size} selezionati</Text>
          <TouchableOpacity
            style={[styles.sendBtn, (sending || selected.size === 0) && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={sending || selected.size === 0}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Invia inviti</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1a1a2e" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#1a1a2e", marginBottom: 6 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  list: { padding: 16, gap: 10 },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 16, padding: 12, borderWidth: 2, borderColor: "transparent", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  matchRowSelected: { borderColor: "#f43f5e", backgroundColor: "#fff5f6" },
  photo: { width: 52, height: 52, borderRadius: 26 },
  photoPlaceholder: { backgroundColor: "#f43f5e", alignItems: "center", justifyContent: "center" },
  photoInitial: { fontSize: 22, fontWeight: "800", color: "#fff" },
  matchName: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  checkBox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkBoxSelected: { backgroundColor: "#f43f5e", borderColor: "#f43f5e" },
  footer: { padding: 20, paddingBottom: 36, flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6", backgroundColor: "#f9fafb" },
  selectedCount: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  sendBtn: { flex: 1, backgroundColor: "#f43f5e", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
