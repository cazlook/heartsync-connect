import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

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
    const { tokens, userId } = res.data;
    const userData = { id: userId, email };
    await AsyncStorage.setItem('authToken', tokens.access);
    await AsyncStorage.setItem('authRefresh', tokens.refresh);
    await AsyncStorage.setItem('authUser', JSON.stringify(userData));
    setToken(tokens.access);
    setUser(userData);
    return userData;
  };

  const register = async (email, password, displayName) => {
    const res = await axios.post(`${API_URL}/api/auth/register`, { email, password, displayName });
    const { tokens, userId } = res.data;
    const userData = { id: userId, email, displayName };
    await AsyncStorage.setItem('authToken', tokens.access);
    await AsyncStorage.setItem('authRefresh', tokens.refresh);
    await AsyncStorage.setItem('authUser', JSON.stringify(userData));
    setToken(tokens.access);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'authRefresh', 'authUser']);
    setToken(null);
    setUser(null);
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

export default AuthContext;
