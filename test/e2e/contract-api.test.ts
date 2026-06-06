import { beforeAll, describe, expect, it } from 'vitest';
import { TestRunner, defaultConfig, isServerAvailable } from '../utils/test-helpers.js';

const TEST_TIMEOUT = 30000;
const NON_EXISTENT_RECIPE_ID = -1;
const CONTRACT_RECIPE_FIXTURE = {
  recipe: {
    name: 'Contract Test Kartoffelsalat',
    duration: 'kurz',
    tags: ['Test', 'Salat'],
    emoji: '🥗',
    servings: '2',
    ingredients: ['500 g Kartoffeln', '1 EL Senf', '2 EL Essig'],
    steps: ['Kartoffeln kochen.', 'Mit den restlichen Zutaten vermengen.'],
  },
  sourceUrl: 'https://contract-test.rezepti.local/recipes/kartoffelsalat-v1',
  transcript: 'contract-test-seed-v1',
};
const serverAvailable = await isServerAvailable();

describe.skipIf(!serverAvailable)('Root API Contract (CI Gate)', () => {
  let testRunner: TestRunner;

  beforeAll(() => {
    testRunner = new TestRunner({
      ...defaultConfig,
      timeout: TEST_TIMEOUT,
    });
  });

  it('health endpoint returns expected shape', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/health',
      null,
      'Health contract'
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('healthy');
    expect(result.data?.database).toBe('supabase');
  });

  it('recipes endpoint responds with an array', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/recipes',
      null,
      'Recipes list contract'
    );

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('recipe create endpoint requires authentication', async () => {
    const createResult = await testRunner.testEndpoint(
      'POST',
      '/api/v1/recipes',
      CONTRACT_RECIPE_FIXTURE,
      'Recipe create auth contract',
      401
    );

    expect(createResult.success).toBe(true);
    expect(createResult.data?.error?.code).toBe('auth_missing');
  });

  it('recipe patch endpoint requires authentication', async () => {
    const patchResult = await testRunner.testEndpoint(
      'PATCH',
      `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
      { name: `${CONTRACT_RECIPE_FIXTURE.recipe.name} Patched` },
      'Recipe patch auth contract',
      401
    );

    expect(patchResult.success).toBe(true);
    expect(patchResult.data?.error?.code).toBe('auth_missing');
  });

  it('recipe delete endpoint requires authentication', async () => {
    const deleteResult = await testRunner.testEndpoint(
      'DELETE',
      `/api/v1/recipes/${NON_EXISTENT_RECIPE_ID}`,
      null,
      'Recipe delete auth contract',
      401
    );

    expect(deleteResult.success).toBe(true);
    expect(deleteResult.data?.error?.code).toBe('auth_missing');
  });

  it('job list endpoint returns jobs array envelope', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/jobs?limit=5',
      null,
      'Job list contract'
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('jobs');
    expect(Array.isArray(result.data?.jobs)).toBe(true);
  });

  it('job list endpoint enforces limit and returns stable job shape', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/jobs?limit=1',
      null,
      'Job list limit + shape contract'
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data).toHaveProperty('jobs');
    expect(Array.isArray(result.data?.jobs)).toBe(true);
    expect(result.data!.jobs.length).toBeLessThanOrEqual(1);

    if (result.data!.jobs.length > 0) {
      const [job] = result.data!.jobs as Array<Record<string, unknown>>;
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('createdAt');
      expect(job).toHaveProperty('updatedAt');
      expect(typeof job.id).toBe('string');
      expect(typeof job.status).toBe('string');
      expect(typeof job.createdAt).toBe('number');
      expect(typeof job.updatedAt).toBe('number');
    }
  });

  it('BYOK validation rejects empty key with 400', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/keys/validate',
      { apiKey: '' },
      'BYOK empty key contract',
      400
    );

    expect(result.success).toBe(true);
    expect(result.data?.error).toBeDefined();
  });

  it('BYOK validation rejects missing key parameter with stable 400 error envelope', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/keys/validate',
      {},
      'BYOK missing key contract',
      400
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(typeof result.data?.error).toBe('string');
    expect((result.data?.error as string).length).toBeGreaterThan(0);
    expect(result.data).not.toHaveProperty('valid', true);
  });

  it('extract endpoint rejects missing URL with 400', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      {},
      'Extract missing URL contract',
      400
    );

    expect(result.success).toBe(true);
    expect(result.data?.error).toBeDefined();
  });

  it('job status endpoint returns 404 for unknown job id', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/react/invalid_job_id_contract',
      null,
      'Unknown job status contract',
      404
    );

    expect(result.success).toBe(true);
    expect(result.data?.error).toBeDefined();
  });
});
