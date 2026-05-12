import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const mobileDir = path.join(repoRoot, 'mobile');

export const DEFAULT_TIMEOUT_SECONDS = 300;
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

export async function runExpoExportWeb({
  argv = process.argv,
  env = process.env,
  cwd = mobileDir,
} = {}) {
  const outputDir = parseOutputDir(argv);
  const timeoutSeconds = parseTimeoutSeconds(env.EXPO_EXPORT_TIMEOUT_SECONDS);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-export-web-'));
  const logFile = path.join(tempDir, 'expo-export.log');
  const exportMarker = exportMarkerFor(outputDir);
  const command = buildExportCommand({ outputDir, timeoutSeconds, logFile });

  const child = spawn('bash', ['-lc', command], {
    cwd,
    env: { ...env, CI: env.CI || '1' },
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(typeof code === 'number' ? code : 1));
    child.on('error', () => resolve(1));
  });

  const logOutput = exitCode === 0 ? '' : await readFile(logFile, 'utf8').catch(() => '');
  await rm(tempDir, { recursive: true, force: true });

  const result = classifyExportResult({ exitCode, logOutput, exportMarker });
  if (result.reason === 'timeout-after-export') {
    console.error(
      '[expo-export-web] Expo export wrote the requested output and then exceeded the timeout; treating this known post-export hang as success.',
    );
  }
  return { ...result, exitCode };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const result = await runExpoExportWeb();
  process.exit(result.success ? 0 : result.exitCode);
}
