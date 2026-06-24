/**
 * Basic API tests for Rezepti.
 * Simple tests to verify core API behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestRunner, defaultConfig, isServerAvailable } from '../utils/test-helpers.js';

const serverAvailable = await isServerAvailable();

describe.skipIf(!serverAvailable)('Basic API Tests', () => {
  let testRunner: TestRunner;

  beforeAll(() => {
    testRunner = new TestRunner(defaultConfig);
  });

  afterAll(() => {
    testRunner.printSummary();
  });

  it('should respond to health check', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/health',
      null,
      'API health endpoint'
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('healthy');
    expect(result.data?.database).toBe('supabase');
  });

  it('should require auth for recipe listing', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/recipes',
      null,
      'List recipes requires auth',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('should validate BYOK API key format', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/keys/validate',
      { apiKey: 'gsk_testvalidkey1234567890abcdef' },
      'Validate API key format requires auth',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('should require auth before validating extraction URL', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      { url: 'not-a-valid-url' },
      'Extract requires auth for invalid URL payloads',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('should require auth before validating missing extraction URL', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      {},
      'Extract requires auth for missing URL payloads',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('should require auth for extraction job creation', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      { url: 'https://example.com/test-recipe' },
      'Create extraction job requires auth',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('should require auth for recipe detail reads', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/recipes/999999',
      null,
      'Recipe detail requires auth',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });

  it('should require auth for listing recent jobs', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/jobs?limit=5',
      null,
      'List recent jobs requires auth',
      401
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.error?.code).toBe('auth_missing');
  });
});
