// SocketContext.js - HTTP polling fallback (no socket.io-client needed)
// socket.io-client causes TurboModuleRegistry crash on iOS Expo Go SDK 54
// Real WebSocket support requires a custom development build (not Expo Go)
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_URL } from '../constants/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [newMatch, setNewMatch] = useState(null);
  const pollIntervalRef = useRef(null);
  const lastPollRef = useRef(null);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const since = lastPollRef.current || new Date(Date.now() - 5000).toISOString();
      const res = await axios.get(
        `${API_URL}/api/events/poll?since=${encodeURIComponent(since)}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );
      lastPollRef.current = new Date().toISOString();
      setConnected(true);
      if (res.data?.events) {
        res.data.events.forEach(event => {
          if (event.type === 'match') setNewMatch(event.data);
          if (event.type === 'notification') {
            setNotifications(prev => [event.data, ...prev].slice(0, 50));
          }
        });
      }
    } catch (e) {
      setConnected(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    poll();
    pollIntervalRef.current = setInterval(poll, 5000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [token, poll]);

  const clearNewMatch = useCallback(() => setNewMatch(null), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  return (
    <SocketContext.Provider value={{
      connected,
      notifications,
      newMatch,
      clearNewMatch,
      clearNotifications,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
