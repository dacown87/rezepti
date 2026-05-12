import { describe, expect, it } from 'vitest';

import {
  buildBudgetSuggestions,
  isCompleteHistoryRun,
  matchesBudgetMethod,
  percentile,
  selectBudgetHistoryWindow,
  summarizeValues,
} from '../../scripts/performance/budget-suggestions.mjs';

function createRun(overrides: Record<string, unknown> = {}) {
  const index = Number(overrides.index || 1);
  return {
    runId: `run-${index}`,
    timestamp: `2026-05-11T00:0${index}:00.000Z`,
    lighthouse: 'ok',
    throttlingMethod: 'simulate',
    expectedRuns: 9,
    successfulRuns: 9,
    warningRuns: 0,
    unavailableRouteCount: 0,
    bundle: {
      gzipJsBytes: 1_000_000 + index * 1000,
      jsBytes: 5_000_000 + index * 1000,
      largestJsAssetBytes: 4_000_000 + index * 1000,
    },
    metrics: [
      {
        route: '/',
        viewport: 'mobile-375x812',
        lcp: 1000 + index * 10,
        cls: 0,
        jsExecutionMs: 1800 + index * 20,
      },
      {
        route: '/shopping',
        viewport: 'mobile-375x812',
        lcp: 1200 + index * 10,
        cls: 0.01,
        jsExecutionMs: 1900 + index * 20,
      },
    ],
    ...overrides,
  };
}

describe('budget suggestion helpers', () => {
  it('uses nearest-rank percentiles and p95 headroom for suggested budgets', () => {
    expect(percentile([40, 10, 20, 30], 0.95)).toBe(40);
    expect(
      summarizeValues([100, 110, 120, 130], {
        decimals: 0,
        headroomRatio: 1.1,
        minimum: 1,
      }),
    ).toMatchObject({
      sampleCount: 4,
      p50: 110,
      p75: 120,
      p95: 130,
      suggestedBudget: 143,
    });
  });

  it('selects only complete runs for the requested throttling method', () => {
    const history = [
      createRun({ index: 1, throttlingMethod: undefined }),
      createRun({ index: 2, throttlingMethod: 'devtools' }),
      createRun({ index: 3, warningRuns: 1 }),
      createRun({ index: 4 }),
      createRun({ index: 5 }),
    ];

    expect(isCompleteHistoryRun(history[3])).toBe(true);
    expect(isCompleteHistoryRun(history[2])).toBe(false);
    expect(matchesBudgetMethod(history[0], 'simulate')).toBe(false);
    expect(matchesBudgetMethod(history[0], 'simulate', true)).toBe(true);
    expect(selectBudgetHistoryWindow(history, { method: 'simulate', minRuns: 10 }).map((run) => run.runId)).toEqual([
      'run-4',
      'run-5',
    ]);
  });

  it('builds method-aware bundle and Lighthouse budget suggestions from the selected window', () => {
    const history = Array.from({ length: 10 }, (_, index) => createRun({ index: index + 1 }));
    const output = buildBudgetSuggestions(history, {
      generatedAt: '2026-05-11T00:00:00.000Z',
      method: 'simulate',
      viewport: 'mobile-375x812',
      minRuns: 10,
      headroomRatio: 1.1,
    });

    expect(output.window.complete).toBe(true);
    expect(output.bundle.maxGzipJsBytes).toMatchObject({
      sampleCount: 10,
      p95: 1010000,
      suggestedBudget: 1111000,
    });
    expect(output.lighthouse.methods.simulate['mobile-375x812']['/']).toMatchObject({
      lcpMs: {
        p75: 1080,
        p95: 1100,
        suggestedBudget: 1210,
      },
      jsExecutionMs: {
        p95: 2000,
        suggestedBudget: 2200,
      },
    });
  });
});
