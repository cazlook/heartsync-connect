import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Pressable
} from "react-native";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/constants/api";
import { router } from "expo-router";
import { Calendar, MapPin, Users, Plus, ChevronRight } from "lucide-react-native";

const EVENT_TYPE_LABELS: Record<string, string> = {
  social: "Social", sport: "Sport", cena: "Cena", trekking: "Trekking",
  concerto: "Concerto", arte: "Arte", party: "Party", cinema: "Cinema",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  social: "#f43f5e", sport: "#22c55e", cena: "#f59e0b", trekking: "#10b981",
  concerto: "#8b5cf6", arte: "#ec4899", party: "#f97316", cinema: "#3b82f6",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Event {
  id: string;
  title: string;
  description: string;
  address: string;
  event_type: string;
  start_time: string;
  attendees_count: number;
  max_attendees?: number;
  distance_km?: number;
  is_attending: boolean;
  location?: { city?: string };
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const color = EVENT_TYPE_COLORS[event.event_type] || "#f43f5e";
  const isFull = event.max_attendees != null && event.attendees_count >= event.max_attendees;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.typeBar, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: color + "20" }]}>
            <Text style={[styles.typeLabel, { color }]}>{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</Text>
          </View>
          {event.is_attending && (
            <View style={styles.attendingBadge}>
              <Text style={styles.attendingText}>Partecipo</Text>
            </View>
          )}
          {isFull && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullText}>Completo</Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Calendar size={13} color="#9ca3af" />
          <Text style={styles.metaText}>{formatDate(event.start_time)}</Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={13} color="#9ca3af" />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.address}{event.distance_km != null ? `  ·  ${event.distance_km} km` : ""}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Users size={13} color="#9ca3af" />
          <Text style={styles.metaText}>
            {event.attendees_count}{event.max_attendees ? `/${event.max_attendees}` : ""} partecipanti
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color="#d1d5db" style={styles.chevron} />
    </Pressable>
  );
}

const FILTERS = [
  { key: "", label: "Tutti" },
  { key: "social", label: "Social" },
  { key: "sport", label: "Sport" },
  { key: "cena", label: "Cena" },
  { key: "concerto", label: "Concerto" },
  { key: "party", label: "Party" },
];

export default function EventsScreen() {
  const { token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"all" | "my">("all");

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const url = tab === "my"
        ? `${API_URL}/api/events/my`
        : `${API_URL}/api/events${filter ? `?event_type=${filter}` : ""}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tab === "my") {
        const all = [...(data.created || []), ...(data.attending || [])];
        setEvents(all);
      } else {
        setEvents(data.events || []);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter, tab]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Eventi</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/(app)/events/create")}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab: Tutti / I miei */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === "all" && styles.tabBtnActive]} onPress={() => setTab("all")}>
          <Text style={[styles.tabText, tab === "all" && styles.tabTextActive]}>Tutti</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "my" && styles.tabBtnActive]} onPress={() => setTab("my")}>
          <Text style={[styles.tabText, tab === "my" && styles.tabTextActive]}>I miei</Text>
        </Pressable>
      </View>

      {/* Filtri categoria */}
      {tab === "all" && (
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#f43f5e" /></View>
      ) : events.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>Nessun evento</Text>
          <Text style={styles.emptyText}>Crea il primo evento o aspetta che ne arrivino nuovi</Text>
          <TouchableOpacity style={styles.createEmptyBtn} onPress={() => router.push("/(app)/events/create")}>
            <Text style={styles.createEmptyText}>Crea evento</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchEvents(true)} colors={["#f43f5e"]} />}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/(app)/events/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#1a1a2e" },
  createBtn: { backgroundColor: "#f43f5e", borderRadius: 14, padding: 10, shadowColor: "#f43f5e", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  tabRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 12, backgroundColor: "#f3f4f6", borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 14, fontWeight: "600", color: "#9ca3af" },
  tabTextActive: { color: "#1a1a2e" },
  filterList: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb" },
  filterChipActive: { backgroundColor: "#f43f5e", borderColor: "#f43f5e" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  filterTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  typeBar: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 5 },
  cardTop: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 2 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeLabel: { fontSize: 11, fontWeight: "700" },
  attendingBadge: { backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  attendingText: { fontSize: 11, fontWeight: "700", color: "#22c55e" },
  fullBadge: { backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  fullText: { fontSize: 11, fontWeight: "700", color: "#ef4444" },
  title: { fontSize: 16, fontWeight: "800", color: "#1a1a2e", marginBottom: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: "#6b7280", flex: 1 },
  chevron: { alignSelf: "center", marginRight: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 6 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 20 },
  createEmptyBtn: { backgroundColor: "#f43f5e", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  createEmptyText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
