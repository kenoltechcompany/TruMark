import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
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

interface DecodedToken {
  sub: string;
  username: string;
  role: string;
  classId?: string;
  exp?: number;
}

/** Decodes the payload portion of a JWT (supporting base64url) without verifying the signature. */
function decodeToken(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(padded)) as DecodedToken;
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('token');
    if (!stored) return null;
    if (!decodeToken(stored)) {
      localStorage.removeItem('token');
      return null;
    }
    return stored;
  });

  // Derive role, classId, and username synchronously so route guards have them on the very first render
  const decoded = useMemo(() => (token ? decodeToken(token) : null), [token]);
  const role = decoded?.role ?? null;
  const classId = decoded?.classId ?? null;
  const username = decoded?.username ?? null;
  const isAuthenticated = Boolean(token && decoded);

  const login = async (usernameInput: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { username: usernameInput, password });
    localStorage.setItem('token', data.accessToken);
    setToken(data.accessToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // Redirect to login on initial render if no valid token (except for public routes)
  useEffect(() => {
    const path = window.location.pathname;
    const isPublic =
      path === '/' ||
      path === '/login' ||
      path === '/face-test' ||
      path.startsWith('/check-in') ||
      path.startsWith('/public/');

    if (!isAuthenticated && !isPublic) {
      window.location.href = '/login';
    }
  }, [isAuthenticated]);

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
