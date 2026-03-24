/**
 * Basic API Tests for Rezepti React Project
 * Simple tests to verify the API is working
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestRunner, defaultConfig } from '../utils/test-helpers.js';

describe('Basic API Tests', () => {
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
      'React health endpoint'
    );
    
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('healthy');
    expect(result.data?.database).toBe('react');
  });

  it('should list recipes from React database', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/recipes',
      null,
      'List recipes'
    );
    
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    
    // Check recipe structure if there are recipes
    if (result.data.length > 0) {
      const recipe = result.data[0];
      expect(recipe).toHaveProperty('id');
      expect(recipe).toHaveProperty('name');
      expect(recipe).toHaveProperty('source_url');
    }
  });

  it('should validate BYOK API key format', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/keys/validate',
      { apiKey: 'gsk_testvalidkey1234567890abcdef' },
      'Validate API key format'
    );
    
    expect(result.success).toBe(true);
    // The endpoint should return validation result
    expect(result.data).toHaveProperty('valid');
  });

  it('should reject invalid URL for extraction', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      { url: 'not-a-valid-url' },
      'Reject invalid URL',
      400
    );
    
    expect(result.success).toBe(true); // Should succeed with 400 (expected status)
    expect(result.data?.error).toBeDefined(); // Should have error message
  });

  it('should require URL for extraction', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      {},
      'Require URL parameter',
      400
    );
    
    expect(result.success).toBe(true); // Should succeed with 400 (expected status)
    expect(result.data?.error).toBeDefined(); // Should have error message
  });

  it('should create extraction job with valid URL', async () => {
    const result = await testRunner.testEndpoint(
      'POST',
      '/api/v1/extract/react',
      { url: 'https://example.com/test-recipe' },
      'Create extraction job',
      202 // Accepted status
    );
    
    // Job creation should succeed (202 Accepted)
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('jobId');
    expect(result.data?.status).toBe('pending');
    
    // Clean up by polling the job (it will likely fail, but that's okay)
    if (result.data?.jobId) {
      const jobId = result.data.jobId;
      const pollResult = await testRunner.pollJobStatus(jobId, 2, 1000);
      
      // Job polling should work (even if job fails)
      expect(pollResult.data?.id).toBe(jobId);
    }
  });

  it('should handle non-existent recipe ID', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/recipes/999999',
      null,
      'Handle non-existent recipe',
      404
    );
    
    expect(result.success).toBe(true); // Should succeed with 404 (expected status)
    expect(result.data?.error).toBeDefined(); // Should have error message
  });

  it('should list recent jobs', async () => {
    const result = await testRunner.testEndpoint(
      'GET',
      '/api/v1/extract/jobs?limit=5',
      null,
      'List recent jobs'
    );
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('jobs');
    expect(Array.isArray(result.data?.jobs)).toBe(true);
  });
});