import React, { useState } from 'react';
import {
  View, Text, ScrollView, Switch, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function SettingsScreen({ navigation }) {
  const { token, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [heartRateSharing, setHeartRateSharing] = useState(true);
  const [showDistance, setShowDistance] = useState(true);
  const [anonymousMode, setAnonymousMode] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Elimina account',
      'Sei sicuro? Questa azione è irreversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/users/account`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              logout();
            } catch {
              Alert.alert('Errore', 'Impossibile eliminare account');
            }
          },
        },
      ]
    );
  };

  const Row = ({ emoji, label, value, onValueChange }) => (
    <View style={styles.row}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e5e7eb', true: '#fca5a5' }}
        thumbColor={value ? '#f43f5e' : '#9ca3af'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Impostazioni</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.section}>Notifiche</Text>
        <View style={styles.card}>
          <Row emoji="🔔" label="Notifiche push" value={notifications} onValueChange={setNotifications} />
        </View>

        <Text style={styles.section}>Privacy</Text>
        <View style={styles.card}>
          <Row emoji="❤️" label="Condividi battito cardiaco" value={heartRateSharing} onValueChange={setHeartRateSharing} />
          <Row emoji="📍" label="Mostra distanza" value={showDistance} onValueChange={setShowDistance} />
          <Row emoji="👤" label="Modalità anonima" value={anonymousMode} onValueChange={setAnonymousMode} />
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
            <Text style={styles.dangerEmoji}>🗑️</Text>
            <Text style={styles.dangerText}>Elimina account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>SyncLove v1.0.0 ❤️</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  back: { fontSize: 22, color: '#f43f5e', marginRight: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#1a1a2e' },
  container: { padding: 20, paddingBottom: 40 },
  section: { fontSize: 13, fontWeight: '700', color: '#9ca3af', marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowEmoji: { fontSize: 20, marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 16, color: '#1a1a2e' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  dangerEmoji: { fontSize: 20, marginRight: 14 },
  dangerText: { fontSize: 16, color: '#ef4444', fontWeight: '600' },
  version: { textAlign: 'center', color: '#d1d5db', fontSize: 13, marginTop: 8 },
});
