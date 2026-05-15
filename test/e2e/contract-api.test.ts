import { beforeAll, describe, expect, it } from 'vitest';
import { TestRunner, defaultConfig, isServerAvailable } from '../utils/test-helpers.js';

const TEST_TIMEOUT = 30000;
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

  it('recipe detail endpoint returns seeded recipe by id', async () => {
    const createResult = await testRunner.testEndpoint(
      'POST',
      '/api/v1/recipes',
      CONTRACT_RECIPE_FIXTURE,
      'Create deterministic recipe fixture',
      201
    );

    expect(createResult.success).toBe(true);
    expect(typeof createResult.data?.id).toBe('number');

    const recipeId = createResult.data?.id as number;
    const detailResult = await testRunner.testEndpoint(
      'GET',
      `/api/v1/recipes/${recipeId}`,
      null,
      'Recipe detail contract'
    );

    expect(detailResult.success).toBe(true);
    expect(detailResult.data?.id).toBe(recipeId);
    expect(detailResult.data?.name).toBe(CONTRACT_RECIPE_FIXTURE.recipe.name);
    expect(detailResult.data?.source_url).toBe(CONTRACT_RECIPE_FIXTURE.sourceUrl);
  });

  it('recipe patch endpoint updates deterministic recipe metadata', async () => {
    const createResult = await testRunner.testEndpoint(
      'POST',
      '/api/v1/recipes',
      CONTRACT_RECIPE_FIXTURE,
      'Create deterministic recipe fixture for patch contract',
      201
    );

    expect(createResult.success).toBe(true);
    expect(typeof createResult.data?.id).toBe('number');

    const recipeId = createResult.data?.id as number;
    const patchedName = `${CONTRACT_RECIPE_FIXTURE.recipe.name} Patched`;
    const patchResult = await testRunner.testEndpoint(
      'PATCH',
      `/api/v1/recipes/${recipeId}`,
      { name: patchedName },
      'Recipe patch contract',
      200
    );

    expect(patchResult.success).toBe(true);
    expect(patchResult.data?.success).toBe(true);

    const detailAfterPatchResult = await testRunner.testEndpoint(
      'GET',
      `/api/v1/recipes/${recipeId}`,
      null,
      'Recipe patch verification contract'
    );
    expect(detailAfterPatchResult.success).toBe(true);
    expect(detailAfterPatchResult.data?.id).toBe(recipeId);
    expect(detailAfterPatchResult.data?.name).toBe(patchedName);
  });

  it('recipe delete endpoint removes deterministic recipe and detail returns 404', async () => {
    const createResult = await testRunner.testEndpoint(
      'POST',
      '/api/v1/recipes',
      CONTRACT_RECIPE_FIXTURE,
      'Create deterministic recipe fixture for delete contract',
      201
    );

    expect(createResult.success).toBe(true);
    expect(typeof createResult.data?.id).toBe('number');

    const recipeId = createResult.data?.id as number;
    const deleteResult = await testRunner.testEndpoint(
      'DELETE',
      `/api/v1/recipes/${recipeId}`,
      null,
      'Recipe delete contract',
      200
    );

    expect(deleteResult.success).toBe(true);

    const verifyDeletedResult = await testRunner.testEndpoint(
      'GET',
      `/api/v1/recipes/${recipeId}`,
      null,
      'Recipe delete verification contract',
      404
    );

    expect(verifyDeletedResult.success).toBe(true);
    expect(verifyDeletedResult.data?.error).toBeDefined();
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
