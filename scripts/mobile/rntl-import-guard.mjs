#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['mobile/test', 'mobile/components'];
const testFilePattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const rendererImportPattern =
  /(?:from\s+['"]react-test-renderer['"]|require\(['"]react-test-renderer['"]\))/;

const allowedLegacyFiles = new Set();

function collectFiles(dir) {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.expo' || entry.name === 'dist') continue;
      files.push(...collectFiles(path));
      continue;
    }

    if (entry.isFile() && testFilePattern.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

const matches = roots
  .flatMap(collectFiles)
  .filter((path) => statSync(path).isFile())
  .map((path) => relative(process.cwd(), path))
  .filter((path) => rendererImportPattern.test(readFileSync(path, 'utf8')));

const unexpected = matches.filter((path) => !allowedLegacyFiles.has(path));
const missingLegacy = [...allowedLegacyFiles].filter((path) => !matches.includes(path));

if (unexpected.length > 0) {
  console.error('[rntl-import-guard] New direct react-test-renderer imports are blocked.');
  console.error('');
  console.error('Unexpected files:');
  for (const path of unexpected) console.error(`  - ${path}`);
  console.error('');
  console.error('Use @testing-library/react-native APIs instead.');
  process.exit(1);
}

if (missingLegacy.length > 0) {
  console.warn('[rntl-import-guard] Legacy allowlist can be tightened:');
  for (const path of missingLegacy) console.warn(`  - ${path}`);
}

console.log('[rntl-import-guard] OK: no new direct react-test-renderer imports.');
