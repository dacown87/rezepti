/**
 * Database Manager for handling dual database connections
 * This module provides a unified interface for both legacy and React databases
 */

import { ensureSchema, getAllRecipes, getRecipeById, saveRecipe, updateRecipe, deleteRecipe } from "./db.js";
import { ensureReactSchema, getAllRecipesFromReactDb, getRecipeByIdFromReactDb, saveRecipeToReactDb, updateRecipeInReactDb, deleteRecipeFromReactDb } from "./db-react.js";
import type { RecipeData } from "./types.js";

/**
 * Database types supported by the system
 */
export type DatabaseType = "legacy" | "react";

/**
 * Get the appropriate database function based on type
 */
export class DatabaseManager {
  /**
   * Ensure schema exists for the specified database
   */
  static ensureSchema(dbType: DatabaseType = "legacy") {
    if (dbType === "react") {
      ensureReactSchema();
    } else {
      ensureSchema();
    }
  }

  /**
   * Get all recipes from the specified database
   */
  static getAllRecipes(dbType: DatabaseType = "legacy") {
    return dbType === "react" 
      ? getAllRecipesFromReactDb()
      : getAllRecipes();
  }

  /**
   * Get a single recipe by ID from the specified database
   */
  static getRecipeById(id: number, dbType: DatabaseType = "legacy") {
    return dbType === "react"
      ? getRecipeByIdFromReactDb(id)
      : getRecipeById(id);
  }

  /**
   * Save recipe to the specified database
   */
  static saveRecipe(
    recipe: RecipeData,
    sourceUrl: string,
    transcript?: string,
    dbType: DatabaseType = "legacy"
  ): number {
    return dbType === "react"
      ? saveRecipeToReactDb(recipe, sourceUrl, transcript)
      : saveRecipe(recipe, sourceUrl, transcript);
  }

  /**
   * Update recipe in the specified database
   */
  static updateRecipe(
    id: number,
    fields: Partial<RecipeData>,
    dbType: DatabaseType = "legacy"
  ): boolean {
    return dbType === "react"
      ? updateRecipeInReactDb(id, fields)
      : updateRecipe(id, fields);
  }

  /**
   * Delete recipe from the specified database
   */
  static deleteRecipe(
    id: number,
    dbType: DatabaseType = "legacy"
  ): boolean {
    return dbType === "react"
      ? deleteRecipeFromReactDb(id)
      : deleteRecipe(id);
  }

  /**
   * Migrate all recipes from legacy to React database
   * Returns number of recipes migrated
   */
  static async migrateToReactDb(): Promise<number> {
    try {
      // Get counts before migration
      const legacyCount = getAllRecipes().length;
      
      // Open databases directly for migration
      const Database = await import("better-sqlite3").then(m => m.default);
      const { join } = await import("node:path");
      const { mkdirSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      const { config } = await import("./config.js");
      
      const legacyDb = new Database(config.sqlite.path);
      const reactDb = new Database(config.sqlite.reactPath);
      
      // Ensure React database directory exists
      mkdirSync(dirname(config.sqlite.reactPath), { recursive: true });
      
      // Copy all recipes from legacy to React DB
      const legacyRecipes = legacyDb
        .prepare("SELECT * FROM recipes ORDER BY created_at")
        .all();
      
      if (legacyRecipes.length === 0) {
        legacyDb.close();
        reactDb.close();
        return 0;
      }
      
      // Ensure React DB schema
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
      
      // Insert recipes
      const insertStmt = reactDb.prepare(`
        INSERT INTO recipes (
          name, emoji, source_url, image_url, servings, duration,
          calories, tags, ingredients, steps, transcript, tried, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
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
      
      transaction(legacyRecipes);
      
      // Close connections
      legacyDb.close();
      reactDb.close();
      
      // Get count after migration
      const reactCount = getAllRecipesFromReactDb().length;
      
      return reactCount;
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }
}

/**
 * Determine database type from request context
 * For React frontend, use React DB; for legacy, use legacy DB
 */
export function getDatabaseTypeFromRequest(requestUrl?: string): DatabaseType {
  // Check URL path - React endpoints use /api/v1/
  if (requestUrl?.includes("/api/v1/")) {
    return "react";
  }
  
  // Check for React-specific headers or parameters
  // For now, default to legacy for backward compatibility
  return "legacy";
}