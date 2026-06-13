/**
 * PWA Icon Generator
 *
 * Regenerates all PWA icon PNGs from the source assets in mobile/assets/images/.
 *
 * Usage:
 *   npm i sharp --no-save
 *   npx tsx scripts/pwa/generate-icons.ts
 *
 * This script is an optional local tool — it is NOT wired into any build step
 * and NOT run in CI. The generated PNG files are committed to the repository
 * so no runtime dependency on sharp is needed.
 */

import sharp from 'sharp';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SRC_ICON = join(ROOT, 'mobile', 'assets', 'images', 'icon.png');
const SRC_ADAPTIVE = join(ROOT, 'mobile', 'assets', 'images', 'adaptive-icon.png');
const OUT_DIR = join(ROOT, 'mobile', 'public');

async function generate(): Promise<void> {
  console.log('Generating PWA icons from source assets...');

  // icon-192.png — 192x192, purpose "any"
  await sharp(SRC_ICON)
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, 'icon-192.png'));
  console.log('  icon-192.png');

  // icon-512.png — 512x512, purpose "any"
  await sharp(SRC_ICON)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, 'icon-512.png'));
  console.log('  icon-512.png');

  // icon-512-maskable.png — 512x512, purpose "maskable"
  // 10% safe-zone padding: icon occupies 80% of the canvas, centered on brand background
  const padding = Math.round(512 * 0.10); // 51px each side
  const innerSize = 512 - padding * 2;    // 410px
  const iconBuf = await sharp(SRC_ADAPTIVE)
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0xff, g: 0xf8, b: 0xef, alpha: 1 },
    },
  })
    .composite([{ input: iconBuf, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, 'icon-512-maskable.png'));
  console.log('  icon-512-maskable.png');

  // apple-touch-icon-180.png — 180x180 for iOS home screen
  await sharp(SRC_ICON)
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, 'apple-touch-icon-180.png'));
  console.log('  apple-touch-icon-180.png');

  // Verify output dimensions
  console.log('\nVerifying output dimensions:');
  const checks: Array<[string, number, number]> = [
    ['icon-192.png', 192, 192],
    ['icon-512.png', 512, 512],
    ['icon-512-maskable.png', 512, 512],
    ['apple-touch-icon-180.png', 180, 180],
  ];
  for (const [file, expectedW, expectedH] of checks) {
    const meta = await sharp(join(OUT_DIR, file)).metadata();
    const ok = meta.width === expectedW && meta.height === expectedH;
    console.log(`  ${file}: ${meta.width}x${meta.height} ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) process.exit(1);
  }

  console.log('\nAll icons generated successfully.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
