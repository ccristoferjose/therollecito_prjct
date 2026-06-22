'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/auth/firebase';
import { api, ApiError } from '@/lib/api/client';

export interface ClientUser {
  id: number;
  email: string;
  [key: string]: unknown;
}

interface ClientAuthContextValue {
  firebaseUser: User | null;
  user: ClientUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextValue | null>(null);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<ClientUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // React to Firebase auth state (login, logout, refresh).
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const idToken = await user.getIdToken();
        setToken(idToken);
        try {
          const data = await api.get<{ user: ClientUser }>('/auth/me', idToken);
          setDbUser(data.user);
        } catch {
          setDbUser(null);
        }
      } else {
        setFirebaseUser(null);
        setDbUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Refresh the Firebase ID token before it expires (1h lifetime).
  useEffect(() => {
    if (!firebaseUser) return;
    const interval = setInterval(
      async () => setToken(await firebaseUser.getIdToken(true)),
      50 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [firebaseUser]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      setFirebaseUser(result.user);
      setToken(idToken);
      try {
        const data = await api.get<{ user: ClientUser }>('/auth/me', idToken);
        setDbUser(data.user);
      } catch (backendErr) {
        console.warn(
          '[Auth] Backend sync failed:',
          backendErr instanceof ApiError ? backendErr.message : backendErr,
        );
      }
      return result.user;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user') return null;
      console.error('[Auth] Google sign-in failed:', code);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setDbUser(null);
    setToken(null);
  }, []);

  return (
    <ClientAuthContext.Provider
      value={{
        firebaseUser,
        user: dbUser,
        token,
        loading,
        isAuthenticated: Boolean(firebaseUser),
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth(): ClientAuthContextValue {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
