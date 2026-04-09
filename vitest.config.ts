import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

export default defineConfig({
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
      'dist/**',
      'node_modules/**',
      'mobile/**',
      ...configDefaults.exclude,
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        ...(configDefaults.coverage.exclude ?? []),
      ],
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    reporters: ['verbose'],
    alias: {
      '@': './src',
      '@test': './test',
    },
  },
});