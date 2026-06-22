/**
 * Typed, centralized environment access.
 *
 * NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
 * BACKEND_ORIGIN is server-only and must never be read in client code.
 */
export const env = {
  /** Browser-facing API base. Empty in dev → relative '/api' (proxied by next.config). */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  /** socket.io server origin (browser connects directly — not proxied). */
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? '',
  /** Public site origin for canonical URLs / OG / sitemap. */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  /** Server-only origin for SSR fetches + the dev /api rewrite. */
  backendOrigin: process.env.BACKEND_ORIGIN ?? 'http://localhost:3001',
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  },
} as const;
