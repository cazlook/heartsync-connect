import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from "react-native";
import { Image } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Send, Heart } from "lucide-react-native";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { API_URL } from "@/constants/api";

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  timestamp: string;
  read: boolean;
  reactions: Array<{ user_id: string; reaction: string }>;
}

interface OtherUser {
  id: string;
  name: string;
  photos: string[];
}

const QUICK_REPLIES = ["Ciao! 👋", "Come stai?", "Sei bellissimo/a 😍", "Usciamo?", "Raccontami di te"];

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user, token } = useAuth();
  const { connected, joinMatch, leaveMatch, sendMessage, markRead, messages: socketMessages } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!matchId || !token) return;

    const load = async () => {
      try {
        const [msgRes, matchRes] = await Promise.all([
          axios.get(`${API_URL}/api/chat/${matchId}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/api/chat/matches`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setMessages([...msgRes.data].reverse());
        const found = matchRes.data.find((m: any) => m.id === matchId);
        if (found) setOtherUser(found.other_user);
      } catch {}
      setLoading(false);
    };

    load();
    if (connected) { joinMatch(matchId); markRead(matchId); }
    return () => { leaveMatch(matchId); };
  }, [matchId, token, connected]);

  useEffect(() => {
    if (matchId && socketMessages.has(matchId)) {
      const incoming = socketMessages.get(matchId) || [];
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !ids.has(m.id))];
      });
    }
  }, [socketMessages, matchId]);

  useEffect(() => {
    if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = useCallback((text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !matchId) return;

    if (connected) {
      sendMessage(matchId, msg);
    } else {
      axios.post(`${API_URL}/api/chat/${matchId}/messages`, { message: msg, message_type: "text" },
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(({ data }) => setMessages((p) => [...p, data])).catch(() => {});
    }
    setInput("");
    setShowQuick(false);
  }, [input, matchId, connected, sendMessage, token]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.message}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerUser}>
          {otherUser?.photos?.[0] ? (
            <Image source={{ uri: otherUser.photos[0] }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{otherUser?.name?.charAt(0) || "?"}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{otherUser?.name || "Match"}</Text>
            <Text style={styles.headerStatus}>{connected ? "Online" : "Offline"}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#f43f5e" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>💕</Text>
              <Text style={styles.emptyChatText}>Dì ciao a {otherUser?.name || "il tuo match"}!</Text>
            </View>
          }
        />
      )}

      {showQuick && (
        <FlatList
          horizontal
          data={QUICK_REPLIES}
          keyExtractor={(r) => r}
          contentContainerStyle={styles.quickList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.quickChip} onPress={() => handleSend(item)}>
              <Text style={styles.quickChipText}>{item}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      )}

      <View style={styles.inputArea}>
        <TouchableOpacity onPress={() => setShowQuick(!showQuick)} style={styles.quickBtn}>
          <Heart size={20} color={showQuick ? "#f43f5e" : "#9ca3af"} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Scrivi un messaggio..."
          placeholderTextColor="#9ca3af"
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={() => handleSend()} disabled={!input.trim()}>
          <Send size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { marginRight: 12, padding: 4 },
  headerUser: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f43f5e", alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerName: { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  headerStatus: { fontSize: 11, color: "#6b7280" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 8 },
  msgRow: { marginVertical: 2 },
  msgRowMe: { alignItems: "flex-end" },
  msgRowThem: { alignItems: "flex-start" },
  bubble: { maxWidth: "75%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: "#f43f5e", borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#f3f4f6", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: "#1a1a2e", lineHeight: 20 },
  bubbleTextMe: { color: "#fff" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyChatEmoji: { fontSize: 48, marginBottom: 12 },
  emptyChatText: { fontSize: 15, color: "#6b7280", fontWeight: "600" },
  quickList: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  quickChip: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecdd3", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  quickChipText: { color: "#f43f5e", fontSize: 13, fontWeight: "600" },
  inputArea: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, paddingBottom: Platform.OS === "ios" ? 28 : 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6", gap: 8 },
  quickBtn: { padding: 8 },
  input: { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: "#1a1a2e", maxHeight: 100 },
  sendBtn: { backgroundColor: "#f43f5e", borderRadius: 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});
