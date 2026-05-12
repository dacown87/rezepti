import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const PUBLIC_DIR = path.resolve('public');
const PERF_OUT_DIR = path.resolve('artifacts/performance');
const OUT_DIR = path.resolve('artifacts/performance/lighthouse');
const STATUS_FILE = path.join(PERF_OUT_DIR, 'status.json');
const LOG_FILE = path.join(OUT_DIR, 'lighthouse-run.log');
const SUMMARY_FILE = path.join(OUT_DIR, 'summary.json');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PERF_LIGHTHOUSE_PORT || 4173);
const MAX_RETRIES = Math.max(0, Number(process.env.PERF_LIGHTHOUSE_RETRIES || 1));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.PERF_LIGHTHOUSE_RETRY_DELAY_MS || 1500));
const LIGHTHOUSE_TIMEOUT_MS = Math.max(30_000, Number(process.env.PERF_LIGHTHOUSE_TIMEOUT_MS || 180_000));
export const VALID_LIGHTHOUSE_THROTTLING_METHODS = ['simulate', 'devtools'];

export function normalizeLighthouseThrottling(value = process.env.LIGHTHOUSE_THROTTLING) {
  const method = value || 'simulate';
  if (!VALID_LIGHTHOUSE_THROTTLING_METHODS.includes(method)) {
    throw new Error(`Invalid LIGHTHOUSE_THROTTLING: ${method}. Must be 'simulate' or 'devtools'.`);
  }
  return method;
}

const LIGHTHOUSE_THROTTLING = normalizeLighthouseThrottling();
let activePort = 0;
const require = createRequire(import.meta.url);

const ROUTES = ['/', '/shopping', '/recipe/1'];
const VIEWPORTS = [
  { id: 'mobile-375x812', width: 375, height: 812, mobile: true, dpr: 2 },
  { id: 'tablet-768x1024', width: 768, height: 1024, mobile: false, dpr: 2 },
  { id: 'desktop-1366x768', width: 1366, height: 768, mobile: false, dpr: 1 },
];

function logLine(message) {
  console.log(message);
  return `${message}\n`;
}

async function writeStatus(status) {
  await mkdir(PERF_OUT_DIR, { recursive: true });
  await writeFile(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isFile(filePath) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function normalizeRoutePath(urlPath) {
  const noQuery = urlPath.split('?')[0] || '/';
  const clean = noQuery.replace(/\/+$/, '');
  return clean || '/';
}

function resolveInsidePublic(relativePath) {
  const candidate = path.resolve(PUBLIC_DIR, relativePath);
  const rel = path.relative(PUBLIC_DIR, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return candidate;
}

async function resolveDynamicHtmlFile(cleanRoute) {
  if (cleanRoute === '/') return null;

  const relativeRoute = cleanRoute.slice(1);
  const dir = resolveInsidePublic(path.dirname(relativeRoute));
  if (!dir || !(await exists(dir))) return null;

  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const dynamicHtmlEntries = entries
    .filter((entry) => entry.isFile() && /^\[[^/]+\]\.html$/.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();

  if (dynamicHtmlEntries.length !== 1) return null;
  return dynamicHtmlEntries[0];
}

async function resolveStaticFile(urlPath) {
  const cleanRoute = normalizeRoutePath(urlPath);

  if (cleanRoute === '/') {
    const rootFile = path.join(PUBLIC_DIR, 'index.html');
    if (await isFile(rootFile)) {
      return { filePath: rootFile, resolution: 'root-html', requestedPath: cleanRoute };
    }
    return null;
  }

  const relativeRoute = cleanRoute.slice(1);
  const directAsset = resolveInsidePublic(relativeRoute);
  if (directAsset && (await isFile(directAsset))) {
    return { filePath: directAsset, resolution: 'asset-exact', requestedPath: cleanRoute };
  }

  const routeIndex = resolveInsidePublic(path.join(relativeRoute, 'index.html'));
  if (routeIndex && (await isFile(routeIndex))) {
    return { filePath: routeIndex, resolution: 'route-index-html', requestedPath: cleanRoute };
  }

  const exactHtml = resolveInsidePublic(`${relativeRoute}.html`);
  if (exactHtml && (await isFile(exactHtml))) {
    return { filePath: exactHtml, resolution: 'route-html', requestedPath: cleanRoute };
  }

  const dynamicHtml = await resolveDynamicHtmlFile(cleanRoute);
  if (dynamicHtml && (await isFile(dynamicHtml))) {
    return { filePath: dynamicHtml, resolution: 'route-dynamic-html', requestedPath: cleanRoute };
  }

  return null;
}

async function commandAvailable(cmd, args = ['--version']) {
  const result = await new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'pipe' });
    child.on('close', (code) => resolve({ ok: code === 0 }));
    child.on('error', () => resolve({ ok: false }));
  });
  return result.ok;
}

async function resolveLighthouseLaunch() {
  const envBin = process.env.PERF_LIGHTHOUSE_BIN;
  if (envBin && (await exists(envBin))) {
    return { cmd: envBin, argsPrefix: [], source: 'env-bin' };
  }

  const localBin = path.resolve('node_modules/.bin/lighthouse');
  if (await exists(localBin)) {
    return { cmd: localBin, argsPrefix: [], source: 'node_modules-bin' };
  }

  try {
    const lighthousePkg = require.resolve('lighthouse/package.json');
    const cliPath = path.join(path.dirname(lighthousePkg), 'cli', 'index.js');
    if (await exists(cliPath)) {
      return { cmd: process.execPath, argsPrefix: [cliPath], source: 'node-cli-fallback' };
    }
  } catch {
    // no-op: handled by null return
  }

  return null;
}

async function detectChromeCommand() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LIGHTHOUSE_CHROMIUM_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
  ].filter(Boolean);

  for (const cmd of candidates) {
    // Absolute file path or executable in PATH are both accepted.
    if ((await exists(cmd)) || (await commandAvailable(cmd))) {
      return cmd;
    }
  }
  return null;
}

function machineReadableSkip(reason) {
  return `PERF_LIGHTHOUSE_SKIP_REASON=${reason}`;
}

/**
 * Pure route-matching function — returns the mock response body for a given
 * API pathname, or null if no explicit route matches (caller uses fallback).
 *
 * Exported (as a comment-level contract) so that the vitest test file can
 * import and exercise it directly without starting an HTTP server.
 *
 * Route priority (first match wins):
 *  1. Exact-collection routes  — /api/v1/recipes, /api/v1/shopping, ...
 *  2. Named sub-collection routes — /api/v1/shopping/checked, /api/v1/shopping/all
 *  3. Parametrised single-item routes — /api/v1/recipes/:id, /api/v1/shopping/:id
 *  4. null → caller writes json({}) fallback
 */
export function matchApiRoute(pathname) {
  // ── Collection routes ──────────────────────────────────────────────────────
  if (/^\/api\/v1\/recipes($|\?)/.test(pathname)) return [];
  if (/^\/api\/v1\/planner($|\?)/.test(pathname)) return [];
  if (/^\/api\/v1\/shopping($|\?)/.test(pathname)) return { items: [] };
  if (/^\/api\/v1\/health($|\?)/.test(pathname)) return { status: 'ok' };

  // ── Named shopping sub-paths (must come before /:id catch-all) ────────────
  // DELETE /api/v1/shopping/checked  — clear checked items
  // DELETE /api/v1/shopping/all      — clear all items
  if (/^\/api\/v1\/shopping\/(checked|all)(\/|$|\?)/.test(pathname)) return { ok: true };

  // ── Parametrised single-item routes ───────────────────────────────────────
  // GET /api/v1/recipes/:id — recipe detail screen fetches this on mount.
  // The mock must include all fields that normalizeRecipe() accesses so the
  // screen renders the "not found" or empty-state UI immediately instead of
  // waiting for a timeout.
  if (/^\/api\/v1\/recipes\/[^/]+(\/|$|\?)/.test(pathname)) {
    return {
      id: 0,
      name: '',
      emoji: null,
      source_url: null,
      image_url: null,
      ingredients: '[]',
      steps: '[]',
      tags: null,
      servings: null,
      duration: null,
      calories: null,
      rating: null,
      notes: null,
      category: null,
      equipment: null,
      nutrition_info: null,
      ingredient_groups: null,
      transcript: null,
      tried: 0,
      pdf_created: 0,
      created_at: null,
    };
  }

  // GET/PATCH/DELETE /api/v1/shopping/:id — toggle / delete single item
  if (/^\/api\/v1\/shopping\/[^/]+(\/|$|\?)/.test(pathname)) return { ok: true };

  // No explicit match — caller writes fallback json({})
  return null;
}

function handleApiMock(pathname, res) {
  // Return minimal empty-state responses so the React app renders its
  // empty-state UI fast instead of waiting for a real API that isn't running.
  // This makes LCP measure actual initial render, not API-timeout.
  const json = (body) => {
    const payload = JSON.stringify(body);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
    res.end(payload);
  };
  const matched = matchApiRoute(pathname);
  return json(matched !== null ? matched : {});
}

async function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const raw = req.url || '/';
      const requestUrl = new URL(raw, `http://${HOST}:${activePort}`);
      const pathname = requestUrl.pathname;

      if (pathname.startsWith('/api/')) {
        handleApiMock(pathname, res);
        return;
      }

      const target = await resolveStaticFile(pathname);
      if (!target) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const body = await readFile(target.filePath);
      res.writeHead(200, { 'content-type': contentType(target.filePath) });
      res.end(body);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => resolve());
  });
  const address = server.address();
  if (address && typeof address === 'object') {
    activePort = address.port;
  }
  return server;
}

async function resolveRoute(route, useLocalStaticServer) {
  if (useLocalStaticServer) {
    const target = await resolveStaticFile(route);
    if (!target) {
      return {
        requested: route,
        auditedPath: null,
        available: false,
        resolution: 'missing-route',
        servedFile: null,
      };
    }
    return {
      requested: route,
      auditedPath: route,
      available: true,
      resolution: target.resolution,
      servedFile: path.relative(process.cwd(), target.filePath),
    };
  }

  const url = `${baseUrlRef.current}${route}`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    return {
      requested: route,
      auditedPath: response.ok ? route : null,
      available: response.ok,
      resolution: response.ok ? 'external-ok' : `external-${response.status}`,
      servedFile: null,
    };
  } catch {
    return {
      requested: route,
      auditedPath: null,
      available: false,
      resolution: 'external-unreachable',
      servedFile: null,
    };
  }
}

const baseUrlRef = { current: '' };

function reportBasename(route, viewportId) {
  const safeRoute = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(OUT_DIR, `${safeRoute}-${viewportId}`);
}

async function runLighthouse(url, route, viewport, throttlingMethod, logBuffer) {
  const launch = await resolveLighthouseLaunch();
  if (!launch) {
    logBuffer.push(logLine('WARN: Lighthouse CLI not found. Skipping Lighthouse (warn-only).'));
    logBuffer.push(logLine(machineReadableSkip('missing-lighthouse-cli')));
    return { ok: false, skipped: true, reason: 'missing-lighthouse-cli', route, viewport: viewport.id, throttlingMethod };
  }

  const outputBase = reportBasename(route, viewport.id);
  const chromePath = await detectChromeCommand();
  if (!chromePath) {
    logBuffer.push(logLine('WARN: Chrome/Chromium executable not found. Skipping Lighthouse (warn-only).'));
    logBuffer.push(logLine(machineReadableSkip('missing-chrome')));
    return { ok: false, skipped: true, reason: 'missing-chrome', route, viewport: viewport.id, throttlingMethod };
  }

  const args = [
    ...launch.argsPrefix,
    url,
    '--quiet',
    '--only-categories=performance',
    '--output=json',
    '--output=html',
    `--output-path=${outputBase}`,
    `--chrome-path=${chromePath}`,
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
    `--throttling-method=${throttlingMethod}`,
    `--form-factor=${viewport.mobile ? 'mobile' : 'desktop'}`,
    `--screenEmulation.mobile=${viewport.mobile}`,
    `--screenEmulation.width=${viewport.width}`,
    `--screenEmulation.height=${viewport.height}`,
    `--screenEmulation.deviceScaleFactor=${viewport.dpr}`,
  ];

  const runAttempt = await new Promise((resolve) => {
    const child = spawn(launch.cmd, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, LIGHTHOUSE_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout, stderr, timedOut });
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: String(error), timedOut });
    });
  });

  const attempts = [];
  attempts.push(runAttempt);
  let run = runAttempt;

  for (let retry = 1; retry <= MAX_RETRIES && run.code !== 0; retry += 1) {
    logBuffer.push(
      logLine(
        `WARN: Lighthouse failed for ${route} @ ${viewport.id} (exit ${run.code}); retry ${retry}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms.`,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    run = await new Promise((resolve) => {
      const child = spawn(launch.cmd, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000).unref();
      }, LIGHTHOUSE_TIMEOUT_MS);
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code: code ?? 1, stdout, stderr, timedOut });
      });
      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ code: 1, stdout, stderr: String(error), timedOut });
      });
    });
    attempts.push(run);
  }

  if (run.code !== 0) {
    logBuffer.push(logLine(`WARN: Lighthouse failed for ${route} @ ${viewport.id} (exit ${run.code}; source=${launch.source}).`));
    if (run.timedOut) {
      logBuffer.push(logLine(`WARN: Lighthouse timed out after ${LIGHTHOUSE_TIMEOUT_MS}ms.`));
    }
    if (run.stderr.trim()) logBuffer.push(`${run.stderr.trim()}\n`);
    return {
      ok: false,
      skipped: false,
      reason: 'lighthouse-run-failed',
      route,
      viewport: viewport.id,
      throttlingMethod,
      exitCode: run.code,
      attempts: attempts.length,
      timedOut: run.timedOut,
    };
  }

  const jsonPath = `${outputBase}.report.json`;
  const htmlPath = `${outputBase}.report.html`;
  return { ok: true, route, viewport: viewport.id, jsonPath, htmlPath, attempts: attempts.length, throttlingMethod };
}

async function main() {
  const logBuffer = [];
  await mkdir(OUT_DIR, { recursive: true });
  await writeStatus({
    generatedAt: new Date().toISOString(),
    mode: 'warn-only',
    lighthouse: 'running',
    throttlingMethod: LIGHTHOUSE_THROTTLING,
    tool: 'lighthouse-runner',
  });

  if (!(await exists(PUBLIC_DIR))) {
    logBuffer.push(logLine('WARN: public/ directory is missing. Run `npm run build:mobile` first. Lighthouse skipped (warn-only).'));
    logBuffer.push(logLine(machineReadableSkip('missing-public-dir')));
    await writeFile(LOG_FILE, logBuffer.join(''), 'utf8');
    await writeStatus({
      generatedAt: new Date().toISOString(),
      mode: 'warn-only',
      lighthouse: 'skipped',
      skippedReason: 'missing-public-dir',
      skippedReasonCode: 'missing-public-dir',
      throttlingMethod: LIGHTHOUSE_THROTTLING,
      tool: 'lighthouse-runner',
    });
    return;
  }

  let server = null;
  let baseUrl = process.env.PERF_LIGHTHOUSE_BASE_URL || '';
  if (baseUrl) {
    baseUrl = baseUrl.replace(/\/+$/, '');
    baseUrlRef.current = baseUrl;
    logBuffer.push(logLine(`Using external base URL from PERF_LIGHTHOUSE_BASE_URL: ${baseUrl}`));
  } else {
    try {
      server = await startStaticServer();
      baseUrl = `http://${HOST}:${activePort}`;
      baseUrlRef.current = baseUrl;
      logBuffer.push(logLine(`Static server started on ${baseUrl}`));
    } catch (error) {
      logBuffer.push(logLine('WARN: Could not start local static server (warn-only).'));
      logBuffer.push(logLine('WARN: Set PERF_LIGHTHOUSE_BASE_URL to run against an existing app URL.'));
      logBuffer.push(logLine(machineReadableSkip('local-server-unavailable-and-no-base-url')));
      logBuffer.push(`${String(error)}\n`);
      await writeFile(LOG_FILE, logBuffer.join(''), 'utf8');
      const summary = {
        generatedAt: new Date().toISOString(),
        outputDir: OUT_DIR,
        routeMap: [],
        throttlingMethod: LIGHTHOUSE_THROTTLING,
        viewports: VIEWPORTS,
        results: [],
        warnOnly: true,
        skippedReason: 'local-server-unavailable-and-no-base-url',
      };
      await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
      await writeStatus({
        generatedAt: new Date().toISOString(),
        mode: 'warn-only',
        lighthouse: 'skipped',
        skippedReason: summary.skippedReason,
        skippedReasonCode: summary.skippedReason,
        throttlingMethod: LIGHTHOUSE_THROTTLING,
        tool: 'lighthouse-runner',
      });
      console.warn('WARN: Lighthouse skipped (warn-only). See artifacts/performance/lighthouse/lighthouse-run.log');
      return;
    }
  }

  const routeMap = [];
  for (const route of ROUTES) {
    const routeInfo = await resolveRoute(route, Boolean(server));
    if (!routeInfo.available) {
      logBuffer.push(logLine(`WARN: Route ${route} is not auditable (${routeInfo.resolution}).`));
    } else if (routeInfo.resolution !== 'external-ok' && routeInfo.resolution !== 'route-html' && routeInfo.resolution !== 'root-html' && routeInfo.resolution !== 'asset-exact') {
      const servedFile = routeInfo.servedFile ? ` -> ${routeInfo.servedFile}` : '';
      logBuffer.push(logLine(`Route ${route} resolved via ${routeInfo.resolution}${servedFile}`));
    }
    routeMap.push(routeInfo);
  }

  const auditableRoutes = routeMap.filter((entry) => entry.available && entry.auditedPath);
  const uniqueAuditedRoutes = [...new Set(auditableRoutes.map((entry) => entry.auditedPath))];
  if (uniqueAuditedRoutes.length < auditableRoutes.length) {
    logBuffer.push(
      logLine(
        `WARN: ${auditableRoutes.length - uniqueAuditedRoutes.length} route(s) mapped to duplicate audit paths; running unique paths only.`,
      ),
    );
  }

  const results = [];
  for (const routeInfo of routeMap.filter((entry) => !entry.available || !entry.auditedPath)) {
    for (const viewport of VIEWPORTS) {
      results.push({
        requestedRoutes: [routeInfo.requested],
        resolvedRoute: null,
        ok: false,
        skipped: true,
        reason: routeInfo.resolution,
        route: routeInfo.requested,
        viewport: viewport.id,
        attempts: 0,
        throttlingMethod: LIGHTHOUSE_THROTTLING,
      });
    }
  }

  for (const target of uniqueAuditedRoutes) {
    const requestedRoutes = routeMap
      .filter((entry) => entry.auditedPath === target)
      .map((entry) => entry.requested);
    const url = `${baseUrl}${target}`;
    for (const viewport of VIEWPORTS) {
      logBuffer.push(
        logLine(
          `Running Lighthouse: [${requestedRoutes.join(', ')}] -> ${target} @ ${viewport.id} (throttling=${LIGHTHOUSE_THROTTLING})`,
        ),
      );
      const result = await runLighthouse(url, target, viewport, LIGHTHOUSE_THROTTLING, logBuffer);
      results.push({ requestedRoutes, resolvedRoute: target, ...result });
    }
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    logBuffer.push(logLine('Static server stopped.'));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    outputDir: OUT_DIR,
    routeMap,
    uniqueAuditedRoutes,
    throttlingMethod: LIGHTHOUSE_THROTTLING,
    viewports: VIEWPORTS,
    results,
    warnOnly: true,
  };

  const successCount = results.filter((r) => r.ok).length;
  const warnCount = results.length - successCount;

  await writeFile(LOG_FILE, logBuffer.join(''), 'utf8');
  await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeStatus({
    generatedAt: new Date().toISOString(),
    mode: 'warn-only',
    lighthouse: results.every((r) => r.ok) ? 'ok' : 'partial',
    expectedRuns: ROUTES.length * VIEWPORTS.length,
    totalRuns: results.length,
    successfulRuns: successCount,
    warningRuns: warnCount,
    skippedReasonCode: successCount > 0 ? null : (results.find((r) => r.reason)?.reason || null),
    throttlingMethod: LIGHTHOUSE_THROTTLING,
    tool: 'lighthouse-runner',
  });

  logLine(`Lighthouse run finished: ${successCount} successful, ${warnCount} warnings.`);
  logLine(`Artifacts: ${OUT_DIR}`);
}

export async function runLighthouseRunner() {
  return main();
}

async function handleMainError(error) {
  await mkdir(OUT_DIR, { recursive: true });
  const details = `WARN: Lighthouse automation crashed unexpectedly (warn-only).\n${String(error)}\n`;
  await writeFile(LOG_FILE, details, 'utf8');
  await writeStatus({
    generatedAt: new Date().toISOString(),
    mode: 'warn-only',
    lighthouse: 'error',
    error: String(error),
    throttlingMethod: LIGHTHOUSE_THROTTLING,
    tool: 'lighthouse-runner',
  });
  console.warn(details.trim());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(handleMainError);
}
