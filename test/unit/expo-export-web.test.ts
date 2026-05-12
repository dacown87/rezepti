import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_TIMEOUT_SECONDS,
  buildExportCommand,
  classifyExportResult,
  exportMarkerFor,
  parseOutputDir,
  parseTimeoutSeconds,
  shellQuote,
  // @ts-expect-error — .mjs without type declarations
} from '../../scripts/mobile/expo-export-web.mjs';

describe('shellQuote', () => {
  it('wraps plain values in single quotes', () => {
    expect(shellQuote('foo')).toBe(`'foo'`);
  });

  it('escapes embedded single quotes', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`);
  });

  it('coerces numbers via String', () => {
    expect(shellQuote(300)).toBe(`'300'`);
  });
});

describe('parseOutputDir', () => {
  it('returns the value after --output-dir', () => {
    expect(parseOutputDir(['node', 'script', '--output-dir', '../public'])).toBe('../public');
  });

  it('falls back to the default when the flag is absent', () => {
    expect(parseOutputDir(['node', 'script'])).toBe(DEFAULT_OUTPUT_DIR);
  });

  it('falls back when --output-dir has no value', () => {
    expect(parseOutputDir(['node', 'script', '--output-dir'])).toBe(DEFAULT_OUTPUT_DIR);
  });

  it('honours an explicit fallback', () => {
    expect(parseOutputDir(['node', 'script'], '/tmp/elsewhere')).toBe('/tmp/elsewhere');
  });
});

describe('parseTimeoutSeconds', () => {
  it('returns the default when the env value is missing', () => {
    expect(parseTimeoutSeconds(undefined)).toBe(String(DEFAULT_TIMEOUT_SECONDS));
    expect(parseTimeoutSeconds(null)).toBe(String(DEFAULT_TIMEOUT_SECONDS));
    expect(parseTimeoutSeconds('')).toBe(String(DEFAULT_TIMEOUT_SECONDS));
  });

  it('parses a positive integer string', () => {
    expect(parseTimeoutSeconds('180')).toBe('180');
  });

  it('rejects non-numeric values and falls back', () => {
    expect(parseTimeoutSeconds('abc')).toBe(String(DEFAULT_TIMEOUT_SECONDS));
  });

  it('rejects zero and negative values', () => {
    expect(parseTimeoutSeconds('0')).toBe(String(DEFAULT_TIMEOUT_SECONDS));
    expect(parseTimeoutSeconds('-60')).toBe(String(DEFAULT_TIMEOUT_SECONDS));
  });
});

describe('buildExportCommand', () => {
  it('assembles a piped timeout-wrapped expo export with shell-quoted args', () => {
    const command = buildExportCommand({
      outputDir: '../public',
      timeoutSeconds: '300',
      logFile: '/tmp/expo-export-web-x/expo-export.log',
    });

    expect(command).toContain('set -o pipefail');
    expect(command).toContain(`timeout --signal=TERM --kill-after=5s '300's`);
    expect(command).toContain(`npx expo export --platform web --output-dir '../public'`);
    expect(command).toContain(`tee '/tmp/expo-export-web-x/expo-export.log'`);
  });

  it('quotes paths containing spaces and apostrophes', () => {
    const command = buildExportCommand({
      outputDir: `../public dir`,
      timeoutSeconds: '60',
      logFile: `/tmp/path with 'quote'/log`,
    });

    expect(command).toContain(`--output-dir '../public dir'`);
    expect(command).toContain(`tee '/tmp/path with '\\''quote'\\''/log'`);
  });
});

describe('exportMarkerFor', () => {
  it('produces the literal marker string used by Expo CLI', () => {
    expect(exportMarkerFor('../public')).toBe('Exported: ../public');
  });
});

describe('classifyExportResult', () => {
  const marker = 'Exported: ../public';

  it('reports clean exit on exit code 0', () => {
    expect(
      classifyExportResult({ exitCode: 0, logOutput: '', exportMarker: marker }),
    ).toEqual({ success: true, reason: 'clean-exit' });
  });

  it('treats exit 124 plus marker as success (known post-export hang)', () => {
    expect(
      classifyExportResult({
        exitCode: 124,
        logOutput: 'some noise\nExported: ../public\nmore noise',
        exportMarker: marker,
      }),
    ).toEqual({ success: true, reason: 'timeout-after-export' });
  });

  it('treats exit 124 without the marker as a real failure', () => {
    expect(
      classifyExportResult({
        exitCode: 124,
        logOutput: 'Bundling failed',
        exportMarker: marker,
      }),
    ).toEqual({ success: false, reason: 'failure' });
  });

  it('treats a non-124 non-zero exit as a real failure even when the marker is present', () => {
    expect(
      classifyExportResult({
        exitCode: 1,
        logOutput: 'Exported: ../public\nsubsequent crash',
        exportMarker: marker,
      }),
    ).toEqual({ success: false, reason: 'failure' });
  });

  it('handles a missing log output safely', () => {
    expect(
      classifyExportResult({ exitCode: 124, logOutput: undefined, exportMarker: marker }),
    ).toEqual({ success: false, reason: 'failure' });
  });
});
