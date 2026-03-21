import type { ContentBundle, RecipeData } from '../types.js'
import type { Recipe } from '../schema.js'

export type SourceType = 'youtube' | 'instagram' | 'tiktok' | 'cookidoo' | 'web'

export interface ContentFetcher {
  /**
   * Fetch content from a URL
   */
  fetch(url: string, tempDir?: string): Promise<ContentBundle>
  
  /**
   * Platform this fetcher is designed for
   */
  readonly platform: 'server' | 'browser' | 'mobile'
  
  /**
   * Whether this fetcher has a fallback option
   */
  readonly fallbackEnabled: boolean
  
  /**
   * Check if this fetcher supports a specific source type
   */
  supports(type: SourceType): boolean
}

export interface PlatformFileSystem {
  /**
   * Read a file as text
   */
  readFile(path: string): Promise<string>
  
  /**
   * Write text to a file
   */
  writeFile(path: string, content: string): Promise<void>
  
  /**
   * Create a directory
   */
  mkdir(path: string): Promise<void>
  
  /**
   * Check if a file or directory exists
   */
  exists(path: string): Promise<boolean>
  
  /**
   * Get a temporary directory path
   */
  tempDir(): Promise<string>
}

export interface PlatformDatabase {
  /**
   * Ensure database schema is created
   */
  ensureSchema(): Promise<void>
  
  /**
   * Save a recipe to the database
   */
  saveRecipe(recipe: RecipeData, sourceUrl: string, transcript?: string): Promise<number>
  
  /**
   * Get all saved recipes
   */
  getAllRecipes(): Promise<Recipe[]>
  
  /**
   * Get a single recipe by ID
   */
  getRecipeById(id: number): Promise<Recipe | null>
  
  /**
   * Update a recipe
   */
  updateRecipe(id: number, recipe: RecipeData): Promise<void>
  
  /**
   * Delete a recipe
   */
  deleteRecipe(id: number): Promise<void>
}

// Re-export types from types.ts
export type { ContentBundle, RecipeData, SchemaOrgRecipe, PipelineEvent } from '../types.js'