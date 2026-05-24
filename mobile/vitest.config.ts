import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// Per-metric coverage floors ratcheted after the Vitest 4 migration (2026-05-24):
// Mobile: lines 33.39%, statements 32.41%, functions 34.26%, branches 31.61%
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

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
      'react-native': resolve(rootDir, 'test/react-native-shim.ts'),
      '@testing-library/react-native': resolve(rootDir, 'test/testing-library-rn-compat.ts'),
    },
    // Expo/Metro resolves platform files implicitly; Vitest needs the suffixes spelled out.
    extensions: ['.native.tsx', '.native.ts', '.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js', '.json'],
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
  },
});
