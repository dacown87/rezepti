import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

// Per-metric coverage floors based on measured Vitest 4 baseline (2026-05-14):
// Mobile: lines 33.39%, statements 32.41%, functions 34.26%, branches 31.61%
// Floor formula: floor(measured * 0.8 / 5) * 5 — leaves buffer for test flakes.
const COVERAGE_BASELINES = {
  lines: 25,
  statements: 25,
  functions: 25,
  branches: 25,
} as const;
// Optional global ratchet (env COVERAGE_RATCHET_MIN) raises all metrics — never lowers below baseline.
const COVERAGE_RATCHET_ENV = Number.parseInt(process.env.COVERAGE_RATCHET_MIN ?? '', 10);
const applyRatchet = (baseline: number) =>
  Number.isFinite(COVERAGE_RATCHET_ENV) && COVERAGE_RATCHET_ENV > baseline
    ? COVERAGE_RATCHET_ENV
    : baseline;

const rootDir = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
      'react-native': fileURLToPath(new URL('./test/react-native-shim.ts', import.meta.url)),
      '@testing-library/react-native': fileURLToPath(
        new URL('./test/testing-library-rn-compat.ts', import.meta.url)
      ),
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
