import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// VITE_PROXY_TARGET lets docker-compose point the dev-server proxy at the
// backend service hostname (http://backend:3001). Falls back to localhost
// for running `npm run dev` directly on the host.
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@client': path.resolve(__dirname, './src/client'),
      '@staff': path.resolve(__dirname, './src/staff'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Needed so HMR websockets connect when the dev server runs inside
    // a container with a bind-mount.
    watch: { usePolling: true },
    proxy: {
      '/api': proxyTarget,
      '/socket.io': {
        target: proxyTarget,
        ws: true,
      },
    },
  },
})
