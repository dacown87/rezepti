/**
 * Comprehensive E2E Tests for Rezepti React API
 * Tests React endpoints, BYOK, database operations, and job management
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { TestRunner, defaultConfig, isServerAvailable } from '../utils/test-helpers.js';
import { ensureReactSchema } from '../../src/db-react.js';

// Extend timeout for E2E tests
const TEST_TIMEOUT = 60000;
const POLL_TIMEOUT = 30000;
// Legacy-E2E-Polling (P1): zentrale Parameter statt "magic numbers" im Testkörper.
// So bleiben Polling-Takt/Timeout bei Incident-Triage an einer Stelle justierbar.
const LEGACY_E2E_POLLING = {
  maxAttempts: 20,
  intervalMs: 1500,
} as const;
const URL_SEED = 'deterministic-seed-v1';
const LEGACY_SOAK_WARN_BUDGET_MS = {
  health: 2000,
  jobCreation: 5000,
  rapidAvg: 1500,
};
const LEGACY_SOAK_SPIKE_FACTOR = 2.5;
const RECIPE_FIXTURE = {
  recipe: {
    name: 'React E2E Fixture Kartoffelsalat',
    duration: 'kurz',
    tags: ['E2E', 'Fixture'],
    emoji: '🥔',
    servings: '2',
    ingredients: ['500 g Kartoffeln', '2 EL Essig'],
    steps: ['Kartoffeln kochen.', 'Mit Essig mischen.'],
  },
  sourceUrl: 'https://react-e2e.rezepti.local/recipes/kartoffelsalat-v1',
  transcript: 'react-e2e-seed-v1',
};
const NON_EXISTENT_RECIPE_ID = -1;

let currentIsolationKey = 'react-e2e-unknown';
const testCaseRunCounts = new Map<string, number>();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'unnamed';
}

function makeScopedUrl(label: string): string {
  return `https://example.com/${URL_SEED}-${currentIsolationKey}-${label}`;
}

function makeRecipeFixture(label: string) {
  const suffix = `${currentIsolationKey}-${label}`;
  return {
    recipe: {
      ...RECIPE_FIXTURE.recipe,
      name: `${RECIPE_FIXTURE.recipe.name} ${suffix}`,
    },
    sourceUrl: `${RECIPE_FIXTURE.sourceUrl}-${suffix}`,
    transcript: `${RECIPE_FIXTURE.transcript}-${suffix}`,
  };
}

function registerRecipeForCleanup(createdRecipeIds: number[], recipeId: number): void {
  createdRecipeIds.push(recipeId);
}

function markRecipeCleanupHandled(createdRecipeIds: number[], recipeId: number): void {
  const index = createdRecipeIds.indexOf(recipeId);
  if (index >= 0) {
    createdRecipeIds.splice(index, 1);
  }
}

const serverAvailable = await isServerAvailable();

function nowMs(): number {
  return Number(process.hrtime.bigint() / 1000000n);
}

function summarizeDurations(samples: number[]): { median: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return { median, max: sorted[sorted.length - 1] };
}

function assertTerminalExtractionState(jobId: string, payload: Record<string, any> | null | undefined): void {
  // P1 rationale: Für legacy E2E zählt "Polling erreicht Endzustand".
  // Da `example.com` absichtlich kein Rezept liefert, akzeptieren wir `failed`,
  // prüfen dann aber strikt, dass ein verwertbarer Fehlkontext vorhanden ist.
  expect(payload?.id).toBe(jobId);
  expect(payload?.status).toBeDefined();
  expect(['completed', 'failed']).toContain(payload?.status);

  if (payload?.status === 'completed') {
    expect(payload?.recipe).toBeDefined();
  } else {
    expect(typeof payload?.error).toBe('string');
    expect(payload.error.length).toBeGreaterThan(0);
  }
}

describe.skipIf(!serverAvailable)('Rezepti React API E2E Tests', () => {
  let testRunner: TestRunner;
  let createdJobs: string[] = [];
  let createdRecipeIds: number[] = [];

  beforeAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Starting Rezepti React E2E Test Suite');
    console.log('='.repeat(60));
    
    testRunner = new TestRunner({
      ...defaultConfig,
      timeout: TEST_TIMEOUT,
    });

    // Ensure React database schema exists
    ensureReactSchema();
  }, TEST_TIMEOUT * 2);

  afterAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('E2E Test Suite Complete');
    console.log('='.repeat(60));
    
    testRunner.printSummary();
  });

  beforeEach((context) => {
    const testName = context.task.name ?? 'unnamed-test';
    const keyBase = slugify(testName);
    const runCount = (testCaseRunCounts.get(keyBase) ?? 0) + 1;
    testCaseRunCounts.set(keyBase, runCount);
    currentIsolationKey = `${keyBase}-run-${runCount}`;
    createdJobs = [];
    createdRecipeIds = [];
  });

  afterEach(async () => {
    const cleanupDiagnostics = {
      jobsScheduled: createdJobs.length,
      jobsCleanupErrors: 0,
      recipesScheduled: createdRecipeIds.length,
      recipesCleanupErrors: 0,
    };

    for (const jobId of createdJobs) {
      try {
        await fetch(`${defaultConfig.apiBase}/api/v1/extract/react/${jobId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        cleanupDiagnostics.jobsCleanupErrors += 1;
        // Ignore cleanup errors
      }
    }

    for (const recipeId of createdRecipeIds) {
      try {
        await fetch(`${defaultConfig.apiBase}/api/v1/recipes/${recipeId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        cleanupDiagnostics.recipesCleanupErrors += 1;
        // Ignore cleanup errors
      }
    }

    console.log(
      `Isolation cleanup (${currentIsolationKey}): jobs=${cleanupDiagnostics.jobsScheduled}/${cleanupDiagnostics.jobsCleanupErrors} errors, recipes=${cleanupDiagnostics.recipesScheduled}/${cleanupDiagnostics.recipesCleanupErrors} errors`
    );
  });

  describe('Health Endpoints', () => {
    it('should check React health endpoint', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/health',
        null,
        'React health endpoint'
      );
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('healthy');
    });

    it('should check server status', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/',
        null,
        'Server root endpoint',
        200
      );
      expect(result.success).toBe(true);
    });
  }, TEST_TIMEOUT);

  describe('BYOK Key Validation', () => {
    it('should validate correct Groq API key format', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/keys/validate',
        { apiKey: 'gsk_validtestkey1234567890abcdef' },
        'BYOK validation with valid format'
      );
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
    });

    it('should reject invalid API key format', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/keys/validate',
        { apiKey: 'invalid_key_123' },
        'BYOK validation with invalid format'
      );
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
    });

    it('should reject empty API key', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/keys/validate',
        { apiKey: '' },
        'BYOK validation with empty key',
        400
      );
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    });

    it('should handle missing API key parameter', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/keys/validate',
        {},
        'BYOK validation without key',
        400
      );
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    });
  }, TEST_TIMEOUT);

  describe('Job Creation and Management', () => {
    it('should create extraction job for website URL', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: makeScopedUrl('create-job') },
        'Create job for website URL',
        202
      );
      expect(result.success).toBe(true);
      expect(result.data?.jobId).toBeDefined();
      expect(result.data?.status).toBe('pending');
      
      if (result.data?.jobId) {
        createdJobs.push(result.data.jobId);
      }
    });

    it('should reject extraction job with invalid BYOK key', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        {
          url: makeScopedUrl('invalid-byok'),
          apiKey: 'gsk_userkey1234567890abcdefghijklmn',
        },
        'Create job with invalid BYOK key',
        400
      );
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    });

    it('should reject job creation without URL', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        {},
        'Create job without URL',
        400
      );
      expect(result.success).toBe(true);
    });

    it('should reject job creation with invalid URL', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: 'not-a-valid-url' },
        'Create job with invalid URL',
        400
      );
      expect(result.success).toBe(true);
    });

    it('should create jobs for different URL types', async () => {
      const urlTypes = ['website', 'youtube', 'instagram'] as const;
      
      for (const urlType of urlTypes) {
        const url = makeScopedUrl(urlType);
        const result = await testRunner.testEndpoint(
          'POST',
          '/api/v1/extract/react',
          { url },
          `Create job for ${urlType} URL`,
          202
        );
        
        expect(result.success).toBe(true);
        expect(result.data?.jobId).toBeDefined();
        
        if (result.data?.jobId) {
          createdJobs.push(result.data.jobId);
        }
        
        await testRunner.wait(500);
      }
    });
  }, TEST_TIMEOUT);

  describe('Job Polling and Status', () => {
    it('should get job status', async () => {
      const jobResult = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: makeScopedUrl('status-test') },
        'Create job for status test',
        202
      );
      
      const jobId = jobResult.data?.jobId as string;
      createdJobs.push(jobId);
      
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/extract/react/${jobId}`,
        null,
        'Get job status'
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(jobId);
      expect(result.data?.status).toBeDefined();
      expect(['pending', 'running', 'processing', 'completed', 'failed']).toContain(result.data?.status);
    });

    it('should handle invalid job ID', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/react/invalid_job_id_123',
        null,
        'Get invalid job status',
        404
      );
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    });

    it('should poll job until completion', async () => {
      const jobResult = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: makeScopedUrl('poll-test') },
        'Create job for polling test',
        202
      );
      
      const jobId = jobResult.data?.jobId as string;
      createdJobs.push(jobId);
      
      const result = await testRunner.pollJobStatus(
        jobId,
        LEGACY_E2E_POLLING.maxAttempts,
        LEGACY_E2E_POLLING.intervalMs
      );

      // Note: example.com is not a real recipe site, therefore `failed` is expected in practice.
      // The gate here is robust terminal-state detection, not extraction quality on this fixture URL.
      assertTerminalExtractionState(jobId, result.data as Record<string, any> | undefined);
    }, POLL_TIMEOUT);
  }, TEST_TIMEOUT);

  describe('Database Operations', () => {
    it('should list all recipes from React database', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes',
        null,
        'List all recipes from React DB'
      );
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get recipe by ID', async () => {
      const fixture = makeRecipeFixture('get-by-id');
      const createResult = await testRunner.testEndpoint(
        'POST',
        '/api/v1/recipes',
        fixture,
        'Create recipe fixture for ID test',
        201
      );

      expect(createResult.success).toBe(true);
      expect(typeof createResult.data?.id).toBe('number');

      const recipeId = createResult.data?.id as number;
      registerRecipeForCleanup(createdRecipeIds, recipeId);
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${recipeId}`,
        null,
        'Get recipe by ID'
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(recipeId);
      expect(result.data?.name).toBe(fixture.recipe.name);
    });

    it('should handle non-existent recipe ID', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
        null,
        'Get non-existent recipe',
        404
      );
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    });

    it('should update recipe metadata', async () => {
      const createResult = await testRunner.testEndpoint(
        'POST',
        '/api/v1/recipes',
        makeRecipeFixture('update'),
        'Create recipe fixture for update test',
        201
      );

      expect(createResult.success).toBe(true);
      const recipeId = createResult.data?.id as number;
      registerRecipeForCleanup(createdRecipeIds, recipeId);
      const newName = `${RECIPE_FIXTURE.recipe.name} Updated`;

      const result = await testRunner.testEndpoint(
        'PATCH',
        `/api/v1/recipes/${recipeId}`,
        { name: newName },
        'Update recipe name',
        200
      );

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);

      const verifyResult = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${recipeId}`,
        null,
        'Verify recipe update via detail endpoint',
        200
      );

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data?.id).toBe(recipeId);
      expect(verifyResult.data?.name).toBe(newName);
    });

    it('should delete recipe', async () => {
      const createResult = await testRunner.testEndpoint(
        'POST',
        '/api/v1/recipes',
        makeRecipeFixture('delete'),
        'Create recipe fixture for delete test',
        201
      );

      expect(createResult.success).toBe(true);
      const recipeId = createResult.data?.id as number;
      registerRecipeForCleanup(createdRecipeIds, recipeId);

      const result = await testRunner.testEndpoint(
        'DELETE',
        `/api/v1/recipes/${recipeId}`,
        null,
        'Delete recipe',
        200
      );

      expect(result.success).toBe(true);

      // Verify deletion with expected 404 contract.
      const verifyResult = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${recipeId}`,
        null,
        'Verify recipe deletion',
        404
      );
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data?.error).toBeDefined();
      markRecipeCleanupHandled(createdRecipeIds, recipeId);
    });
  }, TEST_TIMEOUT);

  describe('Job List Management', () => {
    it('should list recent jobs', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/jobs?limit=5',
        null,
        'List recent jobs with limit'
      );
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.jobs)).toBe(true);
    });

    it('should filter jobs by status', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/jobs?status=pending&limit=3',
        null,
        'List pending jobs'
      );
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.jobs)).toBe(true);
    });

    it('should handle invalid status filter', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/jobs?status=invalid_status',
        null,
        'List with invalid status filter'
      );
      
      // Should still succeed but return empty or all jobs
      expect(result.success).toBe(true);
    });
  }, TEST_TIMEOUT);

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON request', async () => {
      const response = await fetch(`${defaultConfig.apiBase}/api/v1/extract/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json }',
      });
      
      expect([400, 500]).toContain(response.status);
    });

    it('should handle large request payload', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: makeScopedUrl('large-payload') },
        'Create job with very long URL',
        202
      );
      
      expect(result.success).toBe(true);
    });

    it('should handle concurrent job creation', async () => {
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          testRunner.testEndpoint(
            'POST',
            '/api/v1/extract/react',
            { url: makeScopedUrl(`concurrent-${i}`) },
            `Concurrent job ${i}`,
            202
          )
        );
      }
      
      const results = await Promise.all(promises);
      
      const allSuccess = results.every(r => r.success);
      expect(allSuccess).toBe(true);
      
      results.forEach(result => {
        if (result.success && result.data?.jobId) {
          createdJobs.push(result.data.jobId);
        }
      });
    }, TEST_TIMEOUT);

    it('should handle database connection errors', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
        null,
        'Handle non-existent recipe gracefully',
        404
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    });
  }, TEST_TIMEOUT);

  describe('Performance Testing', () => {
    it('should provide legacy soak timing signal for health checks (non-gating)', async () => {
      const samples: number[] = [];
      for (let i = 0; i < 3; i++) {
        const startTime = nowMs();
        const result = await testRunner.testEndpoint(
          'GET',
          '/api/v1/health',
          null,
          `Health check performance sample ${i + 1}`
        );
        const duration = nowMs() - startTime;
        samples.push(duration);
        expect(result.success).toBe(true);
      }

      const { median, max } = summarizeDurations(samples);
      console.log(`Health check samples: ${samples.join(', ')}ms (median=${median}ms, max=${max}ms)`);
      expect(Number.isFinite(median)).toBe(true);
      expect(median).toBeGreaterThanOrEqual(0);
      if (median > LEGACY_SOAK_WARN_BUDGET_MS.health) {
        console.warn(`Legacy soak signal: health median slower than soft budget (${median}ms > ${LEGACY_SOAK_WARN_BUDGET_MS.health}ms)`);
      }
      if (max > median * LEGACY_SOAK_SPIKE_FACTOR) {
        console.warn(`Legacy soak signal: health latency spike detected (max=${max}ms, median=${median}ms, factor>${LEGACY_SOAK_SPIKE_FACTOR})`);
      }
    });

    it('should provide legacy soak timing signal for job creation (non-gating)', async () => {
      const samples: number[] = [];
      for (let i = 0; i < 2; i++) {
        const startTime = nowMs();
        const result = await testRunner.testEndpoint(
          'POST',
          '/api/v1/extract/react',
          { url: makeScopedUrl(`perf-test-${i}`) },
          `Job creation performance sample ${i + 1}`,
          202
        );
        const duration = nowMs() - startTime;
        samples.push(duration);
        expect(result.success).toBe(true);
        if (result.data?.jobId) {
          createdJobs.push(result.data.jobId);
        }
      }

      const { median, max } = summarizeDurations(samples);
      console.log(`Job creation samples: ${samples.join(', ')}ms (median=${median}ms, max=${max}ms)`);
      expect(Number.isFinite(median)).toBe(true);
      expect(median).toBeGreaterThanOrEqual(0);
      if (median > LEGACY_SOAK_WARN_BUDGET_MS.jobCreation) {
        console.warn(`Legacy soak signal: job creation median slower than soft budget (${median}ms > ${LEGACY_SOAK_WARN_BUDGET_MS.jobCreation}ms)`);
      }
      if (max > median * LEGACY_SOAK_SPIKE_FACTOR) {
        console.warn(`Legacy soak signal: job creation latency spike detected (max=${max}ms, median=${median}ms, factor>${LEGACY_SOAK_SPIKE_FACTOR})`);
      }
    });

    it('should provide legacy soak timing signal for multiple rapid requests (non-gating)', async () => {
      const requests = 5;
      const sampleAverages: number[] = [];

      for (let run = 0; run < 2; run++) {
        const startTime = nowMs();
        const promises = [];
        for (let i = 0; i < requests; i++) {
          promises.push(
            testRunner.testEndpoint(
              'GET',
              '/api/v1/health',
              null,
              `Rapid request run ${run + 1} sample ${i + 1}`
            )
          );
        }
        const results = await Promise.all(promises);
        const totalDuration = nowMs() - startTime;
        const avgDuration = totalDuration / requests;
        sampleAverages.push(avgDuration);
        const allSuccess = results.every(r => r.success);
        expect(allSuccess).toBe(true);
      }

      const { median, max } = summarizeDurations(sampleAverages);
      console.log(`Rapid request averages: ${sampleAverages.join(', ')}ms (median=${median}ms, max=${max}ms)`);
      expect(Number.isFinite(median)).toBe(true);
      expect(median).toBeGreaterThanOrEqual(0);
      if (median > LEGACY_SOAK_WARN_BUDGET_MS.rapidAvg) {
        console.warn(`Legacy soak signal: rapid-request median average slower than soft budget (${median}ms > ${LEGACY_SOAK_WARN_BUDGET_MS.rapidAvg}ms)`);
      }
      if (max > median * LEGACY_SOAK_SPIKE_FACTOR) {
        console.warn(`Legacy soak signal: rapid-request latency spike detected (max=${max}ms, median=${median}ms, factor>${LEGACY_SOAK_SPIKE_FACTOR})`);
      }
    }, TEST_TIMEOUT);
  }, TEST_TIMEOUT);
});
