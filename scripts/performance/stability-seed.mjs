import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PERF_OUT_DIR = path.resolve('artifacts/performance');
const STABILITY_SEED_FILE = path.join(PERF_OUT_DIR, 'stability-seed.json');

export const DEFAULT_STABILITY_RUNS = 10;
export const DEFAULT_STABILITY_METHOD = 'simulate';
export const VALID_STABILITY_METHODS = ['simulate', 'devtools'];

export function normalizePositiveInteger(value, fallback, label = 'value') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    if (value === undefined || value === null || value === '') return fallback;
    throw new Error(`${label} must be a positive integer, got ${value}`);
  }
  return parsed;
}

export function normalizeStabilityMethod(value = DEFAULT_STABILITY_METHOD) {
  const method = value || DEFAULT_STABILITY_METHOD;
  if (!VALID_STABILITY_METHODS.includes(method)) {
    throw new Error(`Invalid stability throttling method: ${method}. Expected simulate|devtools.`);
  }
  return method;
}

export function resolveStabilityConfig(env = process.env) {
  return {
    runs: normalizePositiveInteger(env.PERF_STABILITY_RUNS, DEFAULT_STABILITY_RUNS, 'PERF_STABILITY_RUNS'),
    method: normalizeStabilityMethod(env.LIGHTHOUSE_THROTTLING || env.PERF_STABILITY_METHOD),
    runBundle: env.PERF_STABILITY_SKIP_BUNDLE !== '1',
    runWarmup: env.PERF_STABILITY_SKIP_WARMUP !== '1',
  };
}

export function createStabilityInvocations({ runs, method, runBundle = true, runWarmup = true }) {
  const invocations = [];

  if (runBundle) {
    invocations.push({
      label: 'bundle',
      runIndex: 0,
      cmd: 'npm',
      args: ['run', 'perf:bundle'],
      env: {},
      writesHistory: false,
    });
  }

  if (runWarmup) {
    invocations.push({
      label: 'warmup',
      runIndex: 0,
      cmd: 'npm',
      args: ['run', 'perf:lighthouse'],
      env: {
        LIGHTHOUSE_THROTTLING: method,
      },
      writesHistory: false,
    });
  }

  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    invocations.push({
      label: `lighthouse-${runIndex}`,
      runIndex,
      cmd: 'npm',
      args: ['run', 'perf:lighthouse'],
      env: {
        LIGHTHOUSE_THROTTLING: method,
      },
      writesHistory: false,
    });
    invocations.push({
      label: `validate-${runIndex}`,
      runIndex,
      cmd: 'npm',
      args: ['run', 'perf:validate'],
      env: {
        LIGHTHOUSE_THROTTLING: method,
      },
      writesHistory: true,
    });
  }

  return invocations;
}

export function buildStabilityVerification({ config, results }) {
  const expectedInvocations = createStabilityInvocations(config);
  const expectedLabels = expectedInvocations.map((step) => step.label);
  const actualLabels = results.map((step) => step.label);
  const orderOk = actualLabels.every((label, index) => label === expectedLabels[index]);
  const sequenceComplete = actualLabels.length === expectedLabels.length;
  const historyWrites = results.filter((result) => result.writesHistory).length;
  const historyWriteLabels = results.filter((result) => result.writesHistory).map((result) => result.label);
  const warmupStep = results.find((result) => result.label === 'warmup') || null;
  const bundleStep = results.find((result) => result.label === 'bundle') || null;
  const historyWritesOnlyValidate = historyWriteLabels.every((label) => /^validate-\d+$/.test(label));
  const historyWritesMatchExpected = historyWrites === config.runs;
  const warmupHistoryWriteDetected = warmupStep?.writesHistory === true;

  return {
    expectedLabels,
    actualLabels,
    orderOk,
    sequenceComplete,
    bundlePresent: config.runBundle ? Boolean(bundleStep) : true,
    warmupPresent: config.runWarmup ? Boolean(warmupStep) : true,
    historyWritesOnlyValidate,
    expectedHistoryWrites: config.runs,
    actualHistoryWrites: historyWrites,
    historyWritesMatchExpected,
    warmupHistoryWriteDetected,
    ready:
      orderOk &&
      sequenceComplete &&
      (config.runBundle ? Boolean(bundleStep) : true) &&
      (config.runWarmup ? Boolean(warmupStep) : true) &&
      historyWritesOnlyValidate &&
      historyWritesMatchExpected &&
      !warmupHistoryWriteDetected,
  };
}

export function summarizeStabilityResults({ generatedAt, config, results }) {
  const failed = results.filter((result) => result.exitCode !== 0);
  return {
    generatedAt,
    config,
    status: failed.length === 0 ? 'ok' : 'failed',
    totalSteps: results.length,
    failedSteps: failed.length,
    historyWrites: results.filter((result) => result.writesHistory).length,
    verification: buildStabilityVerification({ config, results }),
    results,
  };
}

async function runInvocation(invocation) {
  const startedAt = new Date().toISOString();
  const result = await new Promise((resolve) => {
    const child = spawn(invocation.cmd, invocation.args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...invocation.env,
      },
    });

    child.on('close', (code) => resolve({ exitCode: code ?? 1 }));
    child.on('error', (error) => resolve({ exitCode: 1, error: String(error) }));
  });

  return {
    label: invocation.label,
    runIndex: invocation.runIndex,
    cmd: invocation.cmd,
    args: invocation.args,
    writesHistory: invocation.writesHistory,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...result,
  };
}

async function main() {
  const config = resolveStabilityConfig();
  const invocations = createStabilityInvocations(config);
  const results = [];

  console.log(
    `Starting performance stability seed: runs=${config.runs}, method=${config.method}, bundle=${config.runBundle ? 'yes' : 'no'}, warmup=${config.runWarmup ? 'yes' : 'no'}`,
  );
  console.log('History integrity: only perf:validate writes history; this runner does not edit history.json directly.');

  for (const invocation of invocations) {
    console.log(`\n=== ${invocation.label} ===`);
    const result = await runInvocation(invocation);
    results.push(result);
    if (result.exitCode !== 0) {
      console.warn(`WARN: ${invocation.label} failed with exit ${result.exitCode}; stopping stability seed.`);
      break;
    }
  }

  const output = summarizeStabilityResults({
    generatedAt: new Date().toISOString(),
    config,
    results,
  });

  await mkdir(PERF_OUT_DIR, { recursive: true });
  await writeFile(STABILITY_SEED_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`\nStability seed summary saved to ${STABILITY_SEED_FILE}`);

  if (output.status !== 'ok') {
    process.exitCode = 1;
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
