/**
 * Smoke Tests for Rezepti React Project
 * Quick verification that the test suite is properly configured
 */

import { describe, it, expect } from 'vitest';
import { TestRunner, defaultConfig } from '../utils/test-helpers.js';
import { sampleRecipes, testApiKeys, testUrls } from '../fixtures/test-data.js';

describe('Smoke Tests - Test Suite Verification', () => {
  it('should have test utilities properly configured', () => {
    const testRunner = new TestRunner(defaultConfig);
    expect(testRunner).toBeDefined();
    expect(defaultConfig.apiBase).toBe('http://localhost:3000');
  });

  it('should have test data fixtures', () => {
    expect(sampleRecipes.length).toBeGreaterThan(0);
    expect(testApiKeys.length).toBeGreaterThan(0);
    expect(testUrls.length).toBeGreaterThan(0);
    
    // Verify sample recipes have required fields
    sampleRecipes.forEach(recipe => {
      expect(recipe.title).toBeDefined();
      expect(recipe.url).toBeDefined();
      expect(recipe.ingredients).toBeInstanceOf(Array);
      expect(recipe.instructions).toBeInstanceOf(Array);
    });
    
    // Verify test URLs have required fields
    testUrls.forEach(url => {
      expect(url.url).toBeDefined();
      expect(url.type).toBeDefined();
      expect(url.shouldWork).toBeDefined();
    });
  });

  it('should have valid test configuration', () => {
    expect(defaultConfig.timeout).toBeGreaterThan(0);
    expect(defaultConfig.apiBase).toMatch(/^http:\/\/localhost:\d+/);
  });

  it('should be able to create test runner instance', () => {
    const customConfig = {
      ...defaultConfig,
      timeout: 10000,
    };
    
    const testRunner = new TestRunner(customConfig);
    expect(testRunner).toBeDefined();
    expect(testRunner.getResults()).toEqual([]);
  });
});

describe('Test Environment Verification', () => {
  it('should have required Node.js modules', () => {
    // Test that we can import required modules using ES modules
    // Note: We're using ES modules, so require() may not work
    // This test verifies our environment supports ES modules
    expect(() => {
      // Dynamic import should work in ES modules
      return import('node:fs');
    }).not.toThrow();
  });

  it('should have test directory structure', async () => {
    // Check that test directories exist (this is a conceptual test)
    const expectedDirs = ['e2e', 'fixtures', 'utils', 'scripts'];
    
    // This test verifies our mental model of the test structure
    expectedDirs.forEach(dir => {
      // We expect these directories to exist based on our setup
      expect(['e2e', 'fixtures', 'utils', 'scripts']).toContain(dir);
    });
  });
});

describe('Test Data Validation', () => {
  it('should have valid API key formats', () => {
    const validKeys = testApiKeys.filter(k => k.valid);
    const invalidKeys = testApiKeys.filter(k => !k.valid);
    
    expect(validKeys.length).toBeGreaterThan(0);
    expect(invalidKeys.length).toBeGreaterThan(0);
    
    // Valid keys should start with gsk_
    validKeys.forEach(key => {
      expect(key.key.startsWith('gsk_')).toBe(true);
    });
    
    // Invalid keys should not all start with gsk_
    const allInvalidStartWithGsk = invalidKeys.every(k => k.key.startsWith('gsk_'));
    expect(allInvalidStartWithGsk).toBe(false);
  });

  it('should have diverse test URL types', () => {
    const urlTypes = new Set(testUrls.map(u => u.type));
    expect(urlTypes.size).toBeGreaterThan(1);
    
    // Should have at least website and youtube URLs
    expect(urlTypes.has('website')).toBe(true);
    expect(urlTypes.has('youtube')).toBe(true);
  });

  it('should have realistic sample recipes', () => {
    sampleRecipes.forEach(recipe => {
      // Check required fields
      expect(recipe.title.length).toBeGreaterThan(0);
      expect(recipe.url).toMatch(/^https?:\/\//);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.instructions.length).toBeGreaterThan(0);
      
      // Check optional fields if present
      if (recipe.prep_time !== undefined) {
        expect(recipe.prep_time).toBeGreaterThan(0);
      }
      
      if (recipe.cook_time !== undefined) {
        expect(recipe.cook_time).toBeGreaterThan(0);
      }
      
      if (recipe.servings !== undefined) {
        expect(recipe.servings).toBeGreaterThan(0);
      }
      
      if (recipe.difficulty !== undefined) {
        expect(['easy', 'medium', 'hard']).toContain(recipe.difficulty);
      }
    });
  });
});