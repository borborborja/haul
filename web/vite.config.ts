import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Absolute base so assets resolve at any route depth (e.g. /s/<token>);
  // relative './' broke deep routes — the browser requested /s/assets/... .
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Never let the SPA navigation fallback shadow backend routes; the API
        // and the PocketBase dashboard must always hit the server.
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Haul',
        short_name: 'Haul',
        description: 'Collaborative Shopping List',
        lang: 'ca',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        theme_color: '#FBFCFA',
        background_color: '#FBFCFA',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('2.1.0')
  }
})
