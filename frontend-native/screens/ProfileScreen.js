import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../constants/api';

export default function ProfileScreen({ navigation }) {
  const { token, user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(data);
      setBio(data.bio || '');
    } catch {}
  };

  const saveProfile = async () => {
    try {
      await axios.patch(`${API_URL}/api/users/profile`, { bio }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditing(false);
      fetchProfile();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il profilo');
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const formData = new FormData();
      formData.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' });
      try {
        await axios.post(`${API_URL}/api/users/photos`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        fetchProfile();
      } catch {}
    }
  };

  const name = profile?.name || user?.name || '...';
  const photos = profile?.photos || [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={pickPhoto}>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.editPhotoBadge}>
              <Text style={styles.editPhotoText}>📸</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{name}</Text>
          {profile?.city && <Text style={styles.city}>📍 {profile.city}</Text>}
          {profile?.cardiac_calibrated && (
            <View style={styles.calibratedBadge}>
              <Text style={styles.calibratedText}>❤️ Profilo cardiaco calibrato</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <TouchableOpacity onPress={() => editing ? saveProfile() : setEditing(true)}>
              <Text style={styles.editBtn}>{editing ? 'Salva' : 'Modifica'}</Text>
            </TouchableOpacity>
          </View>
          {editing ? (
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Raccontati..."
              placeholderTextColor="#9ca3af"
            />
          ) : (
            <Text style={styles.bioText}>{bio || 'Nessuna bio ancora. Toccca Modifica!'}</Text>
          )}
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Calibration')}>
            <Text style={styles.actionEmoji}>❤️</Text>
            <Text style={styles.actionText}>Ricalibra battito cardiaco</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.actionEmoji}>🔔</Text>
            <Text style={styles.actionText}>Notifiche</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings', { screen: 'SettingsScreen' })}>
            <Text style={styles.actionEmoji}>⚙️</Text>
            <Text style={styles.actionText}>Impostazioni</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => { Alert.alert('Logout', 'Sei sicuro?', [{ text: 'Annulla' }, { text: 'Esci', onPress: logout }]); }}>
          <Text style={styles.logoutText}>Esci dall'account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  container: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: { backgroundColor: '#f43f5e', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '900', fontSize: 40 },
  editPhotoBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 14, padding: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  editPhotoText: { fontSize: 16 },
  name: { fontSize: 24, fontWeight: '900', color: '#1a1a2e', marginTop: 12 },
  city: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  calibratedBadge: { backgroundColor: '#fef2f2', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10 },
  calibratedText: { fontSize: 13, color: '#f43f5e', fontWeight: '600' },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  editBtn: { fontSize: 15, color: '#f43f5e', fontWeight: '700' },
  bioText: { fontSize: 15, color: '#4b5563', lineHeight: 22 },
  bioInput: { fontSize: 15, color: '#1a1a2e', borderWidth: 1.5, borderColor: '#f3f4f6', borderRadius: 12, padding: 12, lineHeight: 22, minHeight: 80 },
  actionsSection: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  actionEmoji: { fontSize: 20, marginRight: 14 },
  actionText: { flex: 1, fontSize: 16, color: '#1a1a2e' },
  actionArrow: { fontSize: 22, color: '#9ca3af' },
  logoutBtn: { backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#fca5a5' },
  logoutText: { color: '#f43f5e', fontSize: 16, fontWeight: '700' },
});
