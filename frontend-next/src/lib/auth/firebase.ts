'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { env } from '@/lib/config/env';

/**
 * Firebase client SDK init. Public web config only — security is enforced by
 * Firebase rules + backend token verification. getApps() guard avoids
 * re-initializing across HMR / multiple imports.
 */
const app = getApps().length ? getApp() : initializeApp(env.firebase);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { app };
