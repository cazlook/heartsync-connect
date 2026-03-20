import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function ProfileScreen({ navigation }) {
  const { token, user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [biometricConsent, setBiometricConsent] = useState(true);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(data);
      setBio(data.bio || '');
      setBiometricConsent(data.biometricConsent !== false);
    } catch {}
  };

  const saveProfile = async () => {
    try {
      await axios.put(
        `${API_URL}/api/users/profile`,
        { bio },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditing(false);
      fetchProfile();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il profilo');
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Cancella dati biometrici',
      'Vuoi davvero eliminare tutti i tuoi dati biometrici? Questa azione è irreversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/users/biometric-data`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Fatto', 'Dati biometrici eliminati');
            } catch {
              Alert.alert('Errore', 'Impossibile eliminare i dati');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Elimina account',
      'Vuoi davvero eliminare il tuo account? Tutti i dati verranno rimossi definitivamente.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina account',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/users/account`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              logout();
            } catch {
              Alert.alert('Errore', 'Impossibile eliminare l\'account');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <Text style={styles.avatar}>👤</Text>
          <Text style={styles.name}>{user?.displayName || profile?.displayName || 'Utente'}</Text>
          <Text style={styles.email}>{user?.email || profile?.email || ''}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          {editing ? (
            <View>
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={setBio}
                multiline
                placeholder="Scrivi qualcosa su di te..."
                placeholderTextColor="#555"
                maxLength={200}
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                  <Text style={styles.saveButtonText}>Salva</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>Annulla</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.bioText}>{bio || 'Aggiungi una bio...'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Consenso</Text>
          <View style={styles.consentRow}>
            <View style={styles.consentInfo}>
              <Text style={styles.consentLabel}>Dati biometrici</Text>
              <Text style={styles.consentDesc}>Permetti la raccolta dei dati del battito cardiaco</Text>
            </View>
            <Switch
              value={biometricConsent}
              onValueChange={setBiometricConsent}
              trackColor={{ false: '#333', true: '#e91e63' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati & GDPR</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteData}>
            <Text style={styles.dangerButtonText}>🗑 Cancella dati biometrici</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerButton, styles.criticalButton]} onPress={handleDeleteAccount}>
            <Text style={styles.criticalButtonText}>⚠️ Elimina account</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: { fontSize: 80, marginBottom: 12 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: '#888' },
  section: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, color: '#e91e63', fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  bioText: { fontSize: 15, color: '#aaa', lineHeight: 22 },
  bioInput: {
    backgroundColor: '#0a0a0f',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 16 },
  saveButton: { backgroundColor: '#e91e63', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  cancelText: { color: '#888', fontSize: 14 },
  consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consentInfo: { flex: 1, marginRight: 16 },
  consentLabel: { fontSize: 15, color: '#fff', fontWeight: '500' },
  consentDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  dangerButton: {
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  dangerButtonText: { color: '#ff5252', fontSize: 14, fontWeight: '500' },
  criticalButton: { borderColor: '#ff5252' },
  criticalButtonText: { color: '#ff1744', fontSize: 14, fontWeight: '600' },
  logoutButton: { padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#888', fontSize: 16 },
});
