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
      'src/**/*.spec.ts'
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
    },
  },
});