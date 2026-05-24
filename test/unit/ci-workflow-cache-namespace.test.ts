import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CI_WORKFLOW_PATH = resolve('.github/workflows/ci.yml');

describe('CI workflow performance history cache namespace', () => {
  it('uses the v5 namespace for both restore and save steps', () => {
    const workflow = readFileSync(CI_WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('performance-history-v5-${{ github.ref_name }}-${{ github.run_id }}');
    expect(workflow).toContain('performance-history-v5-${{ github.ref_name }}-');
    expect(workflow).not.toContain('performance-history-v4-');
  });
});
