/**
 * Performance Testing Utilities for Rezepti E2E Tests
 * Measures response times, throughput, and system performance
 */

import { TestRunner, defaultConfig } from './test-helpers.js';
import { performanceTestData } from '../fixtures/test-data.js';

export interface PerformanceMetrics {
  requestCount: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  throughput: number; // requests per second
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface PerformanceTestConfig {
  name: string;
  endpoint: string;
  method: string;
  payload?: any;
  concurrency: number;
  requests: number;
  warmupRequests: number;
  cooldownMs: number;
  timeout: number;
}

export class PerformanceTester {
  private testRunner: TestRunner;
  private metrics: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this.testRunner = new TestRunner({
      ...defaultConfig,
      timeout: 60000,
    });
  }

  /**
   * Run a single performance test
   */
  async runTest(config: PerformanceTestConfig): Promise<PerformanceMetrics> {
    console.log(`\nRunning performance test: ${config.name}`);
    console.log(`  Endpoint: ${config.method} ${config.endpoint}`);
    console.log(`  Concurrency: ${config.concurrency}`);
    console.log(`  Requests: ${config.requests}`);
    console.log(`  Warmup: ${config.warmupRequests} requests`);

    // Warmup phase
    if (config.warmupRequests > 0) {
      await this.runWarmup(config);
    }

    // Main test phase
    const durations: number[] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    const promises: Array<Promise<void>> = [];
    
    // Create batches for concurrent execution
    const batchSize = Math.min(config.concurrency, config.requests);
    let completedRequests = 0;

    while (completedRequests < config.requests) {
      const batchPromises: Array<Promise<void>> = [];
      const remaining = config.requests - completedRequests;
      const currentBatchSize = Math.min(batchSize, remaining);

      for (let i = 0; i < currentBatchSize; i++) {
        batchPromises.push(
          this.makeRequest(config).then(({ duration, error }) => {
            durations.push(duration);
            if (error) {
              errors.push(error);
            }
          })
        );
        completedRequests++;
      }

      // Wait for current batch to complete
      await Promise.all(batchPromises);
      promises.push(...batchPromises);

      // Small delay between batches to prevent overwhelming
      if (completedRequests < config.requests) {
        await this.testRunner.wait(10);
      }
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    const totalDuration = Date.now() - startTime;

    // Calculate metrics
    const metrics = this.calculateMetrics(
      config.name,
      durations,
      errors,
      totalDuration,
      config.requests
    );

    // Store metrics
    this.metrics.set(config.name, metrics);

    // Cooldown
    if (config.cooldownMs > 0) {
      console.log(`  Cooldown: ${config.cooldownMs}ms`);
      await this.testRunner.wait(config.cooldownMs);
    }

    return metrics;
  }

  /**
   * Run warmup requests
   */
  private async runWarmup(config: PerformanceTestConfig): Promise<void> {
    console.log('  Warming up...');
    const warmupPromises: Array<Promise<void>> = [];

    for (let i = 0; i < config.warmupRequests; i++) {
      warmupPromises.push(this.makeRequest(config));
    }

    await Promise.all(warmupPromises);
    console.log('  Warmup complete');
  }

  /**
   * Make a single request and measure duration
   */
  private async makeRequest(config: PerformanceTestConfig): Promise<{ duration: number; error?: string }> {
    const startTime = performance.now();
    
    try {
      const result = await this.testRunner.testEndpoint(
        config.method,
        config.endpoint,
        config.payload,
        `Performance test request`
      );

      const duration = performance.now() - startTime;

      return {
        duration,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Calculate performance metrics from durations
   */
  private calculateMetrics(
    name: string,
    durations: number[],
    errors: string[],
    totalDuration: number,
    totalRequests: number
  ): PerformanceMetrics {
    if (durations.length === 0) {
      return {
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        throughput: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    // Sort durations for percentile calculation
    const sortedDurations = [...durations].sort((a, b) => a - b);

    const successCount = durations.length - errors.length;
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const throughput = (successCount / totalDuration) * 1000; // requests per second

    // Calculate percentiles
    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * sortedDurations.length) - 1;
      return sortedDurations[Math.max(0, index)];
    };

    return {
      requestCount: durations.length,
      successCount,
      failureCount: errors.length,
      totalDuration,
      averageDuration,
      minDuration: sortedDurations[0],
      maxDuration: sortedDurations[sortedDurations.length - 1],
      throughput,
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  /**
   * Print detailed metrics for a test
   */
  printMetrics(name: string, metrics: PerformanceMetrics): void {
    console.log('\n' + '='.repeat(60));
    console.log(`PERFORMANCE METRICS: ${name}`);
    console.log('='.repeat(60));
    console.log(`Requests: ${metrics.requestCount} (${metrics.successCount} successful, ${metrics.failureCount} failed)`);
    console.log(`Total duration: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`Throughput: ${metrics.throughput.toFixed(2)} req/sec`);
    console.log('\nResponse Times (ms):');
    console.log(`  Average: ${metrics.averageDuration.toFixed(2)}`);
    console.log(`  Min: ${metrics.minDuration.toFixed(2)}`);
    console.log(`  Max: ${metrics.maxDuration.toFixed(2)}`);
    console.log(`  P50: ${metrics.p50.toFixed(2)}`);
    console.log(`  P90: ${metrics.p90.toFixed(2)}`);
    console.log(`  P95: ${metrics.p95.toFixed(2)}`);
    console.log(`  P99: ${metrics.p99.toFixed(2)}`);
    console.log('='.repeat(60));
  }

  /**
   * Print comparison of all tests
   */
  printComparison(): void {
    if (this.metrics.size === 0) {
      console.log('No performance tests run yet');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE TEST COMPARISON');
    console.log('='.repeat(80));
    console.log('Test Name'.padEnd(30) + 'Req/sec'.padStart(10) + 'Avg(ms)'.padStart(10) + 'P95(ms)'.padStart(10) + 'Success%'.padStart(10));
    console.log('-'.repeat(80));

    for (const [name, metrics] of this.metrics.entries()) {
      const successRate = ((metrics.successCount / metrics.requestCount) * 100).toFixed(1);
      console.log(
        name.padEnd(30) +
        metrics.throughput.toFixed(2).padStart(10) +
        metrics.averageDuration.toFixed(2).padStart(10) +
        metrics.p95.toFixed(2).padStart(10) +
        `${successRate}%`.padStart(10)
      );
    }

    console.log('='.repeat(80));
  }

  /**
   * Get all collected metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Clear all collected metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Predefined performance tests
export const performanceTests: PerformanceTestConfig[] = [
  // Health endpoint - should be very fast
  {
    name: 'Health Check',
    endpoint: '/api/v1/health',
    method: 'GET',
    concurrency: 10,
    requests: 100,
    warmupRequests: 10,
    cooldownMs: 1000,
    timeout: 10000,
  },
  
  // Recipe listing - moderate load
  {
    name: 'List Recipes',
    endpoint: '/api/v1/recipes',
    method: 'GET',
    concurrency: 5,
    requests: 50,
    warmupRequests: 5,
    cooldownMs: 2000,
    timeout: 30000,
  },
  
  // Job creation - heavier operation
  {
    name: 'Create Job',
    endpoint: '/api/v1/extract/react',
    method: 'POST',
    payload: { url: 'https://example.com/test-performance' },
    concurrency: 3,
    requests: 20,
    warmupRequests: 2,
    cooldownMs: 3000,
    timeout: 60000,
  },
  
  // BYOK validation - API call dependent
  {
    name: 'Validate Key',
    endpoint: '/api/v1/keys/validate',
    method: 'POST',
    payload: { apiKey: 'gsk_testkey1234567890abcdef' },
    concurrency: 2,
    requests: 10,
    warmupRequests: 2,
    cooldownMs: 2000,
    timeout: 30000,
  },
  
  // Mixed workload - simulates real usage
  {
    name: 'Mixed Workload',
    endpoint: '/api/v1/health', // Will be overridden in mixed test
    method: 'GET',
    concurrency: 8,
    requests: 80,
    warmupRequests: 8,
    cooldownMs: 3000,
    timeout: 60000,
  },
];

/**
 * Run a comprehensive performance test suite
 */
export async function runPerformanceSuite(): Promise<Map<string, PerformanceMetrics>> {
  console.log('\n' + '='.repeat(60));
  console.log('REZEPTI PERFORMANCE TEST SUITE');
  console.log('='.repeat(60));

  const tester = new PerformanceTester();
  const startTime = Date.now();

  try {
    // Run individual performance tests
    for (const testConfig of performanceTests) {
      if (testConfig.name === 'Mixed Workload') {
        // Special handling for mixed workload test
        await runMixedWorkloadTest(tester);
      } else {
        const metrics = await tester.runTest(testConfig);
        tester.printMetrics(testConfig.name, metrics);
      }
      
      // Small pause between tests
      await tester.testRunner.wait(2000);
    }

    // Print comparison
    tester.printComparison();

    const totalDuration = Date.now() - startTime;
    console.log(`\nPerformance suite completed in ${totalDuration}ms`);

    return tester.getAllMetrics();
  } catch (error) {
    console.error('Performance test suite failed:', error);
    throw error;
  }
}

/**
 * Run mixed workload test simulating real usage patterns
 */
async function runMixedWorkloadTest(tester: PerformanceTester): Promise<void> {
  console.log('\nRunning Mixed Workload Test...');
  
  const endpoints = [
    { method: 'GET', endpoint: '/api/v1/health', weight: 40 },
    { method: 'GET', endpoint: '/api/v1/recipes', weight: 30 },
    { 
      method: 'POST', 
      endpoint: '/api/v1/extract/react', 
      payload: { url: 'https://example.com/test-mixed' },
      weight: 20 
    },
    { 
      method: 'POST', 
      endpoint: '/api/v1/keys/validate', 
      payload: { apiKey: 'gsk_testmixed1234567890' },
      weight: 10 
    },
  ];

  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  const requests = 80;
  const durations: number[] = [];
  const errors: string[] = [];
  const startTime = Date.now();

  const promises: Array<Promise<void>> = [];

  for (let i = 0; i < requests; i++) {
    // Select endpoint based on weight
    let random = Math.random() * totalWeight;
    let selectedEndpoint = endpoints[0];
    
    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        selectedEndpoint = endpoint;
        break;
      }
    }

    promises.push(
      tester['makeRequest']({
        name: 'Mixed Workload',
        endpoint: selectedEndpoint.endpoint,
        method: selectedEndpoint.method,
        payload: selectedEndpoint.payload,
        concurrency: 8,
        requests: 1,
        warmupRequests: 0,
        cooldownMs: 0,
        timeout: 10000,
      }).then(({ duration, error }) => {
        durations.push(duration);
        if (error) {
          errors.push(error);
        }
      })
    );

    // Limit concurrency
    if (promises.length >= 8) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }

  // Wait for remaining promises
  await Promise.all(promises);

  const totalDuration = Date.now() - startTime;
  const metrics = tester['calculateMetrics'](
    'Mixed Workload',
    durations,
    errors,
    totalDuration,
    requests
  );

  tester['printMetrics']('Mixed Workload', metrics);
}

/**
 * Run stress test with high concurrency
 */
export async function runStressTest(
  endpoint: string,
  method: string,
  durationMs: number = 30000
): Promise<PerformanceMetrics> {
  console.log(`\nRunning Stress Test: ${method} ${endpoint} for ${durationMs}ms`);

  const tester = new PerformanceTester();
  const startTime = Date.now();
  const durations: number[] = [];
  const errors: string[] = [];
  let requestCount = 0;

  const testConfig: PerformanceTestConfig = {
    name: 'Stress Test',
    endpoint,
    method,
    concurrency: 20,
    requests: 1000, // Will be limited by duration
    warmupRequests: 5,
    cooldownMs: 0,
    timeout: 10000,
  };

  // Warmup
  await tester['runWarmup'](testConfig);

  // Run stress test for specified duration
  const promises: Array<Promise<void>> = [];
  
  while (Date.now() - startTime < durationMs) {
    const batchPromises: Array<Promise<void>> = [];
    
    for (let i = 0; i < testConfig.concurrency; i++) {
      batchPromises.push(
        tester['makeRequest'](testConfig).then(({ duration, error }) => {
          durations.push(duration);
          requestCount++;
          if (error) {
            errors.push(error);
          }
        })
      );
    }
    
    await Promise.all(batchPromises);
    promises.push(...batchPromises);
    
    // Small delay to prevent overwhelming
    await tester.testRunner.wait(10);
  }

  // Wait for any remaining requests
  await Promise.all(promises);

  const totalDuration = Date.now() - startTime;
  const metrics = tester['calculateMetrics'](
    'Stress Test',
    durations,
    errors,
    totalDuration,
    requestCount
  );

  tester.printMetrics('Stress Test', metrics);
  return metrics;
}