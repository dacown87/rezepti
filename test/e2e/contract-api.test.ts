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

  it('recipes endpoint requires authentication', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/recipes',
      null,
      'Recipes list auth contract',
      401
    );

    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
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

  it('job list endpoint requires authentication', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/jobs?limit=5',
      null,
      'Job list auth contract',
      401
    );

    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('job list endpoint rejects unauthenticated limit queries', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/jobs?limit=1',
      null,
      'Job list limit auth contract',
      401
    );

    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('BYOK validation requires authentication before payload validation', async () => {
    // /api/v1/keys/validate is protected by requireUserAuth(); auth runs before body parsing
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/keys/validate',
      { apiKey: '' },
      'BYOK validate auth contract',
      401
    );

    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('extract endpoint requires authentication before payload validation', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      {},
      'Extract auth contract',
      401
    );

    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
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
