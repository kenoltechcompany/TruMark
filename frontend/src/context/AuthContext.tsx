import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import apiClient from '../api/client';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  /** 'ADMIN' | 'COURSE_REP' | null */
  role: string | null;
  /** The CourseRep's assigned classId, if role is COURSE_REP */
  classId: string | null;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Decodes the payload portion of a JWT without verifying the signature. */
function decodeToken(token: string): { sub: string; username: string; role: string; classId?: string } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [role, setRole] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const isAuthenticated = !!token;

  // Sync role + classId + username from token whenever it changes
  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      setRole(decoded?.role ?? null);
      setClassId(decoded?.classId ?? null);
      setUsername(decoded?.username ?? null);
    } else {
      setRole(null);
      setClassId(null);
      setUsername(null);
    }
  }, [token]);

  const login = async (usernameInput: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { username: usernameInput, password });
    localStorage.setItem('token', data.accessToken);
    setToken(data.accessToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // Redirect to login on initial render if no token (except for public routes)
  useEffect(() => {
    const path = window.location.pathname;
    const isPublic =
      path === '/' ||
      path === '/login' ||
      path.startsWith('/check-in') ||
      path.startsWith('/public/');

    if (!token && !isPublic) {
      window.location.href = '/login';
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        role,
        classId,
        username,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
