/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DuoLife',
        short_name: 'DuoLife',
        description: 'App compartida para organizar la vida en pareja.',
        theme_color: '#f3b6c6',
        background_color: '#fff7f4',
        display: 'standalone',
        start_url: '/login',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
