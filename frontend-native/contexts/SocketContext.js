import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { WS_URL } from '../constants/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (token && user) {
      socketRef.current = io(WS_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        console.log('Socket connected:', socketRef.current.id);
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
        console.log('Socket disconnected');
      });

      socketRef.current.on('new_match', (data) => {
        setNotifications(prev => [{ type: 'match', data, id: Date.now() }, ...prev]);
      });

      socketRef.current.on('new_message', (data) => {
        setNotifications(prev => [{ type: 'message', data, id: Date.now() }, ...prev]);
      });

      socketRef.current.on('heart_reaction', (data) => {
        setNotifications(prev => [{ type: 'reaction', data, id: Date.now() }, ...prev]);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setIsConnected(false);
      };
    }
  }, [token, user]);

  const emit = (event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  };

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  const clearNotifications = () => setNotifications([]);

  return (
    <SocketContext.Provider value={{ isConnected, emit, on, off, notifications, clearNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
