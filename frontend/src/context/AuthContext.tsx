import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import apiClient from '../api/client';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  const isAuthenticated = !!token;

  const login = async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { username, password });
    localStorage.setItem('token', data.accessToken);
    setToken(data.accessToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // Redirect to login on initial render if no token
  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
