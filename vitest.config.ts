import { defineConfig, mergeConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';
import path from 'path';

const frontendConfig = defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './frontend/src/test/setup.ts')],
    include: ['frontend/src/**/*.test.{ts,tsx}', 'frontend/src/**/*.spec.{ts,tsx}'],
    exclude: [
      'frontend/node_modules/**',
      'dist/**',
      'node_modules/**',
      ...configDefaults.exclude,
    ],
  },
});

// Determine if we're running frontend or backend tests
const isFrontendTest = process.argv.some(arg => arg.includes('frontend/src/'));

const backendConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: [
      'test/**/*.test.ts',
      'test/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
    exclude: [
      'frontend/**',
      'dist/**',
      'node_modules/**',
      ...configDefaults.exclude,
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        'frontend/',
        '**/*.d.ts',
        '**/*.config.*',
        ...configDefaults.coverage.exclude || [],
      ],
    },
    // Configure test timeouts
    testTimeout: 60000,
    hookTimeout: 60000,

    // Test reporters
    reporters: ['verbose'],

    // Configure alias for module resolution
    alias: {
      '@': './src',
      '@test': './test',
      '@frontend': './frontend/src',
    },
  },
});

export default isFrontendTest ? frontendConfig : backendConfig;