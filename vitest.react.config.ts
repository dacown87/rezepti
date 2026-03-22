import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup-react.ts'],
    include: ['test/react-components/**/*.test.{ts,tsx}', 'test/react-components/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'frontend/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})
