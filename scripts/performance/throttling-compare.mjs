import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PERF_OUT_DIR = path.resolve('artifacts/performance');
const LIGHTHOUSE_SUMMARY_FILE = path.join(PERF_OUT_DIR, 'lighthouse', 'summary.json');
const COMPARISON_FILE = path.join(PERF_OUT_DIR, 'throttling-comparison.json');

export const METHODS = ['simulate', 'devtools'];
export const RUNS_PER_COMBO = 3;
export const METRIC_KEYS = [
  'performanceScore',
  'fcp',
  'lcp',
  'speedIndex',
  'tbt',
  'cls',
  'inp',
];

function round(value, decimals = 3) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function createEmptyMetrics() {
  return Object.fromEntries(METRIC_KEYS.map((key) => [key, null]));
}

function sanitizeMetricValue(value, decimals = 3) {
  return round(Number(value), decimals);
}

export function createLighthouseInvocation(method) {
  return {
    cmd: 'npm',
    args: ['run', 'perf:lighthouse'],
    options: {
      stdio: 'pipe',
      env: {
        ...process.env,
        LIGHTHOUSE_THROTTLING: method,
      },
    },
  };
}

export function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (numericValues.length === 0) return null;

  const clampedRatio = Math.min(1, Math.max(0, Number(ratio)));
  const index = Math.max(0, Math.ceil(clampedRatio * numericValues.length) - 1);
  return numericValues[index];
}

export function extractMetricsFromReport(report) {
  return {
    performanceScore: sanitizeMetricValue(Number(report?.categories?.performance?.score ?? NaN), 3),
    fcp: sanitizeMetricValue(report?.audits?.['first-contentful-paint']?.numericValue, 3),
    lcp: sanitizeMetricValue(report?.audits?.['largest-contentful-paint']?.numericValue, 3),
    speedIndex: sanitizeMetricValue(report?.audits?.['speed-index']?.numericValue, 3),
    tbt: sanitizeMetricValue(report?.audits?.['total-blocking-time']?.numericValue, 3),
    cls: sanitizeMetricValue(report?.audits?.['cumulative-layout-shift']?.numericValue, 6),
    inp: sanitizeMetricValue(report?.audits?.['interaction-to-next-paint']?.numericValue, 3),
  };
}

export function summarizeMetricSamples(samples) {
  const summary = {
    sampleCount: Array.isArray(samples) ? samples.length : 0,
    p50: createEmptyMetrics(),
    p75: createEmptyMetrics(),
  };

  for (const metricKey of METRIC_KEYS) {
    const values = (samples || [])
      .map((sample) => sample?.metrics?.[metricKey])
      .filter((value) => Number.isFinite(value));
    const decimals = metricKey === 'cls' ? 6 : 3;
    summary.p50[metricKey] = round(percentile(values, 0.5), decimals);
    summary.p75[metricKey] = round(percentile(values, 0.75), decimals);
  }

  return summary;
}

export function computeDeltaMetrics(leftMetrics, rightMetrics) {
  const delta = createEmptyMetrics();

  for (const metricKey of METRIC_KEYS) {
    const leftValue = leftMetrics?.[metricKey];
    const rightValue = rightMetrics?.[metricKey];
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      delta[metricKey] = null;
      continue;
    }
    const decimals = metricKey === 'cls' ? 6 : 3;
    delta[metricKey] = round(leftValue - rightValue, decimals);
  }

  return delta;
}

function createMethodAggregate() {
  return {
    totalRuns: 0,
    okRuns: 0,
    partialRuns: 0,
    failedRuns: 0,
    skippedRuns: 0,
    sampleCount: 0,
    percentiles: {
      p50: createEmptyMetrics(),
      p75: createEmptyMetrics(),
    },
  };
}

function createComparisonEntry(route, viewport, methods) {
  return {
    route,
    viewport,
    methods: Object.fromEntries(methods.map((method) => [method, createMethodAggregate()])),
    delta: {
      direction: 'simulate-minus-devtools',
      available: false,
      p50: createEmptyMetrics(),
      p75: createEmptyMetrics(),
    },
  };
}

export function aggregateComparisonData(runMatrix, methods = METHODS) {
  const comparisons = new Map();

  for (const run of runMatrix || []) {
    for (const sample of run?.samples || []) {
      const key = `${sample.route}::${sample.viewport}`;
      if (!comparisons.has(key)) {
        comparisons.set(key, createComparisonEntry(sample.route, sample.viewport, methods));
      }
    }
  }

  for (const entry of comparisons.values()) {
    for (const method of methods) {
      const relevantRuns = (runMatrix || []).filter((run) => run.method === method);
      const methodAggregate = entry.methods[method];
      methodAggregate.totalRuns = relevantRuns.length;

      for (const run of relevantRuns) {
        if (run.status === 'ok') methodAggregate.okRuns += 1;
        if (run.status === 'partial') methodAggregate.partialRuns += 1;
        if (run.status === 'failed') methodAggregate.failedRuns += 1;
        if (run.status === 'skipped') methodAggregate.skippedRuns += 1;
      }

      const methodSamples = relevantRuns
        .flatMap((run) => run.samples || [])
        .filter((sample) => sample.route === entry.route && sample.viewport === entry.viewport);

      const sampleSummary = summarizeMetricSamples(methodSamples);
      methodAggregate.sampleCount = sampleSummary.sampleCount;
      methodAggregate.percentiles = {
        p50: sampleSummary.p50,
        p75: sampleSummary.p75,
      };
    }

    const simulate = entry.methods.simulate;
    const devtools = entry.methods.devtools;
    if (simulate?.sampleCount > 0 && devtools?.sampleCount > 0) {
      entry.delta.available = true;
      entry.delta.p50 = computeDeltaMetrics(simulate.percentiles.p50, devtools.percentiles.p50);
      entry.delta.p75 = computeDeltaMetrics(simulate.percentiles.p75, devtools.percentiles.p75);
    }
  }

  return [...comparisons.values()].sort((left, right) => {
    if (left.route === right.route) {
      return left.viewport.localeCompare(right.viewport);
    }
    return left.route.localeCompare(right.route);
  });
}

export function buildComparisonOutput({ generatedAt, methods = METHODS, runsPerCombo = RUNS_PER_COMBO, runMatrix }) {
  return {
    generatedAt,
    methods,
    runsPerCombo,
    metrics: METRIC_KEYS,
    runMatrix,
    comparisons: aggregateComparisonData(runMatrix, methods),
  };
}

async function readJson(filePath) {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents);
}

async function maybeReadJson(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

export async function readSuccessfulSamples(summary) {
  const samples = [];

  for (const result of summary?.results || []) {
    if (!result?.ok || !result?.jsonPath) continue;

    const report = await maybeReadJson(result.jsonPath);
    if (!report) continue;

    samples.push({
      route: result.route,
      viewport: result.viewport,
      metrics: extractMetricsFromReport(report),
      reportPath: result.jsonPath,
    });
  }

  return samples;
}

export function classifyRunStatus(exitCode, summary, samples) {
  if (exitCode !== 0) return 'failed';
  if (summary?.skippedReason) return 'skipped';

  const totalResults = Array.isArray(summary?.results) ? summary.results.length : 0;
  const okResults = Number(summary?.results?.filter((result) => result?.ok).length || 0);
  const skippedResults = Number(summary?.results?.filter((result) => result?.skipped).length || 0);

  if (okResults === 0 && skippedResults === totalResults && totalResults > 0) {
    return 'skipped';
  }
  if (okResults > 0 && okResults < totalResults) {
    return 'partial';
  }
  if (okResults > 0 || (samples || []).length > 0) {
    return 'ok';
  }
  return 'failed';
}

async function runLighthouseWithMethod(method, runIndex) {
  const invocation = createLighthouseInvocation(method);

  return new Promise((resolve) => {
    const child = spawn(invocation.cmd, invocation.args, invocation.options);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({
        method,
        runIndex,
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
    child.on('error', (error) => {
      resolve({
        method,
        runIndex,
        exitCode: 1,
        stdout,
        stderr: `${stderr}${String(error)}`,
      });
    });
  });
}

function summarizeRunResults(summary) {
  const results = Array.isArray(summary?.results) ? summary.results : [];
  return results.map((result) => ({
    route: result.route ?? null,
    viewport: result.viewport ?? null,
    ok: Boolean(result.ok),
    skipped: Boolean(result.skipped),
    reason: result.reason ?? null,
    attempts: Number(result.attempts ?? 0),
  }));
}

async function executeRun(method, runIndex) {
  const childResult = await runLighthouseWithMethod(method, runIndex);
  const summary = await maybeReadJson(LIGHTHOUSE_SUMMARY_FILE);
  const samples = summary ? await readSuccessfulSamples(summary) : [];
  const status = classifyRunStatus(childResult.exitCode, summary, samples);

  return {
    method,
    runIndex,
    status,
    exitCode: childResult.exitCode,
    skippedReason: summary?.skippedReason ?? null,
    throttlingMethod: summary?.throttlingMethod ?? method,
    successfulSampleCount: samples.length,
    summaryResults: summarizeRunResults(summary),
    samples,
    stdout: childResult.stdout,
    stderr: childResult.stderr,
  };
}

async function main() {
  console.log(`Starting throttling comparison: ${RUNS_PER_COMBO} runs per method`);

  const runMatrix = [];
  for (const method of METHODS) {
    console.log(`\n=== Method: ${method} ===`);
    for (let runIndex = 1; runIndex <= RUNS_PER_COMBO; runIndex += 1) {
      console.log(`Run ${runIndex}/${RUNS_PER_COMBO}...`);
      const run = await executeRun(method, runIndex);
      runMatrix.push(run);
      console.log(
        `  -> status=${run.status}, exit=${run.exitCode}, samples=${run.successfulSampleCount}` +
        (run.skippedReason ? `, skippedReason=${run.skippedReason}` : ''),
      );
    }
  }

  const output = buildComparisonOutput({
    generatedAt: new Date().toISOString(),
    runMatrix,
  });

  await mkdir(PERF_OUT_DIR, { recursive: true });
  await writeFile(COMPARISON_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`\nComparison saved to ${COMPARISON_FILE}`);
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
