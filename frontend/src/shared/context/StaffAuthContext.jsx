import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '@shared/utils/api';

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
