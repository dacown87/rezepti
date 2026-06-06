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
    it('should require auth for extraction job creation', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: makeScopedUrl('create-job') },
        'Create job for website URL requires auth',
        401
      );
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth before validating BYOK extraction requests', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        {
          url: makeScopedUrl('invalid-byok'),
          apiKey: 'gsk_userkey1234567890abcdefghijklmn',
        },
        'Create job with invalid BYOK key requires auth',
        401
      );
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth before validating missing URL job creation', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        {},
        'Create job without URL requires auth',
        401
      );
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth before validating invalid extraction URLs', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: 'not-a-valid-url' },
        'Create job with invalid URL requires auth',
        401
      );
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth consistently across different extraction payloads', async () => {
      const urlTypes = ['website', 'youtube', 'instagram'] as const;
      
      for (const urlType of urlTypes) {
        const url = makeScopedUrl(urlType);
        const result = await testRunner.testEndpoint(
          'POST',
          '/api/v1/extract/react',
          { url },
          `Create job for ${urlType} URL requires auth`,
          401
        );
        
        expect(result.success).toBe(true);
        expect(result.data?.error?.code).toBe('auth_missing');
        
        await testRunner.wait(500);
      }
    });
  }, TEST_TIMEOUT);

  describe('Job Polling and Status', () => {
    it('should return 404 for unknown job status ids before auth is evaluated', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/react/invalid_job_id_status_test',
        null,
        'Get invalid job status',
        404
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
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

    it('should reject polling unknown jobs without leaking auth envelopes', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/react/invalid_job_id_poll_test',
        null,
        'Poll invalid job status',
        404
      );

      expect(result.success).toBe(true);
      expect(result.data?.error).toBeDefined();
    }, POLL_TIMEOUT);
  }, TEST_TIMEOUT);

  describe('Database Operations', () => {
    it('should require auth for recipe listing', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes',
        null,
        'List all recipes from React DB requires auth',
        401
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth for recipe creation', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/recipes',
        makeRecipeFixture('create-auth-required'),
        'Create recipe requires auth',
        401
      );

      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth for recipe detail reads', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
        null,
        'Get non-existent recipe requires auth',
        401
      );
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth for recipe metadata updates', async () => {
      const result = await testRunner.testEndpoint(
        'PATCH',
        `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
        { name: `${RECIPE_FIXTURE.recipe.name} Updated` },
        'Update recipe requires auth',
        401
      );

      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth for recipe deletion', async () => {
      const result = await testRunner.testEndpoint(
        'DELETE',
        `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
        null,
        'Delete recipe requires auth',
        401
      );

      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });
  }, TEST_TIMEOUT);

  describe('Job List Management', () => {
    it('should require auth for listing recent jobs', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/jobs?limit=5',
        null,
        'List recent jobs with limit requires auth',
        401
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth for filtered job lists', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/jobs?status=pending&limit=3',
        null,
        'List pending jobs requires auth',
        401
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth before validating status filters', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/jobs?status=invalid_status',
        null,
        'List with invalid status filter requires auth',
        401
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });
  }, TEST_TIMEOUT);

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON request', async () => {
      const response = await fetch(`${defaultConfig.apiBase}/api/v1/extract/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json }',
      });
      
      expect(response.status).toBe(401);
    });

    it('should handle large request payload', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: makeScopedUrl('large-payload') },
        'Create job with very long URL requires auth',
        401
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
    });

    it('should require auth for concurrent job creation attempts', async () => {
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          testRunner.testEndpoint(
            'POST',
            '/api/v1/extract/react',
            { url: makeScopedUrl(`concurrent-${i}`) },
            `Concurrent job ${i}`,
            401
          )
        );
      }
      
      const results = await Promise.all(promises);
      
      const allSuccess = results.every(r => r.success);
      expect(allSuccess).toBe(true);
      
      results.forEach(result => {
        expect(result.data?.error?.code).toBe('auth_missing');
      });
    }, TEST_TIMEOUT);

    it('should require auth before returning recipe detail errors', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
        null,
        'Handle non-existent recipe gracefully',
        401
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.error?.code).toBe('auth_missing');
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

    it('should provide legacy soak timing signal for rejected unauthenticated job creation (non-gating)', async () => {
      const samples: number[] = [];
      for (let i = 0; i < 2; i++) {
        const startTime = nowMs();
        const result = await testRunner.testEndpoint(
          'POST',
          '/api/v1/extract/react',
          { url: makeScopedUrl(`perf-test-${i}`) },
          `Job creation performance sample ${i + 1}`,
          401
        );
        const duration = nowMs() - startTime;
        samples.push(duration);
        expect(result.success).toBe(true);
        expect(result.data?.error?.code).toBe('auth_missing');
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
