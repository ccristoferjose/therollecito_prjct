import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setUnauthorizedHandler } from '@shared/utils/api';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('staff_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('staff_token'));

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/staff/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('staff_token', data.token);
    localStorage.setItem('staff_user', JSON.stringify(data.user));
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
  }, []);

  // Triggered by the API layer on a 401 for an authenticated request: the JWT
  // has expired or is invalid. Clear the session (which makes StaffRoute
  // redirect to /staff/login) and flag it so the login page can explain why.
  const expireSession = useCallback(() => {
    sessionStorage.setItem('staff_session_expired', '1');
    setToken(null);
    setUser(null);
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  const isAuthenticated = Boolean(token);

  return (
    <StaffAuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
}
