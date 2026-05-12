import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const mobileDir = path.join(repoRoot, 'mobile');
const outputDirArgIndex = process.argv.indexOf('--output-dir');
const outputDir = outputDirArgIndex >= 0 ? process.argv[outputDirArgIndex + 1] : '../public';
const timeoutSeconds = String(Number(process.env.EXPO_EXPORT_TIMEOUT_SECONDS || 300));

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-export-web-'));
const logFile = path.join(tempDir, 'expo-export.log');
const exportMarker = `Exported: ${outputDir}`;
const command =
  `set -o pipefail && ` +
  `timeout --signal=TERM --kill-after=5s ${shellQuote(timeoutSeconds)}s ` +
  `npx expo export --platform web --output-dir ${shellQuote(outputDir)} 2>&1 | tee ${shellQuote(logFile)}`;

const child = spawn('bash', ['-lc', command], {
  cwd: mobileDir,
  env: {
    ...process.env,
    CI: process.env.CI || '1',
  },
  stdio: 'inherit',
});

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code) => resolve(typeof code === 'number' ? code : 1));
  child.on('error', () => resolve(1));
});

if (exitCode === 0) {
  await rm(tempDir, { recursive: true, force: true });
  process.exit(0);
}

const logOutput = await readFile(logFile, 'utf8').catch(() => '');
await rm(tempDir, { recursive: true, force: true });

if (exitCode === 124 && logOutput.includes(exportMarker)) {
  console.error(
    '[expo-export-web] Expo export wrote the requested output and then exceeded the timeout; treating this known post-export hang as success.',
  );
  process.exit(0);
}

process.exit(exitCode);
