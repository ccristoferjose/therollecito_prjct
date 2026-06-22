import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// Where the Next server proxies /api during development and reaches the
// Express backend during SSR. In docker-compose this becomes http://backend:3001.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin file-tracing to this app (the monorepo has a root package-lock.json,
  // which otherwise makes Next infer the wrong workspace root).
  outputFileTracingRoot: projectDir,
  // Mirror the old Vite dev proxy: relative /api calls from the browser are
  // forwarded to the Express backend, so the typed api client can use '/api'
  // without hardcoding the backend URL. (socket.io connects directly via
  // NEXT_PUBLIC_SOCKET_URL — websockets aren't proxied through rewrites.)
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
  // Menu item images are served from S3 / the public URL base.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
    ],
  },
};

export default nextConfig;
