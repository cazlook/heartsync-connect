import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../constants/api';

export default function ChatScreen({ route, navigation }) {
  const { matchId, user } = route.params;
  const { token, user: me } = useAuth();
  const { emit, on, off } = useSocket();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    emit('join_room', matchId);

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    on('new_message', handleNewMessage);

    navigation.setOptions({ title: user?.displayName || 'Chat' });

    return () => {
      off('new_message', handleNewMessage);
    };
  }, [matchId]);

  const fetchMessages = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/chat/${matchId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    try {
      await axios.post(
        `${API_URL}/api/chat/${matchId}/messages`,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === me?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
        <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.content}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#555"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  flex: { flex: 1 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myBubble: { backgroundColor: '#e91e63', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#1a1a2e', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  myText: { color: '#fff' },
  theirText: { color: '#ddd' },
  messageTime: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#0f0f1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e91e63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#333' },
  sendIcon: { color: '#fff', fontSize: 18 },
});
