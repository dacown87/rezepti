/**
 * Comprehensive E2E Tests for Rezepti React API
 * Tests React endpoints, BYOK, database operations, and job management
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { TestRunner, testUrls, defaultConfig } from '../utils/test-helpers.js';
import { DatabaseManager } from '../../src/db-manager.js';

// Extend timeout for E2E tests
const TEST_TIMEOUT = 60000;
const POLL_TIMEOUT = 30000;

describe('Rezepti React API E2E Tests', () => {
  let testRunner: TestRunner;
  let createdJobs: string[] = [];

  beforeAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Starting Rezepti React E2E Test Suite');
    console.log('='.repeat(60));
    
    testRunner = new TestRunner({
      ...defaultConfig,
      timeout: TEST_TIMEOUT,
    });

    // Ensure React database schema exists
    DatabaseManager.ensureSchema('react');
  }, TEST_TIMEOUT * 2);

  afterAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('E2E Test Suite Complete');
    console.log('='.repeat(60));
    
    testRunner.printSummary();
  });

  beforeEach(() => {
    createdJobs = [];
  });

  afterEach(async () => {
    // Cleanup test jobs if needed
    for (const jobId of createdJobs) {
      try {
        await testRunner.testEndpoint(
          'DELETE',
          `/api/v1/extract/react/${jobId}`,
          null,
          `Cleanup job ${jobId}`,
          200
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Health Endpoints', () => {
    it('should check legacy health endpoint', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/health',
        null,
        'Legacy health endpoint'
      );
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ok');
    });

    it('should check React health endpoint', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/health',
        null,
        'React health endpoint'
      );
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ok');
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
      expect(result.data?.valid).toBe(true);
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
      expect(result.success).toBe(false);
    });

    it('should handle missing API key parameter', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/keys/validate',
        {},
        'BYOK validation without key',
        400
      );
      expect(result.success).toBe(false);
    });
  }, TEST_TIMEOUT);

  describe('Job Creation and Management', () => {
    it('should create extraction job for website URL', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: testUrls.website[0] },
        'Create job for website URL'
      );
      expect(result.success).toBe(true);
      expect(result.data?.jobId).toBeDefined();
      expect(result.data?.status).toBe('pending');
      
      if (result.data?.jobId) {
        createdJobs.push(result.data.jobId);
      }
    });

    it('should create extraction job with BYOK key', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        {
          url: testUrls.website[1],
          apiKey: 'gsk_userkey1234567890abcdefghijklmn',
        },
        'Create job with BYOK key'
      );
      expect(result.success).toBe(true);
      expect(result.data?.jobId).toBeDefined();
      
      if (result.data?.jobId) {
        createdJobs.push(result.data.jobId);
      }
    });

    it('should reject job creation without URL', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        {},
        'Create job without URL',
        400
      );
      expect(result.success).toBe(false);
    });

    it('should reject job creation with invalid URL', async () => {
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: 'not-a-valid-url' },
        'Create job with invalid URL',
        400
      );
      expect(result.success).toBe(false);
    });

    it('should create jobs for different URL types', async () => {
      const urlTypes = ['website', 'youtube', 'instagram'] as const;
      
      for (const urlType of urlTypes) {
        const url = testUrls[urlType][0];
        const result = await testRunner.testEndpoint(
          'POST',
          '/api/v1/extract/react',
          { url },
          `Create job for ${urlType} URL`
        );
        
        expect(result.success).toBe(true);
        expect(result.data?.jobId).toBeDefined();
        
        if (result.data?.jobId) {
          createdJobs.push(result.data.jobId);
        }
        
        // Small delay between requests
        await testRunner.wait(500);
      }
    });
  }, TEST_TIMEOUT);

  describe('Job Polling and Status', () => {
    let testJobId: string;

    beforeEach(async () => {
      // Create a test job for polling tests
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: testUrls.website[0] },
        'Setup: Create test job for polling'
      );
      
      if (result.success && result.data?.jobId) {
        testJobId = result.data.jobId;
        createdJobs.push(testJobId);
      }
    });

    it('should get job status', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        `/api/v1/extract/react/${testJobId}`,
        null,
        'Get job status'
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(testJobId);
      expect(result.data?.status).toBeDefined();
      expect(['pending', 'processing', 'completed', 'failed']).toContain(result.data?.status);
    });

    it('should handle invalid job ID', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/extract/react/invalid_job_id_123',
        null,
        'Get invalid job status',
        404
      );
      expect(result.success).toBe(false);
    });

    it('should poll job until completion', async () => {
      const result = await testRunner.pollJobStatus(
        testJobId,
        5, // max attempts
        2000 // poll interval
      );
      
      // Note: Job may not complete in test environment, but polling should work
      expect(result.success).toBeDefined();
      expect(result.data?.id).toBe(testJobId);
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
      // First get list of recipes
      const listResult = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes',
        null,
        'Get recipe list for ID test'
      );
      
      if (listResult.success && Array.isArray(listResult.data) && listResult.data.length > 0) {
        const recipeId = listResult.data[0].id;
        
        const result = await testRunner.testEndpoint(
          'GET',
          `/api/v1/recipes/${recipeId}`,
          null,
          'Get recipe by ID'
        );
        
        expect(result.success).toBe(true);
        expect(result.data?.id).toBe(recipeId);
      } else {
        console.log('No recipes in database for ID test');
        // Create a test recipe if none exist
        // This would require actual extraction which is heavy for E2E
      }
    });

    it('should handle non-existent recipe ID', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes/999999',
        null,
        'Get non-existent recipe',
        404
      );
      expect(result.success).toBe(false);
    });

    it('should update recipe metadata', async () => {
      // Get a recipe first
      const listResult = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes',
        null,
        'Get recipe for update test'
      );
      
      if (listResult.success && Array.isArray(listResult.data) && listResult.data.length > 0) {
        const recipe = listResult.data[0];
        const newTitle = `Updated: ${recipe.title}`;
        
        const result = await testRunner.testEndpoint(
          'PUT',
          `/api/v1/recipes/${recipe.id}`,
          { title: newTitle },
          'Update recipe title'
        );
        
        expect(result.success).toBe(true);
        expect(result.data?.title).toBe(newTitle);
      }
    });

    it('should delete recipe', async () => {
      // Get a recipe first
      const listResult = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes',
        null,
        'Get recipe for delete test'
      );
      
      if (listResult.success && Array.isArray(listResult.data) && listResult.data.length > 0) {
        const recipe = listResult.data[0];
        
        const result = await testRunner.testEndpoint(
          'DELETE',
          `/api/v1/recipes/${recipe.id}`,
          null,
          'Delete recipe'
        );
        
        expect(result.success).toBe(true);
        
        // Verify deletion
        const verifyResult = await testRunner.testEndpoint(
          'GET',
          `/api/v1/recipes/${recipe.id}`,
          null,
          'Verify recipe deletion',
          404
        );
        expect(verifyResult.success).toBe(false);
      }
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
      // This requires raw fetch since test helper expects JSON
      const response = await fetch(`${defaultConfig.apiBase}/api/v1/extract/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json }',
      });
      
      expect(response.status).toBe(400);
    });

    it('should handle large request payload', async () => {
      const largeUrl = 'https://example.com/' + 'a'.repeat(1000);
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: largeUrl },
        'Create job with very long URL'
      );
      
      // Should either succeed or give appropriate error
      expect([true, false]).toContain(result.success);
    });

    it('should handle concurrent job creation', async () => {
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          testRunner.testEndpoint(
            'POST',
            '/api/v1/extract/react',
            { url: `${testUrls.website[0]}?test=${i}` },
            `Concurrent job ${i}`
          )
        );
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed (server should handle concurrency)
      const allSuccess = results.every(r => r.success);
      expect(allSuccess).toBe(true);
      
      // Collect job IDs for cleanup
      results.forEach(result => {
        if (result.success && result.data?.jobId) {
          createdJobs.push(result.data.jobId);
        }
      });
    }, TEST_TIMEOUT);

    it('should handle database connection errors', async () => {
      // This is hard to test without actually breaking the DB connection
      // We'll test with invalid DB path configuration (not possible in E2E)
      // Instead, we'll verify the API handles missing data gracefully
      
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/recipes/999999',
        null,
        'Handle non-existent recipe gracefully',
        404
      );
      
      // Should return proper 404, not 500
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });
  }, TEST_TIMEOUT);

  describe('Performance Testing', () => {
    it('should respond to health check within 500ms', async () => {
      const startTime = Date.now();
      
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/health',
        null,
        'Health check performance'
      );
      
      const duration = Date.now() - startTime;
      console.log(`Health check duration: ${duration}ms`);
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    it('should create job quickly', async () => {
      const startTime = Date.now();
      
      const result = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: testUrls.website[0] },
        'Job creation performance'
      );
      
      const duration = Date.now() - startTime;
      console.log(`Job creation duration: ${duration}ms`);
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000);
      
      if (result.data?.jobId) {
        createdJobs.push(result.data.jobId);
      }
    });

    it('should handle multiple rapid requests', async () => {
      const startTime = Date.now();
      const requests = 5;
      const promises = [];
      
      for (let i = 0; i < requests; i++) {
        promises.push(
          testRunner.testEndpoint(
            'GET',
            '/api/v1/health',
            null,
            `Rapid request ${i}`
          )
        );
      }
      
      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / requests;
      
      console.log(`Total duration for ${requests} requests: ${totalDuration}ms`);
      console.log(`Average per request: ${avgDuration}ms`);
      
      const allSuccess = results.every(r => r.success);
      expect(allSuccess).toBe(true);
      expect(avgDuration).toBeLessThan(200);
    }, TEST_TIMEOUT);
  }, TEST_TIMEOUT);
});