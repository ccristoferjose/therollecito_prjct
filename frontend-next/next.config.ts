import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Major version of the Next.js actually running, which is NOT always the one in
 * package.json: node_modules lives inside the Docker image while this file is
 * bind-mounted, so a container built before an upgrade runs the old Next against
 * the new config. An unknown key is a FATAL config error, not a warning — it
 * crash-loops the container — so version-gate anything version-specific.
 */
const nextMajor = Number(
  createRequire(import.meta.url)('next/package.json').version.split('.')[0],
);

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
  //
  // next/image refuses any host not listed here. In production that is the real
  // S3 bucket (covered by **.amazonaws.com) or a CloudFront domain. In local
  // development the backend rewrites image URLs to MinIO — plain http on
  // localhost:9000, per S3_PUBLIC_URL_BASE in backend/.env — which matches
  // neither pattern, so every menu image 500s the page.
  //
  // The localhost entry is added ONLY outside production, so a dev-only,
  // http-scheme host can never reach a production build.
  images: {
    // Next 16 added a security restriction that blocks optimizing images served
    // from local IPs, to close an SSRF vector. Without this the MinIO images
    // above are rejected with a 400 even though the host IS in remotePatterns.
    //
    // Two guards, both required:
    //   - nextMajor >= 16: the key does not exist in 15 and an unrecognised key
    //     is fatal there, so emitting it unconditionally crash-loops any
    //     container still on the old version.
    //   - not production: prod serves images from S3/CloudFront and must keep
    //     the SSRF protection on.
    // See the Next 16 upgrade guide, "Local IP Restriction".
    ...(nextMajor >= 16 && process.env.NODE_ENV !== 'production'
      ? { dangerouslyAllowLocalIP: true }
      : {}),
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      ...(process.env.NODE_ENV === 'production'
        ? []
        : [
            {
              protocol: 'http' as const,
              hostname: 'localhost',
              port: '9000',
              pathname: '/**',
            },
            // Same MinIO bucket via the compose service name, for any image
            // URL resolved during SSR inside the Docker network.
            {
              protocol: 'http' as const,
              hostname: 'minio',
              port: '9000',
              pathname: '/**',
            },
          ]),
    ],
  },
};

export default nextConfig;
