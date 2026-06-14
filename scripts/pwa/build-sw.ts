/**
 * scripts/pwa/build-sw.ts
 *
 * Bundles mobile/sw/sw.ts → public/sw.js using esbuild (IIFE, minified).
 *
 * Steps:
 *  1. Glob real exported assets from public/ (JS chunks, CSS, index.html).
 *  2. Build a precache manifest [ { url, revision } ].
 *     - JS/CSS carry a content hash in the filename → revision: null.
 *     - /index.html has no hash → revision = md5(content).
 *  3. Cap total precached JS at JS_SIZE_LIMIT_BYTES — throw if exceeded.
 *  4. Derive a short build hash from the manifest (for cache names).
 *  5. Bundle sw.ts with esbuild, injecting manifest + hash via `define`.
 *  6. Write public/sw.js.
 *
 * Run with: npx tsx scripts/pwa/build-sw.ts
 */

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const publicDir = join(repoRoot, 'public');
const swSrc = join(repoRoot, 'mobile/sw/sw.ts');
const swOut = join(publicDir, 'sw.js');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// 5 MB cap is now achievable because the PDF-export-only chunks (pdf-export,
// html2canvas, purify) are excluded from the precache manifest (see PRECACHE_EXCLUDE
// below). Those chunks are cached at runtime by the CacheFirst handler on
// /_expo/static/**, so they are served from cache on first online use without
// needing to bloat the precache payload.
const JS_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB

// PDF export is an online-only action; its chunks are cached at runtime
// (CacheFirst on /_expo/static/**), so they need not bloat the precache.
const PRECACHE_EXCLUDE = /\/(pdf-export|html2canvas|purify)-[a-f0-9]+\.js$/;

// ---------------------------------------------------------------------------
// Collect assets to precache
// ---------------------------------------------------------------------------

type ManifestEntry = { url: string; revision: string | null };

function contentHash(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('md5').update(content).digest('hex').slice(0, 8);
}

function buildManifest(): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  let totalJsBytes = 0;

  // JS chunks — filenames embed content hash → revision: null
  // PDF-export-only chunks are excluded (see PRECACHE_EXCLUDE) — they are served
  // by the runtime CacheFirst handler for /_expo/static/** on first online use.
  const jsFiles = globSync('_expo/static/js/web/*.js', { cwd: publicDir });
  for (const rel of jsFiles) {
    const url = `/${rel.replace(/\\/g, '/')}`;
    if (PRECACHE_EXCLUDE.test(url)) continue;
    const abs = join(publicDir, rel);
    const stat = readFileSync(abs);
    totalJsBytes += stat.length;
    entries.push({ url, revision: null });
  }

  if (totalJsBytes > JS_SIZE_LIMIT_BYTES) {
    const limitMb = (JS_SIZE_LIMIT_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(
      `[build-sw] Precached JS exceeds ${limitMb} MB limit: ${(totalJsBytes / 1024 / 1024).toFixed(2)} MB ` +
      `(${totalJsBytes} bytes). Reduce bundle size before shipping the service worker.`,
    );
  }

  // CSS — filenames embed content hash → revision: null
  const cssFiles = globSync('_expo/static/css/**/*.css', { cwd: publicDir });
  for (const rel of cssFiles) {
    entries.push({ url: `/${rel.replace(/\\/g, '/')}`, revision: null });
  }

  // /index.html — no hash in filename → real revision
  const indexPath = join(publicDir, 'index.html');
  entries.push({ url: '/index.html', revision: contentHash(indexPath) });

  return entries;
}

// ---------------------------------------------------------------------------
// Derive build hash from manifest (stable, short)
// ---------------------------------------------------------------------------
function manifestHash(manifest: ManifestEntry[]): string {
  const json = JSON.stringify(manifest);
  return createHash('sha256').update(json).digest('hex').slice(0, 8);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('[build-sw] Collecting precache manifest…');
  const manifest = buildManifest();
  const hash = manifestHash(manifest);

  console.log(`[build-sw] ${manifest.length} entries, hash=${hash}`);
  for (const e of manifest) {
    console.log(`  ${e.url}  revision=${e.revision ?? '(filename-hash)'}`);
  }

  console.log('[build-sw] Bundling sw.ts → public/sw.js…');

  await build({
    entryPoints: [swSrc],
    outfile: swOut,
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['chrome96', 'firefox96', 'safari16'],
    define: {
      // Inject precache manifest — sw.ts reads bare `__WB_MANIFEST`
      '__WB_MANIFEST': JSON.stringify(manifest),
      // Inject cache-name hash
      '__CACHE_HASH__': JSON.stringify(hash),
    },
    // Silence "browser" / "node" env warnings — SW is its own target
    conditions: ['browser'],
    // Workbox uses `self` global — let esbuild know this is not node
    platform: 'browser',
  });

  const outSize = readFileSync(swOut).length;
  console.log(`[build-sw] Done → public/sw.js (${(outSize / 1024).toFixed(1)} KB raw)`);
  console.log(`[build-sw] Cache names: rd-shell-v${hash}, rd-assets-v${hash}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
