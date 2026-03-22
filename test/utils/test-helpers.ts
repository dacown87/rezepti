/**
 * E2E Test Helpers for Rezepti React Project
 * Common utilities for testing React API endpoints, BYOK, and database operations
 */

export interface TestConfig {
  apiBase: string;
  timeout: number;
  defaultApiKey?: string;
  reactDbPath: string;
  legacyDbPath: string;
}

export interface TestJob {
  jobId: string;
  url: string;
  type: 'website' | 'youtube' | 'instagram' | 'tiktok';
  byok: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

export class TestRunner {
  private config: TestConfig;
  private results: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  async testEndpoint(
    method: string,
    path: string,
    body: any = null,
    name: string,
    expectedStatus: number = 200
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\nTesting: ${name}`);
      console.log(`  ${method} ${this.config.apiBase}${path}`);

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Rezepti-E2E-Test/1.0',
        },
        signal: AbortSignal.timeout(this.config.timeout),
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.config.apiBase}${path}`, options);
      const data = await response.json().catch(() => ({}));

      const success = response.status === expectedStatus;
      const duration = Date.now() - startTime;

      console.log(`  Response: ${response.status} ${response.statusText}`);
      console.log(`  Duration: ${duration}ms`);
      
      if (!success) {
        console.log(`  Error: Unexpected status ${response.status}, expected ${expectedStatus}`);
      }

      const result: TestResult = {
        name,
        success,
        duration,
        data: success ? data : undefined,
        error: success ? undefined : `Status ${response.status}, expected ${expectedStatus}`,
      };

      this.results.push(result);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      console.log(`  Error: ${errorMsg}`);
      
      const result: TestResult = {
        name,
        success: false,
        duration,
        error: errorMsg,
      };

      this.results.push(result);
      return result;
    }
  }

  async wait(ms: number): Promise<void> {
    console.log(`  Waiting ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async pollJobStatus(
    jobId: string,
    maxAttempts: number = 10,
    pollInterval: number = 2000
  ): Promise<TestResult> {
    const startTime = Date.now();
    let attempts = 0;
    const name = `Poll job ${jobId}`;

    console.log(`\nPolling job: ${jobId}`);

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`  Attempt ${attempts}/${maxAttempts}`);

      const result = await this.testEndpoint(
        'GET',
        `/api/v1/extract/react/${jobId}`,
        null,
        `Poll attempt ${attempts}`
      );

      if (result.success && result.data) {
        const status = result.data.status;
        console.log(`  Status: ${status}, Progress: ${result.data.progress || 0}%`);

        if (status === 'completed' || status === 'failed') {
          const duration = Date.now() - startTime;
          
          const finalResult: TestResult = {
            name,
            success: status === 'completed',
            duration,
            data: result.data,
            error: status === 'failed' ? result.data.error : undefined,
          };

          this.results.push(finalResult);
          return finalResult;
        }
      }

      if (attempts < maxAttempts) {
        await this.wait(pollInterval);
      }
    }

    const duration = Date.now() - startTime;
    const errorResult: TestResult = {
      name,
      success: false,
      duration,
      error: `Max polling attempts (${maxAttempts}) reached`,
    };

    this.results.push(errorResult);
    return errorResult;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    totalDuration: number;
  } {
    const passed = this.results.filter(r => r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      total: this.results.length,
      passed,
      failed: this.results.length - passed,
      totalDuration,
    };
  }

  printSummary(): void {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Total duration: ${summary.totalDuration}ms`);

    if (summary.failed > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    console.log('='.repeat(60));
  }
}

// URL test data
export const testUrls = {
  website: [
    'https://www.allrecipes.com/recipe/12345/test-recipe/',
    'https://www.bbcgoodfood.com/recipes/classic-vegetable-lasagne',
    'https://www.epicurious.com/recipes/food/views/chicken-piccata',
  ],
  youtube: [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=9bZkp7q19f0',
    'https://www.youtube.com/shorts/ABC123def',
  ],
  instagram: [
    'https://www.instagram.com/p/ABCDEFG12345/',
    'https://www.instagram.com/reel/XYZ789abc/',
    'https://www.instagram.com/tv/LMN456def/',
  ],
  tiktok: [
    'https://www.tiktok.com/@user/video/1234567890',
    'https://vm.tiktok.com/ZMexample123/',
  ],
};

// Default test configuration
export const defaultConfig: TestConfig = {
  apiBase: 'http://localhost:3000',
  timeout: 30000,
  reactDbPath: 'data/rezepti-react.db',
  legacyDbPath: 'data/rezepti.sqlite',
};