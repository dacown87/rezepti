import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// CI-safe default: this should almost never fail due to threshold drift.
const COVERAGE_BASELINE_MIN = 1;
// Optional ratchet for incremental tightening (e.g. 2, 5, 10, ...).
// If unset or invalid, we fall back to COVERAGE_BASELINE_MIN.
const COVERAGE_RATCHET_ENV = Number.parseInt(process.env.COVERAGE_RATCHET_MIN ?? '', 10);
const COVERAGE_RATCHET_MIN =
  Number.isFinite(COVERAGE_RATCHET_ENV) && COVERAGE_RATCHET_ENV >= COVERAGE_BASELINE_MIN
    ? COVERAGE_RATCHET_ENV
    : COVERAGE_BASELINE_MIN;

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
      reportsDirectory: './artifacts/coverage/root',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'mobile/**',
        'artifacts/**',
        'public/**',
        'scripts/**',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        ...(configDefaults.coverage.exclude ?? []),
      ],
      thresholds: {
        lines: COVERAGE_RATCHET_MIN,
        statements: COVERAGE_RATCHET_MIN,
        functions: COVERAGE_RATCHET_MIN,
        branches: COVERAGE_RATCHET_MIN,
      },
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
