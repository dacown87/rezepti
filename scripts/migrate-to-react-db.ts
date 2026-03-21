#!/usr/bin/env tsx
/**
 * Migration script to copy recipes from legacy database to React database
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// Database paths
const LEGACY_DB_PATH = join(PROJECT_ROOT, "data", "rezepti.db");
const REACT_DB_PATH = join(PROJECT_ROOT, "data", "rezepti-react.db");

async function migrate() {
  console.log("🔄 Starting migration from legacy to React database...");
  console.log(`📁 Legacy DB: ${LEGACY_DB_PATH}`);
  console.log(`📁 React DB:  ${REACT_DB_PATH}`);

  // Ensure data directory exists
  mkdirSync(dirname(REACT_DB_PATH), { recursive: true });

  // Open databases
  const legacyDb = new Database(LEGACY_DB_PATH);
  const reactDb = new Database(REACT_DB_PATH);
  
  try {
    // Initialize React database schema
    console.log("📋 Creating React database schema...");
    reactDb.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        emoji       TEXT,
        source_url  TEXT,
        image_url   TEXT,
        servings    TEXT,
        duration    TEXT,
        calories    INTEGER,
        tags        TEXT,
        ingredients TEXT NOT NULL,
        steps       TEXT NOT NULL,
        transcript  TEXT,
        tried       INTEGER DEFAULT 0,
        created_at  INTEGER DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Enable WAL mode for better performance
    reactDb.pragma("journal_mode = WAL");
    
    // Check if recipes table exists in legacy DB
    const legacyTables = legacyDb
      .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?")
      .all("table", "recipes");
    
    if (legacyTables.length === 0) {
      console.log("⚠️  No recipes table found in legacy database. Nothing to migrate.");
      return;
    }
    
    // Count recipes in legacy DB
    const legacyCount = legacyDb
      .prepare("SELECT COUNT(*) as count FROM recipes")
      .get() as { count: number };
    
    console.log(`📊 Found ${legacyCount.count} recipes in legacy database`);
    
    if (legacyCount.count === 0) {
      console.log("✅ No recipes to migrate. Migration complete.");
      return;
    }
    
    // Count recipes in React DB (to avoid duplicates)
    const reactCount = reactDb
      .prepare("SELECT COUNT(*) as count FROM recipes")
      .get() as { count: number };
    
    console.log(`📊 React database currently has ${reactCount.count} recipes`);
    
    // Get all recipes from legacy DB
    const legacyRecipes = legacyDb
      .prepare("SELECT * FROM recipes ORDER BY created_at")
      .all() as Array<{
        id: number;
        name: string;
        emoji?: string;
        source_url?: string;
        image_url?: string;
        servings?: string;
        duration?: string;
        calories?: number;
        tags?: string;
        ingredients: string;
        steps: string;
        transcript?: string;
        tried?: number;
        created_at?: string;
      }>;
    
    // Prepare insert statement for React DB
    const insertStmt = reactDb.prepare(`
      INSERT INTO recipes (
        name, emoji, source_url, image_url, servings, duration,
        calories, tags, ingredients, steps, transcript, tried, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Transaction for batch insert
    const transaction = reactDb.transaction((recipes) => {
      for (const recipe of recipes) {
        insertStmt.run(
          recipe.name,
          recipe.emoji,
          recipe.source_url,
          recipe.image_url,
          recipe.servings,
          recipe.duration,
          recipe.calories,
          recipe.tags,
          recipe.ingredients,
          recipe.steps,
          recipe.transcript,
          recipe.tried || 0,
          recipe.created_at
        );
      }
    });
    
    // Execute migration
    console.log("🚚 Migrating recipes...");
    transaction(legacyRecipes);
    
    // Verify migration
    const newReactCount = reactDb
      .prepare("SELECT COUNT(*) as count FROM recipes")
      .get() as { count: number };
    
    console.log(`✅ Migration complete!`);
    console.log(`📊 Legacy database: ${legacyCount.count} recipes`);
    console.log(`📊 React database:  ${newReactCount.count} recipes (was ${reactCount.count})`);
    console.log(`📈 Migrated ${newReactCount.count - reactCount.count} recipes`);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    // Close database connections
    legacyDb.close();
    reactDb.close();
  }
}

// Run migration if script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch(console.error);
}

export { migrate };