/**
 * Test Setup and Teardown Utilities for Rezepti E2E Tests
 * Handles database setup, fixture management, and cleanup
 */

import { DatabaseManager } from '../../src/db-manager.js';
import { sampleRecipes } from '../fixtures/test-data.js';
import { existsSync, unlinkSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

export interface TestDatabaseConfig {
  reactDbPath: string;
  legacyDbPath: string;
  backupDir?: string;
}

export class TestDatabaseManager {
  private config: TestDatabaseConfig;
  private backups: Map<string, string> = new Map();

  constructor(config: TestDatabaseConfig) {
    this.config = {
      backupDir: join(PROJECT_ROOT, 'test', 'backups'),
      ...config,
    };
  }

  /**
   * Setup test databases before test suite
   */
  async setup(): Promise<void> {
    console.log('\nSetting up test databases...');

    try {
      // Ensure backup directory exists
      if (!existsSync(this.config.backupDir!)) {
        // Note: We're not creating directories in this setup to avoid complexity
        console.log(`Backup directory does not exist: ${this.config.backupDir}`);
      }

      // Backup existing databases if they exist
      await this.backupDatabases();

      // Ensure database schemas
      console.log('Ensuring React database schema...');
      DatabaseManager.ensureSchema('react');

      console.log('Ensuring legacy database schema...');
      DatabaseManager.ensureSchema('legacy');

      // Seed with test data
      await this.seedTestData();

      console.log('Test database setup complete ✓');
    } catch (error) {
      console.error('Error setting up test databases:', error);
      throw error;
    }
  }

  /**
   * Cleanup test databases after test suite
   */
  async cleanup(): Promise<void> {
    console.log('\nCleaning up test databases...');

    try {
      // Restore original databases
      await this.restoreDatabases();

      // Clear any in-memory data
      this.backups.clear();

      console.log('Test database cleanup complete ✓');
    } catch (error) {
      console.error('Error cleaning up test databases:', error);
      throw error;
    }
  }

  /**
   * Seed databases with test data
   */
  private async seedTestData(): Promise<void> {
    console.log('Seeding test data...');

    try {
      // For React database
      const reactDb = DatabaseManager.getDatabase('react');
      
      // Insert sample recipes
      for (const recipe of sampleRecipes) {
        const result = await DatabaseManager.insertRecipe('react', {
          title: recipe.title,
          url: recipe.url,
          source: recipe.source,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          tags: recipe.tags,
          image_url: recipe.image_url,
          author: recipe.author,
        });

        if (result.success) {
          console.log(`Inserted recipe: ${recipe.title}`);
        }
      }

      console.log(`Inserted ${sampleRecipes.length} sample recipes`);
    } catch (error) {
      console.error('Error seeding test data:', error);
      throw error;
    }
  }

  /**
   * Backup existing database files
   */
  private async backupDatabases(): Promise<void> {
    const databases = [
      { key: 'react', path: this.config.reactDbPath },
      { key: 'legacy', path: this.config.legacyDbPath },
    ];

    for (const db of databases) {
      if (existsSync(db.path)) {
        const backupPath = join(this.config.backupDir!, `${db.key}_${Date.now()}.db`);
        try {
          copyFileSync(db.path, backupPath);
          this.backups.set(db.key, backupPath);
          console.log(`Backed up ${db.key} database: ${backupPath}`);
        } catch (error) {
          console.warn(`Could not backup ${db.key} database: ${error}`);
        }
      } else {
        console.log(`${db.key} database does not exist, no backup needed: ${db.path}`);
      }
    }
  }

  /**
   * Restore original database files
   */
  private async restoreDatabases(): Promise<void> {
    for (const [key, backupPath] of this.backups.entries()) {
      try {
        const dbPath = key === 'react' ? this.config.reactDbPath : this.config.legacyDbPath;
        
        if (existsSync(backupPath)) {
          copyFileSync(backupPath, dbPath);
          console.log(`Restored ${key} database from backup: ${backupPath}`);
          
          // Delete backup file
          unlinkSync(backupPath);
        }
      } catch (error) {
        console.warn(`Could not restore ${key} database: ${error}`);
      }
    }
  }

  /**
   * Clear all data from databases (useful for individual tests)
   */
  async clearAllData(): Promise<void> {
    console.log('Clearing all data from databases...');

    try {
      // For React database
      const reactDb = DatabaseManager.getDatabase('react');
      reactDb.exec('DELETE FROM recipes');
      reactDb.exec('DELETE FROM extraction_jobs');
      console.log('Cleared React database');

      // For legacy database
      const legacyDb = DatabaseManager.getDatabase('legacy');
      legacyDb.exec('DELETE FROM recipes');
      console.log('Cleared legacy database');
    } catch (error) {
      console.error('Error clearing database data:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    react: { recipes: number; jobs: number };
    legacy: { recipes: number };
  }> {
    const stats = {
      react: { recipes: 0, jobs: 0 },
      legacy: { recipes: 0 },
    };

    try {
      // React database stats
      const reactDb = DatabaseManager.getDatabase('react');
      const reactRecipes = reactDb.prepare('SELECT COUNT(*) as count FROM recipes').get() as { count: number };
      const reactJobs = reactDb.prepare('SELECT COUNT(*) as count FROM extraction_jobs').get() as { count: number };
      
      stats.react.recipes = reactRecipes.count;
      stats.react.jobs = reactJobs.count;

      // Legacy database stats
      const legacyDb = DatabaseManager.getDatabase('legacy');
      const legacyRecipes = legacyDb.prepare('SELECT COUNT(*) as count FROM recipes').get() as { count: number };
      
      stats.legacy.recipes = legacyRecipes.count;
    } catch (error) {
      console.error('Error getting database stats:', error);
    }

    return stats;
  }

  /**
   * Reset database to initial state (for between tests)
   */
  async reset(): Promise<void> {
    console.log('Resetting databases to initial state...');
    
    await this.clearAllData();
    await this.seedTestData();
    
    console.log('Database reset complete ✓');
  }

  /**
   * Create a fresh test database (for isolated tests)
   */
  async createFreshDatabase(type: 'react' | 'legacy'): Promise<string> {
    const timestamp = Date.now();
    const dbPath = join(this.config.backupDir!, `${type}_test_${timestamp}.db`);
    
    console.log(`Creating fresh ${type} database: ${dbPath}`);
    
    // This would require copying the schema, but for simplicity we'll just note it
    console.log(`Note: Fresh ${type} database would be created at ${dbPath}`);
    
    return dbPath;
  }

  /**
   * Verify database integrity
   */
  async verifyIntegrity(): Promise<boolean> {
    console.log('Verifying database integrity...');

    try {
      const stats = await this.getStats();
      
      // Check React database
      const reactDb = DatabaseManager.getDatabase('react');
      const reactTables = reactDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      
      const hasRequiredReactTables = ['recipes', 'extraction_jobs'].every(table =>
        reactTables.some(t => t.name === table)
      );
      
      if (!hasRequiredReactTables) {
        console.error('React database missing required tables');
        return false;
      }

      // Check legacy database
      const legacyDb = DatabaseManager.getDatabase('legacy');
      const legacyTables = legacyDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      
      const hasRequiredLegacyTables = ['recipes'].every(table =>
        legacyTables.some(t => t.name === table)
      );
      
      if (!hasRequiredLegacyTables) {
        console.error('Legacy database missing required tables');
        return false;
      }

      console.log('Database integrity check passed ✓');
      return true;
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }
}

// Default test database configuration
export const defaultTestDbConfig: TestDatabaseConfig = {
  reactDbPath: join(PROJECT_ROOT, 'data', 'rezepti-react.db'),
  legacyDbPath: join(PROJECT_ROOT, 'data', 'rezepti.sqlite'),
  backupDir: join(PROJECT_ROOT, 'test', 'backups'),
};

// Global test setup helper
export async function globalTestSetup(): Promise<TestDatabaseManager> {
  console.log('\n' + '='.repeat(60));
  console.log('Global Test Setup');
  console.log('='.repeat(60));

  const dbManager = new TestDatabaseManager(defaultTestDbConfig);
  await dbManager.setup();

  // Verify setup was successful
  const integrityOk = await dbManager.verifyIntegrity();
  if (!integrityOk) {
    throw new Error('Database integrity check failed after setup');
  }

  const stats = await dbManager.getStats();
  console.log('\nDatabase Statistics:');
  console.log(`  React DB: ${stats.react.recipes} recipes, ${stats.react.jobs} jobs`);
  console.log(`  Legacy DB: ${stats.legacy.recipes} recipes`);

  return dbManager;
}

// Global test cleanup helper
export async function globalTestCleanup(dbManager: TestDatabaseManager): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Global Test Cleanup');
  console.log('='.repeat(60));

  await dbManager.cleanup();
}

// Test environment checker
export function checkTestEnvironment(): {
  hasDatabases: boolean;
  hasNodeModules: boolean;
  hasConfig: boolean;
  isValid: boolean;
} {
  const checks = {
    hasDatabases: false,
    hasNodeModules: false,
    hasConfig: false,
    isValid: false,
  };

  try {
    // Check for databases
    checks.hasDatabases = 
      existsSync(defaultTestDbConfig.reactDbPath) || 
      existsSync(defaultTestDbConfig.legacyDbPath);

    // Check for node_modules
    checks.hasNodeModules = existsSync(join(PROJECT_ROOT, 'node_modules'));

    // Check for configuration
    checks.hasConfig = existsSync(join(PROJECT_ROOT, '.env')) || 
                       existsSync(join(PROJECT_ROOT, '.env.example'));

    // Overall validity
    checks.isValid = checks.hasNodeModules && checks.hasConfig;

    return checks;
  } catch (error) {
    console.error('Error checking test environment:', error);
    return checks;
  }
}