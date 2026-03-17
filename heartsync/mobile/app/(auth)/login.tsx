import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert
} from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Errore", "Inserisci email e password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(app)");
    } catch {
      Alert.alert("Accesso fallito", "Email o password non corretti");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>💕</Text>
        <Text style={styles.title}>HeartSync</Text>
        <Text style={styles.subtitle}>Il dating app che sente davvero</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="tu@esempio.com"
            placeholderTextColor="#d1d5db"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#d1d5db"
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accedi</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Non hai un account? </Text>
          <Link href="/(auth)/register">
            <Text style={styles.footerLink}>Registrati</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 48 },
  logo: { fontSize: 60, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "900", color: "#1a1a2e" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginBottom: 40 },
  form: { width: "100%", gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#111827" },
  btn: { backgroundColor: "#f43f5e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24, shadowColor: "#f43f5e", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  footer: { flexDirection: "row", marginTop: 24 },
  footerText: { color: "#6b7280", fontSize: 14 },
  footerLink: { color: "#f43f5e", fontWeight: "700", fontSize: 14 },
});
