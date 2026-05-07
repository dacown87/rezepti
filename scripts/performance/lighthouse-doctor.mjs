import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandAvailable(cmd, args = ['--version']) {
  const result = await new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'pipe' });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
  return result;
}

async function findLighthouse() {
  const envBin = process.env.PERF_LIGHTHOUSE_BIN;
  if (envBin && (await exists(envBin))) return { found: true, source: 'env-bin', value: envBin };

  const localBin = path.resolve('node_modules/.bin/lighthouse');
  if (await exists(localBin)) return { found: true, source: 'node_modules-bin', value: localBin };

  try {
    const pkg = require.resolve('lighthouse/package.json');
    const cli = path.join(path.dirname(pkg), 'cli', 'index.js');
    if (await exists(cli)) return { found: true, source: 'node-cli-fallback', value: cli };
  } catch {
    // ignore
  }
  return { found: false, source: 'missing', value: null };
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LIGHTHOUSE_CHROMIUM_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if ((await exists(candidate)) || (await commandAvailable(candidate))) {
      return { found: true, value: candidate };
    }
  }
  return { found: false, value: null };
}

async function main() {
  const lighthouse = await findLighthouse();
  const chrome = await findChrome();

  console.log(`PERF_LIGHTHOUSE_CLI_FOUND=${lighthouse.found ? '1' : '0'}`);
  console.log(`PERF_LIGHTHOUSE_CLI_SOURCE=${lighthouse.source}`);
  if (lighthouse.value) console.log(`PERF_LIGHTHOUSE_CLI_VALUE=${lighthouse.value}`);
  console.log(`PERF_LIGHTHOUSE_CHROME_FOUND=${chrome.found ? '1' : '0'}`);
  if (chrome.value) console.log(`PERF_LIGHTHOUSE_CHROME_VALUE=${chrome.value}`);
  if (!chrome.found) console.log('PERF_LIGHTHOUSE_SKIP_REASON=missing-chrome');
}

main().catch((error) => {
  console.warn(`WARN: lighthouse-doctor failed: ${String(error)}`);
  process.exitCode = 0;
});
