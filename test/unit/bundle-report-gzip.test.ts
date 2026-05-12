import { describe, expect, it } from 'vitest';

import { buildBundleReport, createBundleRow } from '../../scripts/performance/bundle-report.mjs';

describe('bundle-report gzip metrics', () => {
  it('tracks gzip JS totals, largest asset gzip size, and duplicate alias groups', () => {
    const sharedJs = 'console.log("shared bundle");'.repeat(40);
    const mainJs = createBundleRow({
      filePath: 'public/assets/main.js',
      content: sharedJs,
      type: 'js',
    });
    const aliasJs = createBundleRow({
      filePath: 'public/assets/main.alias.js',
      content: sharedJs,
      type: 'js',
    });
    const featureJs = createBundleRow({
      filePath: 'public/assets/feature.js',
      content: 'console.log("feature");'.repeat(10),
      type: 'js',
    });
    const css = createBundleRow({
      filePath: 'public/assets/app.css',
      content: '.app { color: tomato; }'.repeat(20),
      type: 'css',
    });

    const report = buildBundleReport(
      [mainJs, aliasJs, featureJs, css],
      {
        bundle: {
          limits: {
            maxJsBytes: 100_000,
            maxGzipJsBytes: 100_000,
          },
        },
      },
      '2026-05-11T00:00:00.000Z',
    );

    expect(report.totals.jsBytes).toBe(mainJs.bytes + aliasJs.bytes + featureJs.bytes);
    expect(report.totals.gzipJsBytes).toBe(mainJs.gzipBytes + aliasJs.gzipBytes + featureJs.gzipBytes);
    expect(report.largestJsAsset).toMatchObject({
      path: 'public/assets/main.js',
      bytes: mainJs.bytes,
      gzipBytes: mainJs.gzipBytes,
    });
    expect(report.top10Unique[0]).toMatchObject({
      path: 'public/assets/main.js',
      aliasCount: 2,
      aliases: ['public/assets/main.js', 'public/assets/main.alias.js'],
      gzipBytes: mainJs.gzipBytes,
    });
    expect(report.duplicateGroups).toEqual([
      expect.objectContaining({
        path: 'public/assets/main.js',
        aliasCount: 2,
        aliases: ['public/assets/main.js', 'public/assets/main.alias.js'],
      }),
    ]);
    expect(report.baseline?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'gzipJsBytes',
          value: report.totals.gzipJsBytes,
          status: 'within',
        }),
      ]),
    );
  });
});
