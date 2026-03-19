import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { HeartRateProvider } from './contexts/HeartRateContext';
import MainTabNavigator from './navigation/MainTabNavigator';
import AuthScreen from './screens/AuthScreen';
import CalibrationScreen from './screens/CalibrationScreen';
import RevealScreen from './screens/RevealScreen';
import PostMatchScreen from './screens/PostMatchScreen';
import ChatScreen from './screens/ChatScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Calibration" component={CalibrationScreen} />
          <Stack.Screen name="Reveal" component={RevealScreen} />
          <Stack.Screen name="PostMatch" component={PostMatchScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <HeartRateProvider>
          <SocketProvider>
            <NavigationContainer>
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </SocketProvider>
        </HeartRateProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
