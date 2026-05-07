import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

const STATUS_PATH = path.resolve('artifacts/performance/status.json');
const SUMMARY_PATH = path.resolve('artifacts/performance/lighthouse/summary.json');
const BUNDLE_REPORT_PATH = path.resolve('artifacts/performance/bundle/bundle-report.json');
const BASELINE_PATH = path.resolve('scripts/performance/baseline.json');
const SUMMARY_MD_PATH = path.resolve('artifacts/performance/summary.md');
const HISTORY_PATH = path.resolve('artifacts/performance/history.json');
const READINESS_PATH = path.resolve('artifacts/performance/readiness.json');
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

function renderHistorySection(readiness) {
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

  return lines.join('\n');
}

async function main() {
  const runFindings = [];
  const markFailure = () => {
    if (ENFORCEMENT_LEVEL !== 'warn') process.exitCode = 1;
  };
  const warnAndTrack = (message) => {
    console.warn(message);
    runFindings.push(message);
  };

  if (!VALID_LEVELS.has(ENFORCEMENT_LEVEL)) {
    warnAndTrack(`WARN: invalid PERF_ENFORCEMENT_LEVEL=${ENFORCEMENT_LEVEL}; expected warn|soft|strict.`);
    process.exitCode = 1;
    return;
  }

  if (!(await exists(STATUS_PATH))) {
    warnAndTrack('WARN: performance status.json missing.');
    markFailure();
    return;
  }

  const status = await readJson(STATUS_PATH);
  const mode = String(status.mode || 'unknown');
  const lighthouse = String(status.lighthouse || 'unknown');
  const successfulRuns = Number(status.successfulRuns || 0);
  const warningRuns = Number(status.warningRuns || 0);

  console.log(`Performance status: mode=${mode}, lighthouse=${lighthouse}, enforcement=${ENFORCEMENT_LEVEL}`);

  if (!(await exists(SUMMARY_PATH))) {
    warnAndTrack('WARN: lighthouse summary.json missing.');
    markFailure();
    return;
  }

  const summary = await readJson(SUMMARY_PATH);
  const routeMap = Array.isArray(summary.routeMap) ? summary.routeMap : [];
  const results = Array.isArray(summary.results) ? summary.results : [];
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
    warnAndTrack(`WARN: lighthouse status is ${lighthouse}.`);
    if (status.skippedReason) {
      warnAndTrack(`WARN: skippedReason=${status.skippedReason}`);
      warnAndTrack(`PERF_LIGHTHOUSE_SKIP_REASON=${status.skippedReason}`);
    } else if (status.skippedReasonCode) {
      warnAndTrack(`PERF_LIGHTHOUSE_SKIP_REASON=${status.skippedReasonCode}`);
    }
    markFailure();
  }

  if (lighthouse === 'partial' && successfulRuns === 0 && warningRuns > 0) {
    warnAndTrack('WARN: NO_LIGHTHOUSE_DATA (all runs warned/skipped).');
    if (status.skippedReasonCode) {
      warnAndTrack(`PERF_LIGHTHOUSE_SKIP_REASON=${status.skippedReasonCode}`);
    }
    markFailure();
  }

  if (results.length !== totalRuns) {
    warnAndTrack(`WARN: status totalRuns (${totalRuns}) does not match summary results (${results.length}).`);
    markFailure();
  }

  if (summarySuccessCount !== successfulRuns) {
    warnAndTrack(
      `WARN: status successfulRuns (${successfulRuns}) does not match summary successful runs (${summarySuccessCount}).`,
    );
    markFailure();
  }

  if (summaryWarningCount !== warningRuns) {
    warnAndTrack(
      `WARN: status warningRuns (${warningRuns}) does not match summary warning runs (${summaryWarningCount}).`,
    );
    markFailure();
  }

  if (expectedRuns > 0 && routeCount > 0 && viewportCount > 0 && expectedRuns !== routeCount * viewportCount) {
    warnAndTrack(
      `WARN: status expectedRuns (${expectedRuns}) does not match route/viewport matrix (${routeCount * viewportCount}).`,
    );
    markFailure();
  }

  if (lighthouse === 'ok' && summaryWarningCount > 0) {
    warnAndTrack('WARN: lighthouse=ok but summary still contains warning/skipped results.');
    markFailure();
  }

  if (lighthouse === 'partial' && summaryWarningCount === 0) {
    warnAndTrack('WARN: lighthouse=partial but summary contains no warning/skipped results.');
    markFailure();
  }

  if (lighthouse === 'skipped' && results.length > 0) {
    warnAndTrack('WARN: lighthouse=skipped but summary contains run results.');
    markFailure();
  }

  if (lighthouse === 'error' && results.length > 0 && summarySuccessCount > 0) {
    warnAndTrack('WARN: lighthouse=error but summary contains successful results.');
    markFailure();
  }

  if (unavailableRoutes.length > 0) {
    warnAndTrack(
      `WARN: ${unavailableRoutes.length} requested route(s) were not auditable: ${unavailableRoutes
        .map((entry) => `${entry.requested} (${entry.resolution || 'unknown'})`)
        .join(', ')}`,
    );
    markFailure();
  }

  if (!(await exists(BASELINE_PATH))) {
    warnAndTrack(`WARN: performance baseline missing at ${BASELINE_PATH}.`);
    markFailure();
  } else {
    baseline = await readJson(BASELINE_PATH);
  }

  if (!(await exists(BUNDLE_REPORT_PATH))) {
    warnAndTrack('WARN: bundle report missing.');
    markFailure();
  } else {
    bundleReport = await readJson(BUNDLE_REPORT_PATH);
  }

  for (const result of results.filter((entry) => entry.ok)) {
    if (!result.jsonPath || !(await exists(result.jsonPath))) {
      warnAndTrack(
        `WARN: successful lighthouse result is missing jsonPath artifact for ${result.route} @ ${result.viewport}.`,
      );
      markFailure();
    }
    if (!result.htmlPath || !(await exists(result.htmlPath))) {
      warnAndTrack(
        `WARN: successful lighthouse result is missing htmlPath artifact for ${result.route} @ ${result.viewport}.`,
      );
      markFailure();
    }
  }

  if (baseline && bundleReport) {
    const totals = bundleReport.totals || {};
    const limits = baseline.bundle?.limits || {};
    const largestJsAssetBytes = Number(bundleReport.largestJsAsset?.bytes || 0);
    const checks = [
      ['files', Number(totals.files || 0), Number(limits.maxFiles || 0)],
      ['totalBytes', Number(totals.totalBytes || 0), Number(limits.maxTotalBytes || 0)],
      ['jsBytes', Number(totals.jsBytes || 0), Number(limits.maxJsBytes || 0)],
      ['cssBytes', Number(totals.cssBytes || 0), Number(limits.maxCssBytes || 0)],
      ['htmlBytes', Number(totals.htmlBytes || 0), Number(limits.maxHtmlBytes || 0)],
      ['largestJsAssetBytes', largestJsAssetBytes, Number(limits.maxLargestJsAssetBytes || 0)],
    ];

    for (const [key, value, limit] of checks) {
      if (limit <= 0) continue;
      if (value > limit) {
        warnAndTrack(`WARN: bundle baseline exceeded for ${key} (${value} > ${limit}).`);
        markFailure();
      }
    }
  }

  // Check Lighthouse metric budgets (LCP, CLS) from baseline per route/viewport.
  if (baseline?.lighthouse) {
    const viewportBudgets = baseline.lighthouse;
    for (const result of results.filter((r) => r.ok && r.jsonPath)) {
      const routeBudgets = viewportBudgets[result.viewport]?.[result.route];
      if (!routeBudgets) continue;
      let report;
      try {
        report = await readJson(result.jsonPath);
      } catch {
        continue;
      }
      const lcpMs = Number(report.audits?.['largest-contentful-paint']?.numericValue ?? NaN);
      const cls = Number(report.audits?.['cumulative-layout-shift']?.numericValue ?? NaN);
      if (Number.isFinite(lcpMs) && routeBudgets.lcpMs > 0 && lcpMs > routeBudgets.lcpMs) {
        warnAndTrack(
          `WARN: LCP budget exceeded for ${result.route} @ ${result.viewport} ` +
          `(${Math.round(lcpMs)}ms > ${routeBudgets.lcpMs}ms).`,
        );
        markFailure();
      }
      if (Number.isFinite(cls) && routeBudgets.cls > 0 && cls > routeBudgets.cls) {
        warnAndTrack(
          `WARN: CLS budget exceeded for ${result.route} @ ${result.viewport} ` +
          `(${cls.toFixed(3)} > ${routeBudgets.cls}).`,
        );
        markFailure();
      }
    }
  }

  if (ENFORCEMENT_LEVEL === 'soft') {
    if (!['ok', 'partial'].includes(lighthouse)) {
      warnAndTrack(`WARN: soft enforcement requires lighthouse=ok|partial, got ${lighthouse}.`);
      process.exitCode = 1;
    }
    if (!hasAnySuccessfulData) {
      warnAndTrack('WARN: soft enforcement requires at least one successful lighthouse run.');
      process.exitCode = 1;
    }
    if (totalRuns > 0 && successfulRuns > totalRuns) {
      warnAndTrack(`WARN: invalid run counters (${successfulRuns}/${totalRuns}).`);
      process.exitCode = 1;
    }
    if (unavailableRoutes.length > 0) {
      warnAndTrack('WARN: soft enforcement requires every requested route to be auditable.');
      process.exitCode = 1;
    }
  }

  if (ENFORCEMENT_LEVEL === 'strict') {
    if (lighthouse !== 'ok') {
      warnAndTrack(`WARN: strict enforcement requires lighthouse=ok, got ${lighthouse}.`);
      process.exitCode = 1;
    }
    if (expectedRuns > 0 && successfulRuns < expectedRuns) {
      warnAndTrack(
        `WARN: strict enforcement requires full run coverage (${successfulRuns}/${expectedRuns} successful).`,
      );
      process.exitCode = 1;
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
    });
  }

  const runRecord = {
    runId:
      process.env.GITHUB_RUN_ID ||
      String(status.generatedAt || summary.generatedAt || new Date().toISOString()),
    timestamp: String(status.generatedAt || summary.generatedAt || new Date().toISOString()),
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    refName: process.env.GITHUB_REF_NAME || null,
    enforcementLevel: ENFORCEMENT_LEVEL,
    mode,
    lighthouse,
    expectedRuns,
    totalRuns,
    successfulRuns,
    warningRuns,
    routeCount,
    viewportCount,
    unavailableRouteCount: unavailableRoutes.length,
    findingsCount: runFindings.length,
    findings: runFindings,
    validateExitCode: Number(process.exitCode || 0),
    bundle: bundleReport
      ? {
          files: Number(bundleReport.totals?.files || 0),
          totalBytes: Number(bundleReport.totals?.totalBytes || 0),
          jsBytes: Number(bundleReport.totals?.jsBytes || 0),
          cssBytes: Number(bundleReport.totals?.cssBytes || 0),
          htmlBytes: Number(bundleReport.totals?.htmlBytes || 0),
          largestJsAssetBytes: Number(bundleReport.largestJsAsset?.bytes || 0),
        }
      : null,
    metrics,
  };

  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  const history = await readJsonArray(HISTORY_PATH);
  const mergedHistory = history.filter((entry) => entry?.runId !== runRecord.runId);
  mergedHistory.push(runRecord);
  mergedHistory.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  const trimmedHistory = mergedHistory.slice(-HISTORY_MAX_ENTRIES);
  await writeFile(HISTORY_PATH, `${JSON.stringify(trimmedHistory, null, 2)}\n`, 'utf8');

  const readiness = evaluateReadiness(trimmedHistory, READINESS_MIN_RUNS, READINESS_MAX_WARNING_RATE);
  await writeFile(READINESS_PATH, `${JSON.stringify(readiness, null, 2)}\n`, 'utf8');

  if (await exists(SUMMARY_MD_PATH)) {
    const baseSummary = await readFile(SUMMARY_MD_PATH, 'utf8');
    const marker = '\n## Baseline History\n';
    const nextSummary = `${baseSummary.split(marker)[0].replace(/\s+$/, '')}${marker}${renderHistorySection(
      readiness,
    )}\n`;
    await writeFile(SUMMARY_MD_PATH, nextSummary, 'utf8');
  }

  console.log(
    `Performance readiness: ready=${readiness.ready} runs=${readiness.window.runs}/${readiness.criteria.minRuns} warningRate=${Number(readiness.stats.warningRate || 0).toFixed(4)} fullCoverage=${readiness.checks.fullCoverageMet}`,
  );
}

main().catch((error) => {
  console.warn(`WARN: validate-status failed: ${String(error)}`);
  if (ENFORCEMENT_LEVEL !== 'warn') process.exitCode = 1;
});
