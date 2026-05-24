import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUS_PATH = path.resolve('artifacts/performance/status.json');
const SUMMARY_PATH = path.resolve('artifacts/performance/lighthouse/summary.json');
const BUNDLE_REPORT_PATH = path.resolve('artifacts/performance/bundle/bundle-report.json');
const BASELINE_PATH = path.resolve('scripts/performance/baseline.json');
const SUMMARY_MD_PATH = path.resolve('artifacts/performance/summary.md');
const HISTORY_PATH = path.resolve('artifacts/performance/history.json');
const READINESS_PATH = path.resolve('artifacts/performance/readiness.json');
const OBSERVATION_PATH = path.resolve('artifacts/performance/observation.json');
const STABILITY_SEED_PATH = path.resolve('artifacts/performance/stability-seed.json');
const LEGACY_ENFORCE = process.env.PERF_ENFORCE_LIGHTHOUSE === '1';
const ENFORCEMENT_LEVEL = (
  process.env.PERF_ENFORCEMENT_LEVEL ||
  (LEGACY_ENFORCE ? 'strict' : 'warn')
).toLowerCase();
const VALID_LEVELS = new Set(['warn', 'soft', 'strict']);
const HISTORY_MAX_ENTRIES = Math.max(10, Number(process.env.PERF_HISTORY_MAX_ENTRIES || 200));
const READINESS_MIN_RUNS = Math.max(1, Number(process.env.PERF_READINESS_MIN_RUNS || 10));
const READINESS_MAX_WARNING_RATE = Math.min(
  1,
  Math.max(0, Number(process.env.PERF_READINESS_MAX_WARNING_RATE || 0.1)),
);
const OBSERVATION_MIN_GREEN_RUNS = Math.max(1, Number(process.env.PERF_OBSERVATION_MIN_GREEN_RUNS || 5));
const OBSERVATION_EXPECTED_RUNS = Math.max(1, Number(process.env.PERF_OBSERVATION_EXPECTED_RUNS || 9));
const OBSERVATION_METHOD = String(process.env.PERF_OBSERVATION_METHOD || 'simulate');
const OBSERVATION_STABILITY_RUNS = Math.max(1, Number(process.env.PERF_OBSERVATION_STABILITY_RUNS || 10));
const TARGET_VIEWPORT = 'mobile-375x812';
const TARGET_ROUTES = ['/', '/shopping', '/recipe/1'];
const TARGET_METRICS = [
  { key: 'lcp', auditId: 'largest-contentful-paint' },
  { key: 'inp', auditId: 'interaction-to-next-paint' },
  { key: 'cls', auditId: 'cumulative-layout-shift' },
];

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readJsonArray(filePath) {
  if (!(await exists(filePath))) return [];
  const parsed = await readJson(filePath);
  return Array.isArray(parsed) ? parsed : [];
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

export function getFailureExitCode(enforcementLevel) {
  return enforcementLevel === 'warn' ? 0 : 1;
}

export function normalizeMetricValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function resolveBundleBudgetChecks(bundleReport, baseline) {
  const totals = bundleReport?.totals || {};
  const limits = baseline?.bundle?.limits || {};
  const largestJsAssetBytes = Number(bundleReport?.largestJsAsset?.bytes || 0);
  return [
    ['files', Number(totals.files || 0), Number(limits.maxFiles || 0)],
    ['totalBytes', Number(totals.totalBytes || 0), Number(limits.maxTotalBytes || 0)],
    ['jsBytes', Number(totals.jsBytes || 0), Number(limits.maxJsBytes || 0)],
    ['gzipJsBytes', Number(totals.gzipJsBytes || 0), Number(limits.maxGzipJsBytes || 0)],
    ['cssBytes', Number(totals.cssBytes || 0), Number(limits.maxCssBytes || 0)],
    ['htmlBytes', Number(totals.htmlBytes || 0), Number(limits.maxHtmlBytes || 0)],
    ['largestJsAssetBytes', largestJsAssetBytes, Number(limits.maxLargestJsAssetBytes || 0)],
  ];
}

export function findRouteBudget(baseline, method, viewport, route) {
  if (!baseline?.lighthouse || !viewport || !route) return null;
  const methodScoped = baseline.lighthouse.methods?.[method]?.[viewport]?.[route];
  if (methodScoped && typeof methodScoped === 'object') return methodScoped;
  const aliasScoped = baseline.lighthouse.byMethod?.[method]?.[viewport]?.[route];
  if (aliasScoped && typeof aliasScoped === 'object') return aliasScoped;
  const legacyScoped = baseline.lighthouse?.[viewport]?.[route];
  if (legacyScoped && typeof legacyScoped === 'object') return legacyScoped;
  return null;
}

export function extractJsExecutionMetric({ report = null, summaryMetric = null, historyMetric = null } = {}) {
  const directCandidates = [
    summaryMetric?.jsExecutionMs,
    summaryMetric?.bootupTimeMs,
    summaryMetric?.bootupTime,
    summaryMetric?.jsExecution,
    historyMetric?.jsExecutionMs,
    historyMetric?.bootupTimeMs,
    historyMetric?.bootupTime,
    historyMetric?.jsExecution,
    report?.audits?.['bootup-time']?.numericValue,
    report?.audits?.['script-evaluation']?.numericValue,
    report?.audits?.['mainthread-work-breakdown']?.numericValue,
  ];

  for (const candidate of directCandidates) {
    const value = normalizeMetricValue(candidate);
    if (value !== null) return value;
  }

  return null;
}

export function extractLighthouseMetrics({ report = null, summaryMetric = null, historyMetric = null } = {}) {
  return {
    lcpMs: normalizeMetricValue(report?.audits?.['largest-contentful-paint']?.numericValue),
    cls: normalizeMetricValue(report?.audits?.['cumulative-layout-shift']?.numericValue),
    jsExecutionMs: extractJsExecutionMetric({ report, summaryMetric, historyMetric }),
  };
}

export function createFinding(type, message, metadata = {}) {
  return {
    type,
    message,
    ...metadata,
  };
}

export function evaluateLighthouseBudgetFindings({ budget, metrics, route, viewport }) {
  const checks = [
    {
      metricKey: 'lcpMs',
      budgetKey: 'lcpMs',
      label: 'LCP',
      value: metrics?.lcpMs,
      formatter: (value) => `${Math.round(value)}ms`,
    },
    {
      metricKey: 'cls',
      budgetKey: 'cls',
      label: 'CLS',
      value: metrics?.cls,
      formatter: (value) => value.toFixed(3),
    },
    {
      metricKey: 'jsExecutionMs',
      budgetKey: 'jsExecutionMs',
      label: 'JS execution',
      value: metrics?.jsExecutionMs,
      formatter: (value) => `${Math.round(value)}ms`,
    },
  ];

  const findings = [];
  for (const check of checks) {
    const limit = normalizeMetricValue(budget?.[check.budgetKey]);
    const value = normalizeMetricValue(check.value);
    if (limit === null || limit <= 0) continue;
    if (value === null) {
      findings.push(
        createFinding(
          'metric-unavailable',
          `WARN: ${check.label} metric unavailable for ${route} @ ${viewport} with an active ${check.budgetKey} budget.`,
          { route, viewport, metricKey: check.metricKey, budgetKey: check.budgetKey, limit },
        ),
      );
      continue;
    }
    if (value > limit) {
      findings.push(
        createFinding(
          'metric-budget',
          `WARN: ${check.label} budget exceeded for ${route} @ ${viewport} ` +
            `(${check.formatter(value)} > ${check.formatter(limit)}).`,
          { route, viewport, metricKey: check.metricKey, budgetKey: check.budgetKey, value, limit },
        ),
      );
    }
  }

  return findings;
}

export function isBudgetFinding(finding) {
  if (finding && typeof finding === 'object') {
    return ['bundle', 'metric-budget', 'metric-unavailable'].includes(String(finding.type || ''));
  }
  const message = finding;
  return (
    typeof message === 'string' &&
    (
      message.includes('budget exceeded') ||
      message.includes('baseline exceeded') ||
      message.includes('metric unavailable')
    )
  );
}

export function determineValidationOutcome({
  enforcementLevel,
  findingDetails,
  readiness,
} = {}) {
  const findings = Array.isArray(findingDetails) ? findingDetails : [];
  const readinessReady = readiness?.ready === true;
  const hardFailureTypes = new Set([
    'invalid-config',
    'status-integrity',
    'summary-integrity',
    'lighthouse-integrity',
    'route-availability',
    'baseline-integrity',
    'bundle-report-integrity',
    'artifact-integrity',
    'bundle',
    'metric-unavailable',
    'soft-policy',
    'strict-policy',
  ]);
  const hardFailures = findings.filter((finding) => hardFailureTypes.has(String(finding?.type || '')));
  const metricBudgetFailures = findings.filter((finding) => String(finding?.type || '') === 'metric-budget');

  if (enforcementLevel === 'warn') {
    return { exitCode: 0, classification: 'warn_only' };
  }

  if (hardFailures.length > 0) {
    return { exitCode: 1, classification: 'failed' };
  }

  if (enforcementLevel === 'soft') {
    return {
      exitCode: metricBudgetFailures.length > 0 ? 1 : 0,
      classification: metricBudgetFailures.length > 0 ? 'failed' : 'passed',
    };
  }

  if (metricBudgetFailures.length > 0) {
    return readinessReady
      ? { exitCode: 1, classification: 'failed' }
      : { exitCode: 0, classification: 'observation_blocked' };
  }

  if (!readinessReady) {
    return { exitCode: 0, classification: 'observation_blocked' };
  }

  return { exitCode: 0, classification: 'passed' };
}

export function createPerformanceRunId({
  explicitRunId = process.env.PERF_RUN_ID,
  githubRunId = process.env.GITHUB_RUN_ID,
  githubRunAttempt = process.env.GITHUB_RUN_ATTEMPT,
  statusGeneratedAt = null,
  summaryGeneratedAt = null,
  timestamp = new Date().toISOString(),
} = {}) {
  if (explicitRunId) return String(explicitRunId);

  const generatedAt = String(statusGeneratedAt || summaryGeneratedAt || timestamp);
  if (githubRunId) {
    const attempt = githubRunAttempt ? `attempt-${githubRunAttempt}` : 'attempt-unknown';
    return `${githubRunId}-${attempt}-${generatedAt}`;
  }

  return generatedAt;
}

function getRunSource(run) {
  if (run?.source) return String(run.source);
  return run?.githubRunId ? 'ci' : 'local';
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isCompleteRun(run) {
  return (
    run.lighthouse === 'ok' &&
    Number(run.expectedRuns || 0) > 0 &&
    Number(run.successfulRuns || 0) >= Number(run.expectedRuns || 0) &&
    Number(run.warningRuns || 0) === 0 &&
    Number(run.unavailableRouteCount || 0) === 0
  );
}

function buildMetricMap(run) {
  return new Map(
    (Array.isArray(run.metrics) ? run.metrics : []).map((metric) => [
      `${metric.route}::${metric.viewport}`,
      metric,
    ]),
  );
}

function evaluateReadiness(history, minRuns, maxWarningRate) {
  const ordered = [...history]
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  const consideredRuns = ordered.slice(-minRuns);
  const completeRuns = ordered.filter(isCompleteRun);
  const completeWindow = completeRuns.slice(-minRuns);
  const runs = consideredRuns.length;
  const totalWarnings = consideredRuns.reduce((acc, entry) => acc + Number(entry.warningRuns || 0), 0);
  const totalExecuted = consideredRuns.reduce((acc, entry) => acc + Number(entry.totalRuns || 0), 0);
  const warningRate = totalExecuted > 0 ? totalWarnings / totalExecuted : 1;
  let consecutiveCompleteRuns = 0;

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (!isCompleteRun(ordered[index])) break;
    consecutiveCompleteRuns += 1;
  }

  const readiness = {
    generatedAt: new Date().toISOString(),
    criteria: {
      minRuns,
      maxWarningRate,
      requireFullCoverage: true,
      requireMetricStability: true,
      metricSpreadLimit: 0.1,
      targetViewport: TARGET_VIEWPORT,
      targetRoutes: TARGET_ROUTES,
    },
    window: {
      runs,
      firstTimestamp: consideredRuns[0]?.timestamp || null,
      lastTimestamp: consideredRuns.at(-1)?.timestamp || null,
      runIds: consideredRuns.map((entry) => entry.runId),
    },
    stats: {
      totalWarnings,
      totalExecuted,
      warningRate: round(warningRate, 4),
      fullCoverageCount: consideredRuns.filter(isCompleteRun).length,
      consecutiveCompleteRuns,
    },
    checks: {
      minRunsMet: runs >= minRuns,
      warningRateMet: warningRate <= maxWarningRate,
      fullCoverageMet: consideredRuns.length > 0 && consideredRuns.every(isCompleteRun),
      metricStabilityMet: false,
    },
    metrics: [],
    ready: false,
  };

  if (completeWindow.length >= minRuns) {
    const groups = [];
    for (const route of TARGET_ROUTES) {
      const routeKey = `${route}::${TARGET_VIEWPORT}`;
      const series = completeWindow
        .map(buildMetricMap)
        .map((metricMap) => metricMap.get(routeKey))
        .filter(Boolean);

      if (series.length < minRuns) {
        groups.push({ route, viewport: TARGET_VIEWPORT, missing: true, checks: [] });
        continue;
      }

      const checks = [];
      for (const metric of TARGET_METRICS) {
        const values = series
          .map((entry) => entry[metric.key])
          .filter((value) => Number.isFinite(value));
        if (values.length < minRuns) {
          checks.push({ metric: metric.key, available: false });
          continue;
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        const med = median(values);
        const spreadRatio = med && med !== 0 ? (max - min) / Math.abs(med) : 0;
        checks.push({
          metric: metric.key,
          available: true,
          min: round(min, 4),
          max: round(max, 4),
          median: round(med, 4),
          spreadRatio: round(spreadRatio, 4),
          stable: spreadRatio <= 0.1,
        });
      }
      groups.push({ route, viewport: TARGET_VIEWPORT, missing: false, checks });
    }

    readiness.metrics = groups;
    readiness.checks.metricStabilityMet = groups.every(
      (group) =>
        group.missing !== true &&
        group.checks.every((check) => check.available === false || check.stable === true),
    );
  }

  readiness.ready = Object.values(readiness.checks).every(Boolean);
  return readiness;
}

export function isObservationGreenRun(run, {
  expectedRuns = OBSERVATION_EXPECTED_RUNS,
  method = OBSERVATION_METHOD,
} = {}) {
  return (
    getRunSource(run) === 'ci' &&
    run?.enforcementLevel === 'warn' &&
    run?.mode === 'warn-only' &&
    run?.lighthouse === 'ok' &&
    String(run?.throttlingMethod || '') === method &&
    Number(run?.expectedRuns || 0) === expectedRuns &&
    Number(run?.successfulRuns || 0) === expectedRuns &&
    Number(run?.warningRuns || 0) === 0 &&
    Number(run?.unavailableRouteCount || 0) === 0 &&
    Number(run?.findingsCount || 0) === 0 &&
    run?.budgetPass === true &&
    Number(run?.validateExitCode || 0) === 0
  );
}

export function evaluateStabilitySeedVerification(seed, {
  requiredRuns = OBSERVATION_STABILITY_RUNS,
  requiredMethod = OBSERVATION_METHOD,
} = {}) {
  if (!seed || typeof seed !== 'object') {
    return {
      available: false,
      ready: false,
      blockers: ['stability-seed.json is missing.'],
    };
  }

  const config = seed.config && typeof seed.config === 'object' ? seed.config : {};
  const results = Array.isArray(seed.results) ? seed.results : [];
  const derivedExpectedLabels = [];

  if (config.runBundle !== false) derivedExpectedLabels.push('bundle');
  if (config.runWarmup !== false) derivedExpectedLabels.push('warmup');
  for (let index = 1; index <= Number(config.runs || 0); index += 1) {
    derivedExpectedLabels.push(`lighthouse-${index}`);
    derivedExpectedLabels.push(`validate-${index}`);
  }

  const actualLabels = results.map((result) => result.label);
  const verification = seed.verification && typeof seed.verification === 'object'
    ? seed.verification
    : {};
  const expectedLabels = Array.isArray(verification.expectedLabels)
    ? verification.expectedLabels
    : derivedExpectedLabels;
  const orderOk =
    verification.orderOk === true ||
    actualLabels.every((label, index) => label === expectedLabels[index]);
  const sequenceComplete =
    verification.sequenceComplete === true ||
    actualLabels.length === expectedLabels.length;
  const historyWritesOnlyValidate =
    verification.historyWritesOnlyValidate === true ||
    results
      .filter((result) => result.writesHistory)
      .every((result) => /^validate-\d+$/.test(String(result.label || '')));
  const actualHistoryWrites = Number(
    verification.actualHistoryWrites ?? results.filter((result) => result.writesHistory).length,
  );
  const expectedHistoryWrites = Number(verification.expectedHistoryWrites ?? config.runs ?? 0);
  const historyWritesMatchExpected =
    verification.historyWritesMatchExpected === true ||
    actualHistoryWrites === expectedHistoryWrites;
  const warmupHistoryWriteDetected =
    verification.warmupHistoryWriteDetected === true ||
    results.some((result) => result.label === 'warmup' && result.writesHistory === true);
  const bundlePresent =
    verification.bundlePresent !== undefined
      ? verification.bundlePresent === true
      : actualLabels.includes('bundle');
  const warmupPresent =
    verification.warmupPresent !== undefined
      ? verification.warmupPresent === true
      : actualLabels.includes('warmup');

  const blockers = [];
  if (seed.status !== 'ok') blockers.push(`stability seed status is ${String(seed.status || 'unknown')}.`);
  if (Number(config.runs || 0) < requiredRuns) blockers.push(`stability seed has ${Number(config.runs || 0)} runs; need ${requiredRuns}.`);
  if (String(config.method || '') !== requiredMethod) {
    blockers.push(`stability seed method is ${String(config.method || 'unknown')}; need ${requiredMethod}.`);
  }
  if (config.runBundle === false || !bundlePresent) blockers.push('stability seed bundle step is missing.');
  if (config.runWarmup === false || !warmupPresent) blockers.push('stability seed warmup step is missing.');
  if (!orderOk) blockers.push('stability seed step order is inconsistent.');
  if (!sequenceComplete) blockers.push('stability seed did not finish the full step sequence.');
  if (!historyWritesOnlyValidate) blockers.push('stability seed wrote history outside validate-* steps.');
  if (!historyWritesMatchExpected) {
    blockers.push(`stability seed history writes are ${actualHistoryWrites}/${expectedHistoryWrites}.`);
  }
  if (warmupHistoryWriteDetected) blockers.push('stability seed warmup wrote history unexpectedly.');

  return {
    available: true,
    status: String(seed.status || 'unknown'),
    method: String(config.method || ''),
    runs: Number(config.runs || 0),
    bundlePresent,
    warmupPresent,
    orderOk,
    sequenceComplete,
    historyWritesOnlyValidate,
    expectedHistoryWrites,
    actualHistoryWrites,
    historyWritesMatchExpected,
    warmupHistoryWriteDetected,
    ready: blockers.length === 0,
    blockers,
  };
}

export function evaluateStrictObservation({
  history,
  readiness,
  stabilitySeed,
  requiredGreenRuns = OBSERVATION_MIN_GREEN_RUNS,
  expectedRuns = OBSERVATION_EXPECTED_RUNS,
  method = OBSERVATION_METHOD,
  requiredStabilityRuns = OBSERVATION_STABILITY_RUNS,
} = {}) {
  const orderedHistory = [...(Array.isArray(history) ? history : [])]
    .filter((entry) => entry && typeof entry === 'object')
    .sort((left, right) => String(left.timestamp || '').localeCompare(String(right.timestamp || '')));
  const ciWarnRuns = collapseObservationRuns(orderedHistory.filter(
    (run) => getRunSource(run) === 'ci' && String(run.enforcementLevel || '') === 'warn',
  ));
  const recentCiWarnRuns = ciWarnRuns.slice(-requiredGreenRuns);
  const recentStatuses = recentCiWarnRuns.map((run) => ({
    runId: run.runId,
    timestamp: run.timestamp || null,
    green: isObservationGreenRun(run, { expectedRuns, method }),
    budgetPass: run.budgetPass === true,
    findingsCount: Number(run.findingsCount || 0),
    lighthouse: String(run.lighthouse || 'unknown'),
  }));

  let consecutiveGreenRuns = 0;
  for (let index = ciWarnRuns.length - 1; index >= 0; index -= 1) {
    if (!isObservationGreenRun(ciWarnRuns[index], { expectedRuns, method })) break;
    consecutiveGreenRuns += 1;
  }

  const seedVerification = evaluateStabilitySeedVerification(stabilitySeed, {
    requiredRuns: requiredStabilityRuns,
    requiredMethod: method,
  });
  const blockers = [];
  if (recentCiWarnRuns.length < requiredGreenRuns) {
    blockers.push(`Only ${recentCiWarnRuns.length}/${requiredGreenRuns} warn-mode CI runs are available for observation.`);
  }
  if (consecutiveGreenRuns < requiredGreenRuns) {
    blockers.push(`Only ${consecutiveGreenRuns}/${requiredGreenRuns} consecutive green warn-mode CI runs are available.`);
  }
  if (readiness?.ready !== true) {
    blockers.push(
      `readiness.ready is ${readiness?.ready === true ? 'true' : 'false'}${
        readiness?.checks?.metricStabilityMet === false ? ' (metric stability still waiting).' : '.'
      }`,
    );
  }
  blockers.push(...(seedVerification.blockers || []));

  return {
    generatedAt: new Date().toISOString(),
    criteria: {
      requiredGreenRuns,
      expectedRuns,
      method,
      requiredStabilityRuns,
      requireReadinessReady: true,
      requireWarmupVerification: true,
      scope: 'warn-mode CI runs',
    },
    runs: {
      ciWarnRuns: ciWarnRuns.length,
      consecutiveGreenRuns,
      greenRunCriteriaMet: consecutiveGreenRuns >= requiredGreenRuns,
      recentRunIds: recentCiWarnRuns.map((run) => run.runId),
      recentStatuses,
    },
    readiness: {
      available: Boolean(readiness),
      ready: readiness?.ready === true,
      metricStabilityMet: readiness?.checks?.metricStabilityMet === true,
      windowRuns: Number(readiness?.window?.runs || 0),
      lastTimestamp: readiness?.window?.lastTimestamp || null,
    },
    warmupSeed: seedVerification,
    blockers,
    strictProbeEligible:
      consecutiveGreenRuns >= requiredGreenRuns &&
      readiness?.ready === true &&
      seedVerification.ready === true,
  };
}

export function collapseObservationRuns(runs) {
  const orderedRuns = [...(Array.isArray(runs) ? runs : [])]
    .filter((run) => run && typeof run === 'object')
    .sort((left, right) => String(left.timestamp || '').localeCompare(String(right.timestamp || '')));
  const byGithubRunId = new Map();
  const passthroughRuns = [];

  for (const run of orderedRuns) {
    const githubRunId = run.githubRunId ? String(run.githubRunId) : null;
    if (!githubRunId) {
      passthroughRuns.push(run);
      continue;
    }

    const previous = byGithubRunId.get(githubRunId);
    const previousAttempt = Number(previous?.runAttempt || 0);
    const nextAttempt = Number(run.runAttempt || 0);
    if (
      !previous ||
      nextAttempt > previousAttempt ||
      (nextAttempt === previousAttempt && String(run.timestamp || '') >= String(previous.timestamp || ''))
    ) {
      byGithubRunId.set(githubRunId, run);
    }
  }

  return [...passthroughRuns, ...byGithubRunId.values()].sort(
    (left, right) => String(left.timestamp || '').localeCompare(String(right.timestamp || '')),
  );
}

function renderHistorySection(readiness, latestRun = null) {
  const lines = [
    'Runs stored: ' + readiness.window.runs,
    'Consecutive complete runs: ' + readiness.stats.consecutiveCompleteRuns,
    'Warning rate: ' + `${(Number(readiness.stats.warningRate || 0) * 100).toFixed(1)}%`,
    'Ready for stricter baseline gating: ' + (readiness.ready ? 'yes' : 'no'),
    '',
    '- Min runs met: ' + (readiness.checks.minRunsMet ? 'OK' : 'WAIT'),
    '- Warning rate <= 10%: ' + (readiness.checks.warningRateMet ? 'OK' : 'WAIT'),
    '- Full coverage window: ' + (readiness.checks.fullCoverageMet ? 'OK' : 'WAIT'),
    '- Metric stability <= 10% spread: ' + (readiness.checks.metricStabilityMet ? 'OK' : 'WAIT'),
  ];

  if (readiness.metrics.length > 0) {
    lines.push('', 'Metric stability window:');
    for (const group of readiness.metrics) {
      if (group.missing) {
        lines.push(`- ${group.route} @ ${group.viewport}: missing`);
        continue;
      }
      const metricLine = group.checks
        .map((check) => {
          if (check.available === false) return `${check.metric}=n/a`;
          return `${check.metric}=${check.stable ? 'OK' : 'WARN'} (${(check.spreadRatio * 100).toFixed(1)}%)`;
        })
        .join(', ');
      lines.push(`- ${group.route} @ ${group.viewport}: ${metricLine}`);
    }
  }

  if (latestRun) {
    lines.push('', `Latest validation classification: ${latestRun.classification || 'unknown'}`);
    lines.push(`Latest budget pass: ${latestRun.budgetPass ? 'yes' : 'no'}`);
    lines.push(`Latest validate exit code: ${Number(latestRun.validateExitCode || 0)}`);
    if (latestRun.classification === 'observation_blocked') {
      lines.push('Latest strict result is informational because readiness.ready=false.');
    }
    if (Array.isArray(latestRun.findings) && latestRun.findings.length > 0) {
      lines.push('', 'Latest validation findings:');
      for (const finding of latestRun.findings) {
        lines.push(`- ${finding}`);
      }
    }
  }

  return lines.join('\n');
}

function renderObservationSection(observation) {
  const lines = [
    `Consecutive green CI runs: ${observation.runs.consecutiveGreenRuns}/${observation.criteria.requiredGreenRuns}`,
    `Readiness ready: ${observation.readiness.ready ? 'yes' : 'no'}`,
    `Warm-up seed verified: ${observation.warmupSeed.ready ? 'yes' : 'no'}`,
    `Eligible for first strict probe: ${observation.strictProbeEligible ? 'yes' : 'no'}`,
  ];

  if (observation.runs.recentStatuses.length > 0) {
    lines.push('', 'Recent CI warn-run statuses:');
    for (const status of observation.runs.recentStatuses) {
      lines.push(
        `- ${status.runId}: ${status.green ? 'green' : 'not-green'} (lighthouse=${status.lighthouse}, findings=${status.findingsCount}, budgetPass=${status.budgetPass ? 'yes' : 'no'})`,
      );
    }
  }

  if (observation.blockers.length > 0) {
    lines.push('', 'Blockers:');
    for (const blocker of observation.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  const runFindingDetails = [];
  const warnAndTrack = (findingOrMessage, fallbackType = 'status-integrity') => {
    const finding =
      findingOrMessage && typeof findingOrMessage === 'object'
        ? findingOrMessage
        : createFinding(fallbackType, String(findingOrMessage));
    console.warn(finding.message);
    runFindingDetails.push(finding);
  };

  if (!VALID_LEVELS.has(ENFORCEMENT_LEVEL)) {
    warnAndTrack(
      `WARN: invalid PERF_ENFORCEMENT_LEVEL=${ENFORCEMENT_LEVEL}; expected warn|soft|strict.`,
      'invalid-config',
    );
    process.exitCode = 1;
    return;
  }

  if (!(await exists(STATUS_PATH))) {
    warnAndTrack('WARN: performance status.json missing.', 'status-integrity');
    process.exitCode = Math.max(Number(process.exitCode || 0), getFailureExitCode(ENFORCEMENT_LEVEL));
    return;
  }

  const status = await readJson(STATUS_PATH);
  const mode = String(status.mode || 'unknown');
  const lighthouse = String(status.lighthouse || 'unknown');
  const successfulRuns = Number(status.successfulRuns || 0);
  const warningRuns = Number(status.warningRuns || 0);

  console.log(`Performance status: mode=${mode}, lighthouse=${lighthouse}, enforcement=${ENFORCEMENT_LEVEL}`);

  if (!(await exists(SUMMARY_PATH))) {
    warnAndTrack('WARN: lighthouse summary.json missing.', 'summary-integrity');
    process.exitCode = Math.max(Number(process.exitCode || 0), getFailureExitCode(ENFORCEMENT_LEVEL));
    return;
  }

  const summary = await readJson(SUMMARY_PATH);
  const routeMap = Array.isArray(summary.routeMap) ? summary.routeMap : [];
  const results = Array.isArray(summary.results) ? summary.results : [];
  const throttlingMethod = String(summary.throttlingMethod || 'simulate');
  const routeCount = routeMap.length;
  const viewportCount = Array.isArray(summary.viewports) ? summary.viewports.length : 0;
  const expectedRuns =
    Number(status.expectedRuns || 0) ||
    (routeCount > 0 && viewportCount > 0 ? routeCount * viewportCount : 0);
  const totalRuns = Number(status.totalRuns || successfulRuns + warningRuns);
  const hasAnySuccessfulData = successfulRuns > 0;
  const summarySuccessCount = results.filter((result) => result.ok).length;
  const summaryWarningCount = results.length - summarySuccessCount;
  const unavailableRoutes = routeMap.filter((entry) => entry.available === false);
  let baseline = null;
  let bundleReport = null;

  if (['skipped', 'error'].includes(lighthouse)) {
    warnAndTrack(`WARN: lighthouse status is ${lighthouse}.`, 'lighthouse-integrity');
    if (status.skippedReason) {
      warnAndTrack(`WARN: skippedReason=${status.skippedReason}`, 'lighthouse-integrity');
      warnAndTrack(`PERF_LIGHTHOUSE_SKIP_REASON=${status.skippedReason}`, 'lighthouse-integrity');
    } else if (status.skippedReasonCode) {
      warnAndTrack(`PERF_LIGHTHOUSE_SKIP_REASON=${status.skippedReasonCode}`, 'lighthouse-integrity');
    }
  }

  if (lighthouse === 'partial' && successfulRuns === 0 && warningRuns > 0) {
    warnAndTrack('WARN: NO_LIGHTHOUSE_DATA (all runs warned/skipped).', 'lighthouse-integrity');
    if (status.skippedReasonCode) {
      warnAndTrack(`PERF_LIGHTHOUSE_SKIP_REASON=${status.skippedReasonCode}`, 'lighthouse-integrity');
    }
  }

  if (results.length !== totalRuns) {
    warnAndTrack(
      `WARN: status totalRuns (${totalRuns}) does not match summary results (${results.length}).`,
      'summary-integrity',
    );
  }

  if (summarySuccessCount !== successfulRuns) {
    warnAndTrack(
      `WARN: status successfulRuns (${successfulRuns}) does not match summary successful runs (${summarySuccessCount}).`,
      'summary-integrity',
    );
  }

  if (summaryWarningCount !== warningRuns) {
    warnAndTrack(
      `WARN: status warningRuns (${warningRuns}) does not match summary warning runs (${summaryWarningCount}).`,
      'summary-integrity',
    );
  }

  if (expectedRuns > 0 && routeCount > 0 && viewportCount > 0 && expectedRuns !== routeCount * viewportCount) {
    warnAndTrack(
      `WARN: status expectedRuns (${expectedRuns}) does not match route/viewport matrix (${routeCount * viewportCount}).`,
      'summary-integrity',
    );
  }

  if (lighthouse === 'ok' && summaryWarningCount > 0) {
    warnAndTrack('WARN: lighthouse=ok but summary still contains warning/skipped results.', 'summary-integrity');
  }

  if (lighthouse === 'partial' && summaryWarningCount === 0) {
    warnAndTrack('WARN: lighthouse=partial but summary contains no warning/skipped results.', 'summary-integrity');
  }

  if (lighthouse === 'skipped' && results.length > 0) {
    warnAndTrack('WARN: lighthouse=skipped but summary contains run results.', 'summary-integrity');
  }

  if (lighthouse === 'error' && results.length > 0 && summarySuccessCount > 0) {
    warnAndTrack('WARN: lighthouse=error but summary contains successful results.', 'summary-integrity');
  }

  if (unavailableRoutes.length > 0) {
    warnAndTrack(
      `WARN: ${unavailableRoutes.length} requested route(s) were not auditable: ${unavailableRoutes
        .map((entry) => `${entry.requested} (${entry.resolution || 'unknown'})`)
        .join(', ')}`,
      'route-availability',
    );
  }

  if (!(await exists(BASELINE_PATH))) {
    warnAndTrack(`WARN: performance baseline missing at ${BASELINE_PATH}.`, 'baseline-integrity');
  } else {
    baseline = await readJson(BASELINE_PATH);
  }

  if (!(await exists(BUNDLE_REPORT_PATH))) {
    warnAndTrack('WARN: bundle report missing.', 'bundle-report-integrity');
  } else {
    bundleReport = await readJson(BUNDLE_REPORT_PATH);
  }

  for (const result of results.filter((entry) => entry.ok)) {
    if (!result.jsonPath || !(await exists(result.jsonPath))) {
      warnAndTrack(
        `WARN: successful lighthouse result is missing jsonPath artifact for ${result.route} @ ${result.viewport}.`,
        'artifact-integrity',
      );
    }
    if (!result.htmlPath || !(await exists(result.htmlPath))) {
      warnAndTrack(
        `WARN: successful lighthouse result is missing htmlPath artifact for ${result.route} @ ${result.viewport}.`,
        'artifact-integrity',
      );
    }
  }

  if (baseline && bundleReport) {
    for (const [key, value, limit] of resolveBundleBudgetChecks(bundleReport, baseline)) {
      if (limit <= 0) continue;
      if (value > limit) {
        warnAndTrack(
          createFinding('bundle', `WARN: bundle baseline exceeded for ${key} (${value} > ${limit}).`, {
            budgetKey: key,
            value,
            limit,
          }),
        );
      }
    }
  }

  const summaryMetricsByKey = new Map(
    (Array.isArray(summary.metrics) ? summary.metrics : [])
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => [`${entry.route}::${entry.viewport}`, entry]),
  );

  // Check Lighthouse metric budgets (LCP, CLS, JS execution) from baseline per route/viewport/method.
  if (baseline?.lighthouse) {
    for (const result of results.filter((r) => r.ok && r.jsonPath)) {
      const routeBudgets = findRouteBudget(
        baseline,
        result.throttlingMethod || throttlingMethod,
        result.viewport,
        result.route,
      );
      if (!routeBudgets) continue;
      let report;
      try {
        report = await readJson(result.jsonPath);
      } catch {
        continue;
      }
      const metrics = extractLighthouseMetrics({
        report,
        summaryMetric: summaryMetricsByKey.get(`${result.route}::${result.viewport}`),
      });
      for (const finding of evaluateLighthouseBudgetFindings({
        budget: routeBudgets,
        metrics,
        route: result.route,
        viewport: result.viewport,
      })) {
        warnAndTrack(finding);
      }
    }
  }

  if (ENFORCEMENT_LEVEL === 'soft') {
    if (!['ok', 'partial'].includes(lighthouse)) {
      warnAndTrack(`WARN: soft enforcement requires lighthouse=ok|partial, got ${lighthouse}.`, 'soft-policy');
    }
    if (!hasAnySuccessfulData) {
      warnAndTrack('WARN: soft enforcement requires at least one successful lighthouse run.', 'soft-policy');
    }
    if (totalRuns > 0 && successfulRuns > totalRuns) {
      warnAndTrack(`WARN: invalid run counters (${successfulRuns}/${totalRuns}).`, 'soft-policy');
    }
    if (unavailableRoutes.length > 0) {
      warnAndTrack('WARN: soft enforcement requires every requested route to be auditable.', 'soft-policy');
    }
  }

  if (ENFORCEMENT_LEVEL === 'strict') {
    if (lighthouse !== 'ok') {
      warnAndTrack(`WARN: strict enforcement requires lighthouse=ok, got ${lighthouse}.`, 'strict-policy');
    }
    if (expectedRuns > 0 && successfulRuns < expectedRuns) {
      warnAndTrack(
        `WARN: strict enforcement requires full run coverage (${successfulRuns}/${expectedRuns} successful).`,
        'strict-policy',
      );
    }
  }

  const metrics = [];
  for (const result of results.filter((entry) => entry.ok && entry.jsonPath)) {
    const report = await readJson(result.jsonPath);
    metrics.push({
      route: result.route,
      viewport: result.viewport,
      performanceScore: round(Number(report.categories?.performance?.score ?? NaN), 3),
      lcp: round(Number(report.audits?.['largest-contentful-paint']?.numericValue ?? NaN), 3),
      inp: round(Number(report.audits?.['interaction-to-next-paint']?.numericValue ?? NaN), 3),
      cls: round(Number(report.audits?.['cumulative-layout-shift']?.numericValue ?? NaN), 6),
      jsExecutionMs: round(extractJsExecutionMetric({ report }), 3),
    });
  }

  const runTimestamp = String(status.generatedAt || summary.generatedAt || new Date().toISOString());
  const findingMessages = runFindingDetails.map((finding) => finding.message);
  const baseRunRecord = {
    runId: createPerformanceRunId({
      statusGeneratedAt: status.generatedAt,
      summaryGeneratedAt: summary.generatedAt,
      timestamp: runTimestamp,
    }),
    timestamp: runTimestamp,
    source: process.env.GITHUB_RUN_ID ? 'ci' : 'local',
    githubRunId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    eventName: process.env.GITHUB_EVENT_NAME || null,
    refName: process.env.GITHUB_REF_NAME || null,
    enforcementLevel: ENFORCEMENT_LEVEL,
    mode,
    lighthouse,
    throttlingMethod,
    expectedRuns,
    totalRuns,
    successfulRuns,
    warningRuns,
    routeCount,
    viewportCount,
    unavailableRouteCount: unavailableRoutes.length,
    findingsCount: findingMessages.length,
    findings: findingMessages,
    findingDetails: runFindingDetails,
    budgetPass: !runFindingDetails.some(isBudgetFinding),
    bundle: bundleReport
      ? {
          files: Number(bundleReport.totals?.files || 0),
          totalBytes: Number(bundleReport.totals?.totalBytes || 0),
          jsBytes: Number(bundleReport.totals?.jsBytes || 0),
          gzipJsBytes: Number(bundleReport.totals?.gzipJsBytes || 0),
          cssBytes: Number(bundleReport.totals?.cssBytes || 0),
          htmlBytes: Number(bundleReport.totals?.htmlBytes || 0),
          largestJsAssetBytes: Number(bundleReport.largestJsAsset?.bytes || 0),
        }
      : null,
    metrics,
  };

  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  const history = await readJsonArray(HISTORY_PATH);
  const mergedHistory = history.filter((entry) => entry?.runId !== baseRunRecord.runId);
  mergedHistory.push(baseRunRecord);
  mergedHistory.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  let trimmedHistory = mergedHistory.slice(-HISTORY_MAX_ENTRIES);

  const readiness = evaluateReadiness(trimmedHistory, READINESS_MIN_RUNS, READINESS_MAX_WARNING_RATE);
  const outcome = determineValidationOutcome({
    enforcementLevel: ENFORCEMENT_LEVEL,
    findingDetails: runFindingDetails,
    readiness,
  });
  const runRecord = {
    ...baseRunRecord,
    classification: outcome.classification,
    observationBlocked: outcome.classification === 'observation_blocked',
    readinessReady: readiness.ready === true,
    readinessChecks: readiness.checks,
    validateExitCode: outcome.exitCode,
  };
  trimmedHistory = trimmedHistory
    .filter((entry) => entry?.runId !== runRecord.runId)
    .concat(runRecord)
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
    .slice(-HISTORY_MAX_ENTRIES);
  await writeFile(HISTORY_PATH, `${JSON.stringify(trimmedHistory, null, 2)}\n`, 'utf8');
  await writeFile(READINESS_PATH, `${JSON.stringify(readiness, null, 2)}\n`, 'utf8');
  const stabilitySeed = (await exists(STABILITY_SEED_PATH)) ? await readJson(STABILITY_SEED_PATH) : null;
  const observation = evaluateStrictObservation({
    history: trimmedHistory,
    readiness,
    stabilitySeed,
  });
  await writeFile(OBSERVATION_PATH, `${JSON.stringify(observation, null, 2)}\n`, 'utf8');

  if (await exists(SUMMARY_MD_PATH)) {
    const baseSummary = await readFile(SUMMARY_MD_PATH, 'utf8');
    const generatedSections = ['\n## Baseline History\n', '\n## Strict Gate Observation\n'];
    const markerIndex = generatedSections
      .map((marker) => baseSummary.indexOf(marker))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0] ?? -1;
    const preservedSummary = markerIndex >= 0 ? baseSummary.slice(0, markerIndex) : baseSummary;
    const nextSummary = `${preservedSummary.replace(/\s+$/, '')}\n## Baseline History\n${renderHistorySection(
      readiness,
      runRecord,
    )}\n## Strict Gate Observation\n${renderObservationSection(observation)}\n`;
    await writeFile(SUMMARY_MD_PATH, nextSummary, 'utf8');
  }

  process.exitCode = outcome.exitCode;
  console.log(
    `Performance readiness: ready=${readiness.ready} classification=${outcome.classification} runs=${readiness.window.runs}/${readiness.criteria.minRuns} warningRate=${Number(readiness.stats.warningRate || 0).toFixed(4)} fullCoverage=${readiness.checks.fullCoverageMet}`,
  );
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  main().catch((error) => {
    console.warn(`WARN: validate-status failed: ${String(error)}`);
    process.exitCode = Math.max(Number(process.exitCode || 0), getFailureExitCode(ENFORCEMENT_LEVEL));
  });
}
