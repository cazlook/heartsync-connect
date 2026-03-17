import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/constants/api";

interface User {
  id: string;
  email: string;
  name: string;
  age?: number;
  bio?: string;
  city?: string;
  gender?: string;
  seeking?: string;
  interests: string[];
  photos: string[];
  verified: boolean;
  premium: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  age?: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("access_token");
        if (storedToken) {
          const { data } = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          setToken(storedToken);
          setUser(data);
        }
      } catch {
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    await SecureStore.setItemAsync("access_token", data.access_token);
    await SecureStore.setItemAsync("refresh_token", data.refresh_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const register = async (registerData: RegisterData) => {
    const { data } = await axios.post(`${API_URL}/api/auth/register`, registerData);
    await SecureStore.setItemAsync("access_token", data.access_token);
    await SecureStore.setItemAsync("refresh_token", data.refresh_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updated: User) => setUser(updated);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
