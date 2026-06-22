'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api/client';

export interface StaffUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  location_id: number | null;
}
interface LoginResponse {
  token: string;
  user: StaffUser;
}

interface StaffAuthContextValue {
  user: StaffUser | null;
  token: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Tracks whether we've read localStorage yet — guards route protection from
  // redirecting before auth state is restored on the client.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedUser = window.localStorage.getItem('staff_user');
      const savedToken = window.localStorage.getItem('staff_token');
      if (savedToken) setToken(savedToken);
      if (savedUser) setUser(JSON.parse(savedUser) as StaffUser);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>('/auth/staff/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    window.localStorage.setItem('staff_token', data.token);
    window.localStorage.setItem('staff_user', JSON.stringify(data.user));
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem('staff_token');
    window.localStorage.removeItem('staff_user');
  }, []);

  return (
    <StaffAuthContext.Provider
      value={{ user, token, isAuthenticated: Boolean(token), hydrated, login, logout }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth(): StaffAuthContextValue {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
}
