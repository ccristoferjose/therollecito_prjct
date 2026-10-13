'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { api, ApiError } from '@/lib/api/client';

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
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null);

function tokenTimes(token: string): { expiresAt: number; renewBefore: number } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!Number.isFinite(payload.exp) || !Number.isFinite(payload.iat)) return null;
    return { expiresAt: payload.exp * 1000, renewBefore: Math.min(300000, (payload.exp - payload.iat) * 250) };
  } catch {
    return null;
  }
}

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Tracks whether we've read localStorage yet — guards route protection from
  // redirecting before auth state is restored on the client.
  const [hydrated, setHydrated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const currentToken = useRef<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const savedUser = window.localStorage.getItem('staff_user');
      const savedToken = window.localStorage.getItem('staff_token');
      const times = savedToken ? tokenTimes(savedToken) : null;
      if (savedToken && savedUser && times && times.expiresAt > Date.now()) {
        setToken(savedToken);
        currentToken.current = savedToken;
        setUser(JSON.parse(savedUser) as StaffUser);
      } else if (savedToken || savedUser) {
        window.localStorage.removeItem('staff_token');
        window.localStorage.removeItem('staff_user');
        setSessionExpired(true);
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>('/auth/staff/login', { email, password });
    currentToken.current = data.token;
    setSessionExpired(false);
    setToken(data.token);
    setUser(data.user);
    window.localStorage.setItem('staff_token', data.token);
    window.localStorage.setItem('staff_user', JSON.stringify(data.user));
    return data;
  }, []);

  const logout = useCallback(() => {
    currentToken.current = null;
    setToken(null);
    setUser(null);
    window.localStorage.removeItem('staff_token');
    window.localStorage.removeItem('staff_user');
  }, []);

  useEffect(() => {
    if (!token || !hydrated) return;
    const times = tokenTimes(token);
    let disposed = false;
    let refreshing = false;
    const expire = () => { setSessionExpired(true); logout(); };
    const checkSession = async () => {
      if (disposed || currentToken.current !== token) return;
      if (!times || Date.now() >= times.expiresAt) { expire(); return; }
      // Keep a waiting kitchen display signed in. Admin pages require a fresh
      // login on expiry and do not renew merely because the page is open.
      if (!pathname?.startsWith('/staff/kitchen') || refreshing || Date.now() < times.expiresAt - times.renewBefore) return;
      refreshing = true;
      try {
        const data = await api.post<LoginResponse>('/auth/staff/refresh', undefined, token);
        if (disposed || currentToken.current !== token) return;
        currentToken.current = data.token;
        setToken(data.token);
        setUser(data.user);
        window.localStorage.setItem('staff_token', data.token);
        window.localStorage.setItem('staff_user', JSON.stringify(data.user));
      } catch (err) {
        if (!disposed && currentToken.current === token && err instanceof ApiError && [401, 403].includes(err.status)) expire();
        // Network/server failures retry at the next tick while the token is valid.
      } finally {
        refreshing = false;
      }
    };
    const onUnauthorized = (event: Event) => {
      if ((event as CustomEvent<{ token: string }>).detail.token === currentToken.current) expire();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void checkSession(); };
    void checkSession();
    const interval = window.setInterval(() => void checkSession(), 15000);
    const expiryTimer = window.setTimeout(() => void checkSession(), Math.max(0, (times?.expiresAt ?? Date.now()) - Date.now()));
    window.addEventListener('staff-session-unauthorized', onUnauthorized);
    window.addEventListener('focus', checkSession);
    window.addEventListener('online', checkSession);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(expiryTimer);
      window.removeEventListener('staff-session-unauthorized', onUnauthorized);
      window.removeEventListener('focus', checkSession);
      window.removeEventListener('online', checkSession);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, hydrated, pathname, logout]);

  return (
    <StaffAuthContext.Provider
      value={{ user, token, isAuthenticated: Boolean(token), hydrated, sessionExpired, login, logout }}
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
