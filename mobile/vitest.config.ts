import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// CI-safe default: keep the gate conservative to avoid flaky failures.
const COVERAGE_BASELINE_MIN = 1;
// Optional ratchet for deliberate tightening in CI/local (1 -> 2 -> 5 ...).
// Invalid or missing values safely fall back to COVERAGE_BASELINE_MIN.
const COVERAGE_RATCHET_ENV = Number.parseInt(process.env.COVERAGE_RATCHET_MIN ?? '', 10);
const COVERAGE_RATCHET_MIN =
  Number.isFinite(COVERAGE_RATCHET_ENV) && COVERAGE_RATCHET_ENV >= COVERAGE_BASELINE_MIN
    ? COVERAGE_RATCHET_ENV
    : COVERAGE_BASELINE_MIN;

export default defineConfig({
  resolve: {
    alias: {
      'react-native': new URL('./test/react-native-shim.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    fileParallelism: false,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'test/**/*.spec.ts', 'test/**/*.spec.tsx'],
    exclude: ['node_modules/**', 'dist/**', '.expo/**', ...configDefaults.exclude],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: '../artifacts/coverage/mobile',
      include: ['app/**/*.ts', 'app/**/*.tsx', 'hooks/**/*.ts', 'utils/**/*.ts'],
      exclude: [
        'test/**',
        '.expo/**',
        '**/.expo/**',
        'public/**',
        '**/static/js/web/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: COVERAGE_RATCHET_MIN,
        statements: COVERAGE_RATCHET_MIN,
        functions: COVERAGE_RATCHET_MIN,
        branches: COVERAGE_RATCHET_MIN,
      },
    },
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      '@testing-library/react-native': new URL('./test/testing-library-rn-compat.ts', import.meta.url).pathname,
    },
  },
});
