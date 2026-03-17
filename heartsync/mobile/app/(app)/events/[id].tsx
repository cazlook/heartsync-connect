import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, FlatList, Image
} from "react-native";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/constants/api";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, MapPin, Users, UserPlus } from "lucide-react-native";

const EVENT_TYPE_COLORS: Record<string, string> = {
  social: "#f43f5e", sport: "#22c55e", cena: "#f59e0b", trekking: "#10b981",
  concerto: "#8b5cf6", arte: "#ec4899", party: "#f97316", cinema: "#3b82f6",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

interface AttendeeDetail {
  id: string;
  name: string;
  photos?: string[];
}

interface EventDetail {
  id: string;
  title: string;
  description: string;
  address: string;
  event_type: string;
  start_time: string;
  end_time: string;
  created_by: string;
  created_by_name?: string;
  attendees_count: number;
  max_attendees?: number;
  is_attending: boolean;
  location?: { city?: string };
  attendees_detail?: AttendeeDetail[];
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvent(data);
    } catch {
      Alert.alert("Errore", "Impossibile caricare l'evento");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const handleRSVP = async () => {
    if (!event) return;
    setRsvpLoading(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/events/${event.id}/rsvp`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEvent((prev) => prev ? { ...prev, is_attending: data.attending, attendees_count: prev.attendees_count + (data.attending ? 1 : -1) } : prev);
      Alert.alert(data.attending ? "Iscritto!" : "Rimosso", data.message);
    } catch (e: any) {
      Alert.alert("Errore", e?.response?.data?.detail || "Errore RSVP");
    } finally {
      setRsvpLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#f43f5e" /></View>;
  }
  if (!event) return null;

  const color = EVENT_TYPE_COLORS[event.event_type] || "#f43f5e";
  const isFull = event.max_attendees != null && event.attendees_count >= event.max_attendees && !event.is_attending;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: color + "30" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#1a1a2e" />
        </TouchableOpacity>
        <View style={[styles.typeDot, { backgroundColor: color }]} />
        <TouchableOpacity onPress={() => router.push(`/(app)/events/invite?eventId=${event.id}`)} style={styles.inviteBtn}>
          <UserPlus size={20} color={color} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{event.title}</Text>
        {event.created_by_name && (
          <Text style={styles.createdBy}>Organizzato da {event.created_by_name}</Text>
        )}

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Calendar size={16} color={color} />
            <View>
              <Text style={styles.infoLabel}>Inizio</Text>
              <Text style={styles.infoValue}>{formatDate(event.start_time)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Calendar size={16} color="#9ca3af" />
            <View>
              <Text style={styles.infoLabel}>Fine</Text>
              <Text style={styles.infoValue}>{formatDate(event.end_time)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MapPin size={16} color={color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Luogo</Text>
              <Text style={styles.infoValue}>{event.address}</Text>
              {event.location?.city && <Text style={styles.infoCity}>{event.location.city}</Text>}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Users size={16} color={color} />
            <View>
              <Text style={styles.infoLabel}>Partecipanti</Text>
              <Text style={styles.infoValue}>
                {event.attendees_count}{event.max_attendees ? `/${event.max_attendees}` : ""}
                {isFull ? "  · Completo" : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Descrizione */}
        {event.description ? (
          <View style={styles.descBox}>
            <Text style={styles.descTitle}>Descrizione</Text>
            <Text style={styles.descText}>{event.description}</Text>
          </View>
        ) : null}

        {/* Partecipanti preview */}
        {event.attendees_detail && event.attendees_detail.length > 0 && (
          <View style={styles.attendeesBox}>
            <Text style={styles.descTitle}>Partecipano</Text>
            <FlatList
              horizontal
              data={event.attendees_detail}
              keyExtractor={(a) => a.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.attendeeChip}>
                  {item.photos?.[0] ? (
                    <Image source={{ uri: item.photos[0] }} style={styles.attendeePhoto} />
                  ) : (
                    <View style={[styles.attendeePhoto, styles.attendeePlaceholder]}>
                      <Text style={styles.attendeeInitial}>{item.name.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.attendeeName} numberOfLines={1}>{item.name.split(" ")[0]}</Text>
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* RSVP Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.rsvpBtn, event.is_attending && styles.rsvpBtnAttending, (isFull && !event.is_attending) && styles.rsvpBtnDisabled]}
          onPress={handleRSVP}
          disabled={rsvpLoading || (isFull && !event.is_attending)}
        >
          {rsvpLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.rsvpBtnText}>
                {isFull && !event.is_attending ? "Evento al completo" : event.is_attending ? "Ritira partecipazione" : "Partecipo!"}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 6 },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
  inviteBtn: { padding: 6 },
  content: { padding: 20, paddingBottom: 100, gap: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#1a1a2e", lineHeight: 32 },
  createdBy: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  infoCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#1a1a2e", fontWeight: "600" },
  infoCity: { fontSize: 12, color: "#6b7280" },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  descBox: { backgroundColor: "#fff", borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  descTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  descText: { fontSize: 14, color: "#4b5563", lineHeight: 22 },
  attendeesBox: { gap: 10 },
  attendeeChip: { alignItems: "center", gap: 5, marginRight: 14, width: 56 },
  attendeePhoto: { width: 52, height: 52, borderRadius: 26 },
  attendeePlaceholder: { backgroundColor: "#f43f5e", alignItems: "center", justifyContent: "center" },
  attendeeInitial: { fontSize: 22, fontWeight: "800", color: "#fff" },
  attendeeName: { fontSize: 11, color: "#374151", fontWeight: "600", textAlign: "center" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rsvpBtn: { backgroundColor: "#f43f5e", borderRadius: 16, paddingVertical: 16, alignItems: "center", shadowColor: "#f43f5e", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  rsvpBtnAttending: { backgroundColor: "#6b7280" },
  rsvpBtnDisabled: { backgroundColor: "#d1d5db" },
  rsvpBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
