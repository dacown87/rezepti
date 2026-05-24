import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const mobileDir = path.join(repoRoot, 'mobile');

export const DEFAULT_TIMEOUT_SECONDS = 300;
export const DEFAULT_POST_EXPORT_GRACE_SECONDS = 8;
export const DEFAULT_OUTPUT_DIR = '../public';

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function parseOutputDir(argv, fallback = DEFAULT_OUTPUT_DIR) {
  const index = argv.indexOf('--output-dir');
  if (index < 0) return fallback;
  const value = argv[index + 1];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function parseTimeoutSeconds(rawValue, fallback = DEFAULT_TIMEOUT_SECONDS) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return String(fallback);
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return String(fallback);
  return String(parsed);
}

export function parseGraceSeconds(rawValue, fallback = DEFAULT_POST_EXPORT_GRACE_SECONDS) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return fallback;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function buildExportCommand({ outputDir, timeoutSeconds, logFile }) {
  return (
    `set -o pipefail && ` +
    `timeout --signal=TERM --kill-after=5s ${shellQuote(timeoutSeconds)}s ` +
    `npx expo export --platform web --output-dir ${shellQuote(outputDir)} 2>&1 | tee ${shellQuote(logFile)}`
  );
}

export function exportMarkerFor(outputDir) {
  return `Exported: ${outputDir}`;
}

export function classifyExportResult({ exitCode, logOutput, exportMarker }) {
  if (exitCode === 0) {
    return { success: true, reason: 'clean-exit' };
  }
  if (exitCode === 124 && typeof logOutput === 'string' && logOutput.includes(exportMarker)) {
    return { success: true, reason: 'timeout-after-export' };
  }
  return { success: false, reason: 'failure' };
}

function waitForStreamDrain(stream, timeoutMs = 250) {
  if (!stream) return Promise.resolve();
  if (stream.readableEnded || stream.destroyed) return Promise.resolve();
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timer);
      stream.off('end', onDone);
      stream.off('close', onDone);
      stream.off('error', onDone);
      resolve();
    };
    const onDone = () => cleanup();
    const timer = setTimeout(cleanup, timeoutMs);
    stream.once('end', onDone);
    stream.once('close', onDone);
    stream.once('error', onDone);
  });
}

export async function runExpoExportWeb({
  argv = process.argv,
  env = process.env,
  cwd = mobileDir,
  spawnImpl = spawn,
} = {}) {
  const outputDir = parseOutputDir(argv);
  const timeoutSeconds = parseTimeoutSeconds(env.EXPO_EXPORT_TIMEOUT_SECONDS);
  const graceSeconds = parseGraceSeconds(env.EXPO_EXPORT_GRACE_SECONDS);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-export-web-'));
  const logFile = path.join(tempDir, 'expo-export.log');
  const exportMarker = exportMarkerFor(outputDir);
  const logWriter = createWriteStream(logFile, { flags: 'a' });
  const child = spawnImpl('npx', ['expo', 'export', '--platform', 'web', '--output-dir', outputDir], {
    cwd,
    env: { ...env, CI: env.CI || '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let sawExportMarker = false;
  let forceClosedAfterExport = false;
  let graceTimer = null;
  let hardKillTimer = null;
  let timeoutTimer = null;
  let captured = '';

  const appendChunk = (chunk, stream) => {
    const text = chunk.toString();
    captured += text;
    stream.write(chunk);
    process.stdout.write(text);
    if (!sawExportMarker && text.includes(exportMarker)) {
      sawExportMarker = true;
      graceTimer = setTimeout(() => {
        // Expo occasionally keeps worker processes alive after writing output.
        // Terminate gracefully first; hard-kill if still alive.
        forceClosedAfterExport = true;
        child.kill('SIGTERM');
        hardKillTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, 5000);
      }, graceSeconds * 1000);
    }
  };

  child.stdout.on('data', (chunk) => appendChunk(chunk, logWriter));
  child.stderr.on('data', (chunk) => appendChunk(chunk, logWriter));

  timeoutTimer = setTimeout(() => {
    child.kill('SIGTERM');
    hardKillTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 5000);
  }, Number(timeoutSeconds) * 1000);

  const exitCode = await new Promise((resolve) => {
    child.on('exit', async (code) => {
      await Promise.all([
        waitForStreamDrain(child.stdout),
        waitForStreamDrain(child.stderr),
      ]);
      resolve(typeof code === 'number' ? code : 1);
    });
    child.on('error', () => resolve(1));
  });

  if (graceTimer) clearTimeout(graceTimer);
  if (hardKillTimer) clearTimeout(hardKillTimer);
  if (timeoutTimer) clearTimeout(timeoutTimer);
  await new Promise((resolve) => logWriter.end(resolve));
  const logOutput = captured;
  await rm(tempDir, { recursive: true, force: true });

  let result = classifyExportResult({ exitCode, logOutput, exportMarker });
  if (!result.success && sawExportMarker && forceClosedAfterExport) {
    result = { success: true, reason: 'graceful-stop-after-export' };
  }
  if (result.reason === 'graceful-stop-after-export') {
    console.error(
      '[expo-export-web] Expo export finished and was terminated after grace period to avoid known post-export hang.',
    );
  }
  return { ...result, exitCode };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const result = await runExpoExportWeb();
  process.exit(result.success ? 0 : result.exitCode);
}
