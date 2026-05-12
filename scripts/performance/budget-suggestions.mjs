import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PERF_OUT_DIR = path.resolve('artifacts/performance');
const HISTORY_PATH = path.join(PERF_OUT_DIR, 'history.json');
const BUDGET_SUGGESTIONS_FILE = path.join(PERF_OUT_DIR, 'budget-suggestions.json');

export const DEFAULT_BUDGET_METHOD = 'simulate';
export const DEFAULT_BUDGET_VIEWPORT = 'mobile-375x812';
export const DEFAULT_MIN_RUNS = 10;
export const DEFAULT_HEADROOM_RATIO = 1.1;
export const LIGHTHOUSE_BUDGET_METRICS = [
  { historyKey: 'lcp', budgetKey: 'lcpMs', decimals: 0, minimum: 1 },
  { historyKey: 'cls', budgetKey: 'cls', decimals: 3, minimum: 0 },
  { historyKey: 'jsExecutionMs', budgetKey: 'jsExecutionMs', decimals: 0, minimum: 1 },
];
export const BUNDLE_BUDGET_METRICS = [
  { historyKey: 'gzipJsBytes', budgetKey: 'maxGzipJsBytes', decimals: 0, minimum: 1 },
  { historyKey: 'jsBytes', budgetKey: 'maxJsBytes', decimals: 0, minimum: 1 },
  { historyKey: 'largestJsAssetBytes', budgetKey: 'maxLargestJsAssetBytes', decimals: 0, minimum: 1 },
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function round(value, decimals = 0) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function percentile(values, ratio) {
  const numericValues = (values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (numericValues.length === 0) return null;
  const clampedRatio = Math.min(1, Math.max(0, Number(ratio)));
  const index = Math.max(0, Math.ceil(clampedRatio * numericValues.length) - 1);
  return numericValues[index];
}

export function isCompleteHistoryRun(run) {
  return (
    run?.lighthouse === 'ok' &&
    Number(run.expectedRuns || 0) > 0 &&
    Number(run.successfulRuns || 0) >= Number(run.expectedRuns || 0) &&
    Number(run.warningRuns || 0) === 0 &&
    Number(run.unavailableRouteCount || 0) === 0
  );
}

export function matchesBudgetMethod(run, method, includeUnknownMethod = false) {
  if (!method || method === 'all') return true;
  if (run?.throttlingMethod === method) return true;
  return includeUnknownMethod && !run?.throttlingMethod;
}

export function selectBudgetHistoryWindow(history, {
  method = DEFAULT_BUDGET_METHOD,
  minRuns = DEFAULT_MIN_RUNS,
  includeUnknownMethod = false,
} = {}) {
  const selected = (history || [])
    .filter((run) => isCompleteHistoryRun(run))
    .filter((run) => matchesBudgetMethod(run, method, includeUnknownMethod))
    .sort((left, right) => String(left.timestamp || '').localeCompare(String(right.timestamp || '')));

  return selected.slice(-minRuns);
}

export function summarizeValues(values, {
  decimals = 0,
  headroomRatio = DEFAULT_HEADROOM_RATIO,
  minimum = 0,
} = {}) {
  const numericValues = (values || [])
    .map(normalizeNumber)
    .filter((value) => value !== null);

  const p50 = percentile(numericValues, 0.5);
  const p75 = percentile(numericValues, 0.75);
  const p95 = percentile(numericValues, 0.95);
  const suggested = p95 === null ? null : Math.max(minimum, p95 * headroomRatio);

  return {
    sampleCount: numericValues.length,
    min: round(numericValues.length ? Math.min(...numericValues) : null, decimals),
    max: round(numericValues.length ? Math.max(...numericValues) : null, decimals),
    p50: round(p50, decimals),
    p75: round(p75, decimals),
    p95: round(p95, decimals),
    suggestedBudget: round(suggested, decimals),
  };
}

function groupMetricValues(runs, viewport) {
  const groups = new Map();
  for (const run of runs) {
    for (const metric of Array.isArray(run.metrics) ? run.metrics : []) {
      if (viewport && metric.viewport !== viewport) continue;
      const key = `${metric.route}::${metric.viewport}`;
      if (!groups.has(key)) {
        groups.set(key, {
          route: metric.route,
          viewport: metric.viewport,
          values: Object.fromEntries(LIGHTHOUSE_BUDGET_METRICS.map((entry) => [entry.historyKey, []])),
        });
      }
      const group = groups.get(key);
      for (const entry of LIGHTHOUSE_BUDGET_METRICS) {
        const value = normalizeNumber(metric[entry.historyKey]);
        if (value !== null) group.values[entry.historyKey].push(value);
      }
    }
  }
  return [...groups.values()].sort((left, right) => {
    if (left.viewport === right.viewport) return String(left.route).localeCompare(String(right.route));
    return String(left.viewport).localeCompare(String(right.viewport));
  });
}

export function buildBudgetSuggestions(history, {
  method = DEFAULT_BUDGET_METHOD,
  viewport = DEFAULT_BUDGET_VIEWPORT,
  minRuns = DEFAULT_MIN_RUNS,
  headroomRatio = DEFAULT_HEADROOM_RATIO,
  includeUnknownMethod = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const normalizedMinRuns = normalizePositiveInteger(minRuns, DEFAULT_MIN_RUNS, 'minRuns');
  const normalizedHeadroomRatio = normalizeHeadroomRatio(headroomRatio);
  const selectedRuns = selectBudgetHistoryWindow(history, {
    method,
    minRuns: normalizedMinRuns,
    includeUnknownMethod,
  });
  const complete = selectedRuns.length >= normalizedMinRuns;
  const routeGroups = groupMetricValues(selectedRuns, viewport);

  const lighthouse = Object.fromEntries(
    routeGroups.map((group) => [
      group.route,
      Object.fromEntries(
        LIGHTHOUSE_BUDGET_METRICS.map((entry) => [
          entry.budgetKey,
          summarizeValues(group.values[entry.historyKey], {
            decimals: entry.decimals,
            minimum: entry.minimum,
            headroomRatio: normalizedHeadroomRatio,
          }),
        ]),
      ),
    ]),
  );

  const bundle = Object.fromEntries(
    BUNDLE_BUDGET_METRICS.map((entry) => [
      entry.budgetKey,
      summarizeValues(
        selectedRuns.map((run) => run.bundle?.[entry.historyKey]),
        {
          decimals: entry.decimals,
          minimum: entry.minimum,
          headroomRatio: normalizedHeadroomRatio,
        },
      ),
    ]),
  );

  return {
    generatedAt,
    criteria: {
      method,
      viewport,
      minRuns: normalizedMinRuns,
      headroomRatio: normalizedHeadroomRatio,
      includeUnknownMethod,
      suggestedBudgetRule: 'p95 * headroomRatio',
      requireCompleteRuns: true,
    },
    window: {
      complete,
      runs: selectedRuns.length,
      firstTimestamp: selectedRuns[0]?.timestamp || null,
      lastTimestamp: selectedRuns.at(-1)?.timestamp || null,
      runIds: selectedRuns.map((run) => run.runId),
    },
    bundle,
    lighthouse: {
      methods: {
        [method]: {
          [viewport]: lighthouse,
        },
      },
    },
  };
}

export function normalizePositiveInteger(value, fallback, label = 'value') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    if (value === undefined || value === null || value === '') return fallback;
    throw new Error(`${label} must be a positive integer, got ${value}`);
  }
  return parsed;
}

export function normalizeHeadroomRatio(value, fallback = DEFAULT_HEADROOM_RATIO) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    if (value === undefined || value === null || value === '') return fallback;
    throw new Error(`headroomRatio must be >= 1, got ${value}`);
  }
  return parsed;
}

function renderBudgetSuggestions(output) {
  const lines = [
    `Budget suggestions: method=${output.criteria.method}, viewport=${output.criteria.viewport}`,
    `Window: ${output.window.runs}/${output.criteria.minRuns} complete runs, complete=${output.window.complete}`,
    `Rule: ${output.criteria.suggestedBudgetRule}`,
    '',
    'Bundle suggestions:',
  ];

  for (const [budgetKey, stats] of Object.entries(output.bundle)) {
    lines.push(`- ${budgetKey}: ${stats.suggestedBudget} (p75=${stats.p75}, p95=${stats.p95}, samples=${stats.sampleCount})`);
  }

  lines.push('', 'Lighthouse suggestions:');
  const viewportBudgets = output.lighthouse.methods[output.criteria.method]?.[output.criteria.viewport] || {};
  for (const [route, routeBudgets] of Object.entries(viewportBudgets)) {
    const metrics = Object.entries(routeBudgets)
      .map(([budgetKey, stats]) => `${budgetKey}=${stats.suggestedBudget} (p95=${stats.p95})`)
      .join(', ');
    lines.push(`- ${route}: ${metrics}`);
  }

  return lines.join('\n');
}

async function main() {
  const history = await readJson(HISTORY_PATH);
  const output = buildBudgetSuggestions(history, {
    method: process.env.PERF_BUDGET_METHOD || DEFAULT_BUDGET_METHOD,
    viewport: process.env.PERF_BUDGET_VIEWPORT || DEFAULT_BUDGET_VIEWPORT,
    minRuns: Number(process.env.PERF_BUDGET_MIN_RUNS || DEFAULT_MIN_RUNS),
    headroomRatio: Number(process.env.PERF_BUDGET_HEADROOM_RATIO || DEFAULT_HEADROOM_RATIO),
    includeUnknownMethod: process.env.PERF_BUDGET_INCLUDE_UNKNOWN_METHOD === '1',
  });

  await mkdir(PERF_OUT_DIR, { recursive: true });
  await writeFile(BUDGET_SUGGESTIONS_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(renderBudgetSuggestions(output));
  console.log(`\nBudget suggestions saved to ${BUDGET_SUGGESTIONS_FILE}`);

  if (!output.window.complete) {
    console.warn('WARN: insufficient complete runs for budget hardening; do not apply these suggestions yet.');
  }
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
