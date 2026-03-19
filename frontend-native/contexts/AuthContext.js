import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load stored auth state on mount
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
    } catch (error) {
      console.error('Failed to load auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData, authToken) => {
    try {
      await AsyncStorage.setItem('authToken', authToken);
      await AsyncStorage.setItem('authUser', JSON.stringify(userData));
      setToken(authToken);
      setUser(userData);
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('authUser');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    }
  };

  const updateUser = async (updatedData) => {
    try {
      const newUser = { ...user, ...updatedData };
      await AsyncStorage.setItem('authUser', JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
