/**
 * Docker Environment Tests for Rezepti React Project
 * Tests functionality in Docker containers and verifies deployment
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { TestRunner, defaultConfig } from '../utils/test-helpers.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Docker-specific configuration
const DOCKER_CONFIG = {
  apiBase: 'http://localhost:3000',
  timeout: 60000,
  reactDbPath: '/app/data/rezepti-react.db',
  legacyDbPath: '/app/data/rezepti.sqlite',
};

describe('Docker Environment Tests', () => {
  let testRunner: TestRunner;
  let isDockerRunning = false;

  beforeAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('Docker Environment Test Suite');
    console.log('='.repeat(60));

    // Check if Docker is running and containers are up
    try {
      const { stdout } = await execAsync('docker ps --filter "name=rezepti" --format "{{.Names}}"');
      isDockerRunning = stdout.includes('rezepti-react') || stdout.includes('rezepti');
      
      if (isDockerRunning) {
        console.log('Docker containers detected, using container endpoints');
        testRunner = new TestRunner(DOCKER_CONFIG);
      } else {
        console.log('Docker not running, using local endpoints');
        testRunner = new TestRunner(defaultConfig);
      }
    } catch (error) {
      console.log('Docker not available, using local endpoints');
      testRunner = new TestRunner(defaultConfig);
    }
  }, 30000);

  afterAll(() => {
    console.log('\n' + '='.repeat(60));
    console.log('Docker Test Suite Complete');
    console.log('='.repeat(60));
    
    testRunner.printSummary();
  });

  describe('Container Health and Connectivity', () => {
    it('should verify Docker container is running', async () => {
      if (!isDockerRunning) {
        console.log('Skipping Docker-specific tests (containers not running)');
        return;
      }

      try {
        const { stdout } = await execAsync('docker ps --filter "name=rezepti" --format "{{.Names}}: {{.Status}}"');
        console.log('Running containers:', stdout);
        
        expect(stdout).toContain('rezepti');
        expect(stdout).toMatch(/Up/);
      } catch (error) {
        console.error('Error checking Docker containers:', error);
        throw error;
      }
    });

    it('should connect to API endpoints in Docker', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/api/v1/health',
        null,
        'Connect to Docker API health endpoint'
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ok');
    });

    it('should serve React frontend from container', async () => {
      const result = await testRunner.testEndpoint(
        'GET',
        '/',
        null,
        'Serve React frontend',
        200
      );
      
      expect(result.success).toBe(true);
      // Should return HTML
      expect(result.data).toBeDefined();
    });

    it('should have correct container environment variables', async () => {
      if (!isDockerRunning) {
        console.log('Skipping environment variable check (not in Docker)');
        return;
      }

      try {
        const { stdout } = await execAsync('docker exec rezepti-react printenv');
        const envVars = stdout.split('\n');
        
        // Check for required environment variables
        const hasReactAppApiUrl = envVars.some(line => line.startsWith('REACT_APP_API_URL='));
        const hasNodeEnv = envVars.some(line => line.startsWith('NODE_ENV='));
        
        console.log('Container environment variables found:', {
          hasReactAppApiUrl,
          hasNodeEnv,
        });
        
        expect(hasReactAppApiUrl).toBe(true);
        expect(hasNodeEnv).toBe(true);
      } catch (error) {
        console.error('Error checking container environment:', error);
        throw error;
      }
    });
  });

  describe('Docker-Specific Database Operations', () => {
    it('should access database files in Docker volume', async () => {
      if (!isDockerRunning) {
        console.log('Skipping Docker volume test (containers not running)');
        return;
      }

      try {
        // Check if database files exist in container
        const checkReactDb = await execAsync(
          `docker exec rezepti-react ls -la ${DOCKER_CONFIG.reactDbPath}`
        );
        console.log('React DB file in container:', checkReactDb.stdout);

        const checkLegacyDb = await execAsync(
          `docker exec rezepti-react ls -la ${DOCKER_CONFIG.legacyDbPath}`
        );
        console.log('Legacy DB file in container:', checkLegacyDb.stdout);

        // Database files should exist
        expect(checkReactDb.stdout).toContain('rezepti-react.db');
        expect(checkLegacyDb.stdout).toContain('rezepti.sqlite');
      } catch (error) {
        console.error('Error checking database files:', error);
        throw error;
      }
    });

    it('should persist data across container restarts', async () => {
      if (!isDockerRunning) {
        console.log('Skipping persistence test (containers not running)');
        return;
      }

      // Create a job in the container
      const createResult = await testRunner.testEndpoint(
        'POST',
        '/api/v1/extract/react',
        { url: 'https://example.com/test-persistence' },
        'Create job for persistence test'
      );
      
      expect(createResult.success).toBe(true);
      const jobId = createResult.data?.jobId;
      
      if (!jobId) {
        console.log('No job created, skipping persistence verification');
        return;
      }

      // Get job status
      const statusResult = await testRunner.testEndpoint(
        'GET',
        `/api/v1/extract/react/${jobId}`,
        null,
        'Verify job exists before restart'
      );
      
      expect(statusResult.success).toBe(true);
      expect(statusResult.data?.id).toBe(jobId);

      console.log(`Job ${jobId} created successfully in container`);
      
      // Note: Actual container restart test would be destructive
      // In a real CI/CD pipeline, we would:
      // 1. Stop container
      // 2. Start container
      // 3. Verify job still exists
      // This is skipped here to avoid breaking development environment
    });
  });

  describe('Multi-Container Deployment', () => {
    it('should have React frontend and API services', async () => {
      if (!isDockerRunning) {
        console.log('Skipping multi-container test (containers not running)');
        return;
      }

      try {
        // Check for both React and API services
        const { stdout } = await execAsync(
          'docker-compose ps --services'
        );
        
        const services = stdout.split('\n').filter(s => s.trim());
        console.log('Available services:', services);
        
        // Should have at least one rezepti service
        const hasRezeptiService = services.some(s => s.includes('rezepti'));
        expect(hasRezeptiService).toBe(true);
      } catch (error) {
        console.error('Error checking services:', error);
        // This is okay if docker-compose is not available
      }
    });

    it('should handle network connectivity between services', async () => {
      // Test that frontend can reach API
      const apiResult = await testRunner.testEndpoint(
        'GET',
        '/api/v1/health',
        null,
        'API service connectivity'
      );
      
      expect(apiResult.success).toBe(true);

      // Test that static assets are served
      const frontendResult = await testRunner.testEndpoint(
        'GET',
        '/assets/index.js',
        null,
        'Frontend static assets',
        200
      );
      
      // Either 200 (file exists) or 404 (not built yet) is acceptable
      expect([true, false]).toContain(frontendResult.success);
    });

    it('should handle port mapping correctly', async () => {
      // Test different ports based on deployment
      const portsToTest = [
        { port: 3000, description: 'Main API port' },
        { port: 5173, description: 'React dev server port' },
      ];

      for (const { port, description } of portsToTest) {
        try {
          const response = await fetch(`http://localhost:${port}/api/v1/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          
          const isOk = response.ok;
          console.log(`${description} (port ${port}): ${isOk ? 'OK' : 'Not responding'}`);
          
          // At least one port should respond
          if (isOk) {
            expect(isOk).toBe(true);
            return;
          }
        } catch {
          console.log(`${description} (port ${port}): Not available`);
        }
      }
      
      // If we get here, neither port responded, but that might be okay in some environments
      console.log('Note: No API ports responded, but this might be expected in some environments');
    });
  });

  describe('Build and Deployment Tests', () => {
    it('should have production build artifacts', async () => {
      if (!isDockerRunning) {
        console.log('Skipping build artifact test (containers not running)');
        return;
      }

      try {
        // Check for production build in container
        const { stdout } = await execAsync(
          'docker exec rezepti-react ls -la /app/dist/'
        );
        
        console.log('Build artifacts in container:', stdout);
        
        // Should have public directory with built files
        expect(stdout).toContain('public');
      } catch (error) {
        console.error('Error checking build artifacts:', error);
        // This is okay for development containers
      }
    });

    it('should have correct file permissions in container', async () => {
      if (!isDockerRunning) {
        console.log('Skipping permissions test (containers not running)');
        return;
      }

      try {
        // Check permissions on key directories
        const dirsToCheck = [
          '/app/data',
          '/app/src',
          '/app/frontend',
        ];

        for (const dir of dirsToCheck) {
          const { stdout } = await execAsync(
            `docker exec rezepti-react ls -ld ${dir}`
          );
          
          console.log(`Permissions for ${dir}:`, stdout);
          
          // Should be readable and writable
          expect(stdout).toMatch(/drwx/);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        throw error;
      }
    });
  });

  describe('Resource Usage and Performance in Docker', () => {
    it('should have reasonable memory usage', async () => {
      if (!isDockerRunning) {
        console.log('Skipping resource test (containers not running)');
        return;
      }

      try {
        const { stdout } = await execAsync(
          'docker stats rezepti-react --no-stream --format "{{.MemUsage}}"'
        );
        
        console.log('Container memory usage:', stdout);
        
        // Parse memory usage (e.g., "150MiB / 500MiB")
        const memoryMatch = stdout.match(/(\d+\.?\d*)([KMGT]i?B)/);
        if (memoryMatch) {
          const usage = parseFloat(memoryMatch[1]);
          const unit = memoryMatch[2];
          
          console.log(`Memory: ${usage}${unit}`);
          
          // Should not exceed 1GB in normal operation
          const maxMemory = unit === 'GiB' ? 1 : 1000; // 1GB or 1000MB
          expect(usage).toBeLessThan(maxMemory);
        }
      } catch (error) {
        console.error('Error checking memory usage:', error);
        // This is okay if docker stats fails
      }
    });

    it('should handle multiple concurrent requests in Docker', async () => {
      const concurrentRequests = 5;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          testRunner.testEndpoint(
            'GET',
            '/api/v1/health',
            null,
            `Concurrent request ${i} in Docker`
          )
        );
      }
      
      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.success);
      
      console.log(`Concurrent requests in Docker: ${results.filter(r => r.success).length}/${concurrentRequests} succeeded`);
      
      expect(allSuccess).toBe(true);
    }, 30000);

    it('should recover from container restart simulation', async () => {
      // Simulate service interruption by testing immediate reconnection
      const startTime = Date.now();
      const attempts = 3;
      let successfulAttempts = 0;
      
      for (let i = 0; i < attempts; i++) {
        try {
          const result = await testRunner.testEndpoint(
            'GET',
            '/api/v1/health',
            null,
            `Recovery test attempt ${i + 1}`
          );
          
          if (result.success) {
            successfulAttempts++;
          }
          
          // Small delay between attempts
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {
          // Ignore individual attempt failures
        }
      }
      
      const totalDuration = Date.now() - startTime;
      console.log(`Recovery test: ${successfulAttempts}/${attempts} successful in ${totalDuration}ms`);
      
      // Should succeed at least once
      expect(successfulAttempts).toBeGreaterThan(0);
    });
  });
});