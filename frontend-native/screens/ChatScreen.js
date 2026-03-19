import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../constants/api';

export default function ChatScreen({ route, navigation }) {
  const { matchId, user } = route.params;
  const { token, user: me } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    if (socket) {
      socket.emit('join_room', matchId);
      socket.on('new_message', (msg) => {
        setMessages((prev) => [...prev, msg]);
      });
    }
    return () => {
      if (socket) socket.off('new_message');
    };
  }, [socket, matchId]);

  const fetchMessages = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/chat/${matchId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(data);
    } catch {}
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const msg = { match_id: matchId, content: text.trim() };
    setText('');
    try {
      const { data } = await axios.post(`${API_URL}/api/chat/${matchId}/messages`, msg, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (socket) socket.emit('send_message', data);
      else setMessages((prev) => [...prev, data]);
    } catch {}
  };

  const renderItem = ({ item }) => {
    const isMe = item.sender_id === me?.id;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>
          {item.content}
        </Text>
      </View>
    );
  };

  useEffect(() => {
    if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerName}>{user?.name}</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m, i) => m.id || String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#9ca3af"
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 22, color: '#f43f5e' },
  headerName: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  list: { paddingHorizontal: 16, paddingVertical: 12 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  bubbleMe: { backgroundColor: '#f43f5e', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  bubbleText: { fontSize: 15 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextOther: { color: '#1a1a2e' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  input: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#1a1a2e', maxHeight: 100, marginRight: 10 },
  sendBtn: { backgroundColor: '#f43f5e', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 18 },
});
