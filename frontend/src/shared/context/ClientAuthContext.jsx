import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@shared/config/firebase';
import { api } from '@shared/utils/api';

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen for Firebase auth state changes (login, logout, page refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const idToken = await user.getIdToken();
        setToken(idToken);

        // Sync with backend: auto-create if not exists
        try {
          const data = await api.get('/auth/me', idToken);
          setDbUser(data.user);
        } catch {
          // Backend not available — still keep Firebase state
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

  // Refresh token before it expires (Firebase tokens last 1 hour)
  useEffect(() => {
    if (!firebaseUser) return;

    const interval = setInterval(async () => {
      const freshToken = await firebaseUser.getIdToken(true);
      setToken(freshToken);
    }, 50 * 60 * 1000); // Refresh at 50 minutes

    return () => clearInterval(interval);
  }, [firebaseUser]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      setFirebaseUser(result.user);
      setToken(idToken);

      // Sync with backend (non-blocking — sign-in succeeds either way)
      try {
        const data = await api.get('/auth/me', idToken);
        setDbUser(data.user);
      } catch (backendErr) {
        console.warn('[Auth] Backend sync failed:', backendErr.message);
      }

      return result.user;
    } catch (err) {
      // User closed the popup or Firebase config error
      if (err.code === 'auth/popup-closed-by-user') return null;
      console.error('[Auth] Google sign-in failed:', err.code, err.message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setDbUser(null);
    setToken(null);
  }, []);

  const isAuthenticated = Boolean(firebaseUser);

  return (
    <ClientAuthContext.Provider
      value={{
        firebaseUser,
        user: dbUser,
        token,
        loading,
        isAuthenticated,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
