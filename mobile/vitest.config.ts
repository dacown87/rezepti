import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// Per-metric coverage floors based on measured baseline (2026-05-13):
// Mobile: lines/statements 37.52%, functions 47.84%, branches 70.94%
// Floor formula: floor(measured * 0.8 / 5) * 5 — leaves buffer for test flakes.
const COVERAGE_BASELINES = {
  lines: 30,
  statements: 30,
  functions: 35,
  branches: 55,
} as const;
// Optional global ratchet (env COVERAGE_RATCHET_MIN) raises all metrics — never lowers below baseline.
const COVERAGE_RATCHET_ENV = Number.parseInt(process.env.COVERAGE_RATCHET_MIN ?? '', 10);
const applyRatchet = (baseline: number) =>
  Number.isFinite(COVERAGE_RATCHET_ENV) && COVERAGE_RATCHET_ENV > baseline
    ? COVERAGE_RATCHET_ENV
    : baseline;

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
        lines: applyRatchet(COVERAGE_BASELINES.lines),
        statements: applyRatchet(COVERAGE_BASELINES.statements),
        functions: applyRatchet(COVERAGE_BASELINES.functions),
        branches: applyRatchet(COVERAGE_BASELINES.branches),
      },
    },
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      '@testing-library/react-native': new URL('./test/testing-library-rn-compat.ts', import.meta.url).pathname,
    },
  },
});
