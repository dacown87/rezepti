import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// Per-metric coverage floors based on measured baseline (2026-05-13):
// Root: lines/statements 38.14%, functions 39.62%, branches 78.33%
// Floor formula: floor(measured * 0.8 / 5) * 5 — leaves buffer for test flakes.
const COVERAGE_BASELINES = {
  lines: 30,
  statements: 30,
  functions: 30,
  branches: 60,
} as const;
// Optional global ratchet (env COVERAGE_RATCHET_MIN) raises all metrics — never lowers below baseline.
const COVERAGE_RATCHET_ENV = Number.parseInt(process.env.COVERAGE_RATCHET_MIN ?? '', 10);
const applyRatchet = (baseline: number) =>
  Number.isFinite(COVERAGE_RATCHET_ENV) && COVERAGE_RATCHET_ENV > baseline
    ? COVERAGE_RATCHET_ENV
    : baseline;

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
        lines: applyRatchet(COVERAGE_BASELINES.lines),
        statements: applyRatchet(COVERAGE_BASELINES.statements),
        functions: applyRatchet(COVERAGE_BASELINES.functions),
        branches: applyRatchet(COVERAGE_BASELINES.branches),
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
