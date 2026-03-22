import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/api';

const AuthContext = createContext(null);

// FastAPI response: { access_token, refresh_token, token_type, user_id }
function parseAuthResponse(data) {
  if (data.access_token) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user_id,
    };
  }
  // backend-v2 fallback
  return {
    accessToken: data.tokens?.access,
    refreshToken: data.tokens?.refresh,
    userId: data.userId,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('authUser');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load auth state:', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { accessToken, refreshToken, userId } = parseAuthResponse(res.data);
    const userData = { id: userId, email };
    await AsyncStorage.setItem('authToken', accessToken);
    await AsyncStorage.setItem('authRefresh', refreshToken || '');
    await AsyncStorage.setItem('authUser', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
    return userData;
  };

  const register = async (email, password, displayName) => {
    // FastAPI richiede questi campi obbligatori
    const body = {
      email,
      password,
      name: displayName || 'Utente',
      age: 25,
      bio: '',
      city: '',
      gender: 'non specificato',
      seeking: 'tutti',
      interests: [],
      photos: [],
    };
    const res = await axios.post(`${API_URL}/api/auth/register`, body);
    const { accessToken, refreshToken, userId } = parseAuthResponse(res.data);
    const userData = { id: userId, email, displayName: body.name };
    await AsyncStorage.setItem('authToken', accessToken);
    await AsyncStorage.setItem('authRefresh', refreshToken || '');
    await AsyncStorage.setItem('authUser', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      await AsyncStorage.multiRemove(['authToken', 'authRefresh', 'authUser']);
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
