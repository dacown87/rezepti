import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// Per-metric coverage floors ratcheted after the Vitest 4 migration (2026-05-24):
// Root: lines 34.67%, statements 34.11%, functions 34.51%, branches 31.55%
// 30 is the minimum quality floor; COVERAGE_RATCHET_MIN can raise it later.
const COVERAGE_BASELINES = {
  lines: 30,
  statements: 30,
  functions: 30,
  branches: 30,
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
