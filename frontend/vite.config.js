import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5004',
        changeOrigin: true,
      },
      // Optional local Clerk Frontend API proxy (unused unless proxyUrl is set).
      '/__clerk': {
        target: 'http://127.0.0.1:5004',
        changeOrigin: true,
      },
    },
  },
})
