import { describe, expect, it } from 'vitest';

import {
  createPerformanceRunId,
  evaluateStabilitySeedVerification,
  evaluateStrictObservation,
  evaluateLighthouseBudgetFindings,
  extractLighthouseMetrics,
  findRouteBudget,
  getFailureExitCode,
  isObservationGreenRun,
  isBudgetFinding,
  resolveBundleBudgetChecks,
} from '../../scripts/performance/validate-status.mjs';

describe('validate-status performance budgets', () => {
  it('creates unique run IDs for repeated validations inside one CI run', () => {
    expect(
      createPerformanceRunId({
        githubRunId: '123',
        githubRunAttempt: '2',
        statusGeneratedAt: '2026-05-11T00:00:00.000Z',
      }),
    ).toBe('123-attempt-2-2026-05-11T00:00:00.000Z');
    expect(createPerformanceRunId({ explicitRunId: 'manual-seed-1' })).toBe('manual-seed-1');
    expect(createPerformanceRunId({ statusGeneratedAt: '2026-05-11T00:00:01.000Z' })).toBe(
      '2026-05-11T00:00:01.000Z',
    );
  });

  it('resolves method-aware Lighthouse budgets before legacy viewport budgets', () => {
    const baseline = {
      lighthouse: {
        methods: {
          simulate: {
            'mobile-375x812': {
              '/shopping': { lcpMs: 5000, cls: 0.2, jsExecutionMs: 3000 },
            },
          },
        },
        'mobile-375x812': {
          '/shopping': { lcpMs: 9000, cls: 0.4, jsExecutionMs: 9000 },
        },
      },
    };

    expect(findRouteBudget(baseline, 'simulate', 'mobile-375x812', '/shopping')).toEqual({
      lcpMs: 5000,
      cls: 0.2,
      jsExecutionMs: 3000,
    });
    expect(findRouteBudget(baseline, 'devtools', 'mobile-375x812', '/shopping')).toEqual({
      lcpMs: 9000,
      cls: 0.4,
      jsExecutionMs: 9000,
    });
  });

  it('extracts JS execution from summary/history aliases before falling back to report audits', () => {
    const report = {
      audits: {
        'largest-contentful-paint': { numericValue: 2100 },
        'cumulative-layout-shift': { numericValue: 0.04 },
        'bootup-time': { numericValue: 3100 },
      },
    };

    expect(
      extractLighthouseMetrics({
        report,
        summaryMetric: { jsExecutionMs: 1800 },
      }),
    ).toEqual({
      lcpMs: 2100,
      cls: 0.04,
      jsExecutionMs: 1800,
    });

    expect(
      extractLighthouseMetrics({
        report,
        historyMetric: { bootupTimeMs: 1900 },
      }).jsExecutionMs,
    ).toBe(1900);
  });

  it('reports gzip bundle budgets and warning-vs-strict exit behavior deterministically', () => {
    const checks = resolveBundleBudgetChecks(
      {
        totals: {
          files: 10,
          totalBytes: 5000,
          jsBytes: 4000,
          gzipJsBytes: 1200,
          cssBytes: 500,
          htmlBytes: 500,
        },
        largestJsAsset: { bytes: 2500 },
      },
      {
        bundle: {
          limits: {
            maxGzipJsBytes: 1000,
            maxLargestJsAssetBytes: 3000,
          },
        },
      },
    );

    expect(checks).toEqual(
      expect.arrayContaining([
        ['gzipJsBytes', 1200, 1000],
        ['largestJsAssetBytes', 2500, 3000],
      ]),
    );
    expect(getFailureExitCode('warn')).toBe(0);
    expect(getFailureExitCode('soft')).toBe(1);
    expect(getFailureExitCode('strict')).toBe(1);
  });

  it('fails budgeted metrics when values are missing, NaN, or over the limit', () => {
    expect(
      evaluateLighthouseBudgetFindings({
        budget: { lcpMs: 2500, cls: 0.1, jsExecutionMs: 2000 },
        metrics: { lcpMs: null, cls: Number.NaN, jsExecutionMs: 2400 },
        route: '/recipe/1',
        viewport: 'mobile-375x812',
      }),
    ).toEqual([
      'WARN: LCP metric unavailable for /recipe/1 @ mobile-375x812 with an active lcpMs budget.',
      'WARN: CLS metric unavailable for /recipe/1 @ mobile-375x812 with an active cls budget.',
      'WARN: JS execution budget exceeded for /recipe/1 @ mobile-375x812 (2400ms > 2000ms).',
    ]);
  });

  it('classifies only baseline and metric budget warnings as budget findings', () => {
    expect(isBudgetFinding('WARN: bundle baseline exceeded for gzipJsBytes (1200 > 1000).')).toBe(true);
    expect(isBudgetFinding('WARN: LCP budget exceeded for / @ mobile (3000ms > 2500ms).')).toBe(true);
    expect(isBudgetFinding('WARN: JS execution metric unavailable for / @ mobile with an active jsExecutionMs budget.')).toBe(true);
    expect(isBudgetFinding('WARN: lighthouse status is skipped.')).toBe(false);
  });

  it('verifies the warmup seed evidence needed before a strict probe', () => {
    const verification = evaluateStabilitySeedVerification(
      {
        status: 'ok',
        config: { runs: 10, method: 'simulate', runBundle: true, runWarmup: true },
        results: [
          { label: 'bundle', writesHistory: false },
          { label: 'warmup', writesHistory: false },
          ...Array.from({ length: 10 }, (_, index) => [
            { label: `lighthouse-${index + 1}`, writesHistory: false },
            { label: `validate-${index + 1}`, writesHistory: true },
          ]).flat(),
        ],
      },
      { requiredRuns: 10, requiredMethod: 'simulate' },
    );

    expect(verification.ready).toBe(true);
    expect(verification.historyWritesMatchExpected).toBe(true);
    expect(verification.warmupHistoryWriteDetected).toBe(false);
  });

  it('requires five consecutive green CI warn-runs plus readiness and warmup verification', () => {
    const history = Array.from({ length: 5 }, (_, index) => ({
      runId: `ci-run-${index + 1}`,
      timestamp: `2026-05-12T0${index}:00:00.000Z`,
      source: 'ci',
      enforcementLevel: 'warn',
      mode: 'warn-only',
      lighthouse: 'ok',
      throttlingMethod: 'simulate',
      expectedRuns: 9,
      successfulRuns: 9,
      warningRuns: 0,
      unavailableRouteCount: 0,
      findingsCount: 0,
      budgetPass: true,
      validateExitCode: 0,
    }));

    expect(isObservationGreenRun(history[0], { expectedRuns: 9, method: 'simulate' })).toBe(true);

    const observation = evaluateStrictObservation({
      history,
      readiness: {
        ready: true,
        checks: { metricStabilityMet: true },
        window: { runs: 10, lastTimestamp: '2026-05-12T06:22:53.599Z' },
      },
      stabilitySeed: {
        status: 'ok',
        config: { runs: 10, method: 'simulate', runBundle: true, runWarmup: true },
        verification: {
          orderOk: true,
          sequenceComplete: true,
          bundlePresent: true,
          warmupPresent: true,
          historyWritesOnlyValidate: true,
          expectedHistoryWrites: 10,
          actualHistoryWrites: 10,
          historyWritesMatchExpected: true,
          warmupHistoryWriteDetected: false,
        },
      },
      requiredGreenRuns: 5,
      expectedRuns: 9,
      method: 'simulate',
      requiredStabilityRuns: 10,
    });

    expect(observation.runs.consecutiveGreenRuns).toBe(5);
    expect(observation.strictProbeEligible).toBe(true);
    expect(observation.blockers).toEqual([]);
  });
});
