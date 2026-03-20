import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { HeartRateProvider } from './contexts/HeartRateContext';

import AuthScreen from './screens/AuthScreen';
import CalibrationScreen from './screens/CalibrationScreen';
import RevealScreen from './screens/RevealScreen';
import PostMatchScreen from './screens/PostMatchScreen';
import MatchesScreen from './screens/MatchesScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatScreen from './screens/ChatScreen';
import InsightsScreen from './screens/InsightsScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICON = {
  Reveal: '❤️',
  Matches: '💓',
  Chats: '💬',
  Insights: '📊',
  Profile: '👤',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0f0f1a', borderTopColor: '#1a1a2e' },
        tabBarActiveTintColor: '#e91e63',
        tabBarInactiveTintColor: '#555',
        tabBarLabel: route.name,
        tabBarIcon: ({ color, size }) => (
          <Text style={{ fontSize: size - 4 }}>{TAB_ICON[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Reveal" component={RevealScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Chats" component={ChatListScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Calibration" component={CalibrationScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
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
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </SocketProvider>
        </HeartRateProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
