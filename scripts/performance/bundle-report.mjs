import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const OUT_DIR = path.resolve('artifacts/performance');
const BUNDLE_DIR = path.join(OUT_DIR, 'bundle');
const SUMMARY_PATH = path.join(OUT_DIR, 'summary.md');
const BASELINE_PATH = path.resolve('scripts/performance/baseline.json');

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }
    files.push(full);
  }
  return files;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function formatDelta(bytes) {
  if (!Number.isFinite(bytes) || bytes === 0) return 'on baseline';
  const sign = bytes > 0 ? '+' : '-';
  return `${sign}${formatKb(Math.abs(bytes))}`;
}

async function readJsonIfExists(filePath) {
  if (!(await exists(filePath))) return null;
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  await mkdir(BUNDLE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  if (!(await exists(PUBLIC_DIR))) {
    const report = {
      generatedAt: new Date().toISOString(),
      warnOnly: true,
      skippedReason: 'missing-public-dir',
      totals: { files: 0, totalBytes: 0, jsBytes: 0, cssBytes: 0, htmlBytes: 0 },
      top10: [],
    };
    await writeFile(
      path.join(BUNDLE_DIR, 'bundle-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      SUMMARY_PATH,
      '# Performance Summary\n\nWARN: public/ directory is missing. Bundle report skipped (warn-only).\n',
      'utf8',
    );
    console.warn('WARN: public/ directory is missing. Bundle report skipped (warn-only).');
    return;
  }

  const allFiles = await walk(PUBLIC_DIR);
  const relevant = allFiles.filter((file) =>
    file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html'),
  );

  const rows = [];
  for (const file of relevant) {
    const s = await stat(file);
    const content = await readFile(file);
    const hash = createHash('sha1').update(content).digest('hex');
    rows.push({
      path: path.relative(process.cwd(), file),
      bytes: s.size,
      hash,
      type: path.extname(file).slice(1),
    });
  }

  rows.sort((a, b) => b.bytes - a.bytes);
  const top10 = rows.slice(0, 10);
  const uniqueRows = [];
  const duplicateGroups = [];
  const seenHashes = new Set();

  for (const row of rows) {
    if (seenHashes.has(row.hash)) continue;
    seenHashes.add(row.hash);
    const aliases = rows.filter((candidate) => candidate.hash === row.hash).map((candidate) => candidate.path);
    uniqueRows.push({
      path: row.path,
      bytes: row.bytes,
      type: row.type,
      aliases,
      aliasCount: aliases.length,
    });
    if (aliases.length > 1) {
      duplicateGroups.push({
        path: row.path,
        bytes: row.bytes,
        type: row.type,
        aliases,
        aliasCount: aliases.length,
      });
    }
  }

  const top10Unique = uniqueRows.slice(0, 10);
  const totals = {
    files: rows.length,
    totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    jsBytes: rows.filter((r) => r.path.endsWith('.js')).reduce((sum, row) => sum + row.bytes, 0),
    cssBytes: rows.filter((r) => r.path.endsWith('.css')).reduce((sum, row) => sum + row.bytes, 0),
    htmlBytes: rows.filter((r) => r.path.endsWith('.html')).reduce((sum, row) => sum + row.bytes, 0),
  };
  const largestJsAsset = rows.find((row) => row.path.endsWith('.js')) || null;
  const baseline = await readJsonIfExists(BASELINE_PATH);
  const limits = baseline?.bundle?.limits || {};
  const baselineChecks = [
    ['files', Number(totals.files || 0), Number(limits.maxFiles || 0)],
    ['jsBytes', Number(totals.jsBytes || 0), Number(limits.maxJsBytes || 0)],
    ['cssBytes', Number(totals.cssBytes || 0), Number(limits.maxCssBytes || 0)],
    ['largestJsAssetBytes', Number(largestJsAsset?.bytes || 0), Number(limits.maxLargestJsAssetBytes || 0)],
  ]
    .filter(([, , limit]) => limit > 0)
    .map(([key, value, limit]) => ({
      key,
      value,
      limit,
      delta: value - limit,
      status: value > limit ? 'over' : 'within',
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    totals,
    largestJsAsset,
    top10,
    top10Unique,
    duplicateGroups,
    baseline: baseline
      ? {
          path: path.relative(process.cwd(), BASELINE_PATH),
          checks: baselineChecks,
        }
      : null,
  };

  await writeFile(
    path.join(BUNDLE_DIR, 'bundle-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  const summary = [
    '# Performance Summary',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Bundle Totals',
    `- Files: ${totals.files}`,
    `- Total size: ${formatKb(totals.totalBytes)}`,
    `- JS: ${formatKb(totals.jsBytes)}`,
    `- CSS: ${formatKb(totals.cssBytes)}`,
    `- HTML: ${formatKb(totals.htmlBytes)}`,
    '',
    '## Budget Signals',
    largestJsAsset
      ? `- Largest JS asset: ${largestJsAsset.path} (${formatKb(largestJsAsset.bytes)})`
      : '- Largest JS asset: none',
    ...baselineChecks.length
      ? baselineChecks.map(
          (check) =>
            `- ${check.key}: ${check.status === 'over' ? 'WARN' : 'OK'} (${formatKb(check.value)} vs ${formatKb(check.limit)}, ${formatDelta(check.delta)})`,
        )
      : ['- No active bundle baseline limits found.'],
    '',
    '## Top 10 Largest Assets',
    ...top10.map((row, index) => `${index + 1}. ${row.path} — ${formatKb(row.bytes)}`),
    '',
    '## Top 10 Largest Unique Assets',
    ...top10Unique.map((row, index) => {
      const aliasInfo = row.aliasCount > 1 ? ` (${row.aliasCount} aliases)` : '';
      return `${index + 1}. ${row.path} — ${formatKb(row.bytes)}${aliasInfo}`;
    }),
    '',
    '## Duplicate Asset Groups',
    ...(duplicateGroups.length > 0
      ? duplicateGroups.slice(0, 10).map(
          (group, index) =>
            `${index + 1}. ${group.path} — ${formatKb(group.bytes)} duplicated across ${group.aliasCount} paths`,
        )
      : ['No duplicate asset groups detected.']),
    '',
  ].join('\n');

  await writeFile(SUMMARY_PATH, summary, 'utf8');
  console.log(`Bundle report written to ${path.join(BUNDLE_DIR, 'bundle-report.json')}`);
  console.log(`Summary written to ${SUMMARY_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
