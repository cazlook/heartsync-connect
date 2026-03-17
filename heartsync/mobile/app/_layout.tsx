import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HeartRateProvider } from "@/contexts/HeartRateContext";
import { SocketProvider } from "@/contexts/SocketContext";

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="(auth)" redirect={!!user} />
      <Stack.Screen name="(app)" redirect={!user} />
      <Stack.Screen name="heartrate-setup" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <HeartRateProvider>
          <SocketProvider>
            <RootNavigator />
            <StatusBar style="dark" />
          </SocketProvider>
        </HeartRateProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
