import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { configDefaults } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  root: 'frontend',
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logo.png'],
      manifest: {
        name: 'RecipeDeck',
        short_name: 'RecipeDeck',
        description: 'Rezepte aus dem Netz — lokal gespeichert',
        theme_color: '#c0392b',
        background_color: '#fdf6ee',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/Logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/Logo.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^\/api\/v1\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        ...configDefaults.coverage.exclude || [],
      ],
    },
  },
})