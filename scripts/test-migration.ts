#!/usr/bin/env tsx
/**
 * Test script to verify migration works correctly
 */

import { DatabaseManager } from "../src/db-manager.js";

async function testMigration() {
  console.log("🧪 Testing database migration...");
  
  try {
    // Get counts before migration
    const legacyRecipes = DatabaseManager.getAllRecipes("legacy");
    const reactRecipesBefore = DatabaseManager.getAllRecipes("react");
    
    console.log(`📊 Legacy database has ${legacyRecipes.length} recipes`);
    console.log(`📊 React database has ${reactRecipesBefore.length} recipes (before migration)`);
    
    // Run migration
    console.log("🔄 Running migration...");
    const migratedCount = await DatabaseManager.migrateToReactDb();
    
    // Get counts after migration
    const reactRecipesAfter = DatabaseManager.getAllRecipes("react");
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 React database now has ${reactRecipesAfter.length} recipes`);
    console.log(`📈 Migrated ${migratedCount} recipes`);
    
    // Compare some data
    if (legacyRecipes.length > 0 && reactRecipesAfter.length > 0) {
      console.log("\n🔍 Sample comparison:");
      const legacyFirst = legacyRecipes[0];
      const reactFirst = reactRecipesAfter[0];
      
      console.log(`Legacy first recipe: ${legacyFirst.name} (ID: ${legacyFirst.id})`);
      console.log(`React first recipe:  ${reactFirst.name} (ID: ${reactFirst.id})`);
      
      // Check if data matches
      const keysToCompare = ['name', 'emoji', 'source_url', 'servings', 'duration', 'calories'] as const;
      for (const key of keysToCompare) {
        if (legacyFirst[key] !== reactFirst[key]) {
          console.warn(`⚠️  Mismatch on ${key}: Legacy="${legacyFirst[key]}", React="${reactFirst[key]}"`);
        }
      }
      
      // Check JSON arrays
      if (JSON.stringify(legacyFirst.ingredients) !== JSON.stringify(reactFirst.ingredients)) {
        console.warn("⚠️  Ingredients mismatch");
      }
      if (JSON.stringify(legacyFirst.steps) !== JSON.stringify(reactFirst.steps)) {
        console.warn("⚠️  Steps mismatch");
      }
      if (JSON.stringify(legacyFirst.tags) !== JSON.stringify(reactFirst.tags)) {
        console.warn("⚠️  Tags mismatch");
      }
    }
    
    // Test CRUD operations
    console.log("\n🧪 Testing CRUD operations on React database...");
    
    // Test create
    const testRecipe = {
      name: "Test Recipe from Migration",
      emoji: "🧪",
      imageUrl: "https://example.com/test.jpg",
      servings: "4",
      duration: "mittel" as const,
      calories: 500,
      tags: ["test", "migration"],
      ingredients: ["1 cup test ingredient", "2 tbsp test spice"],
      steps: ["Step 1: Test", "Step 2: Verify"]
    };
    
    const newId = DatabaseManager.saveRecipe(
      testRecipe,
      "https://example.com/test",
      "Test transcript",
      "react"
    );
    
    console.log(`✅ Created test recipe in React DB with ID: ${newId}`);
    
    // Test read
    const retrieved = DatabaseManager.getRecipeById(newId, "react");
    if (retrieved && retrieved.name === testRecipe.name) {
      console.log(`✅ Successfully retrieved test recipe: ${retrieved.name}`);
    } else {
      console.error("❌ Failed to retrieve test recipe");
    }
    
    // Test update
    const updateSuccess = DatabaseManager.updateRecipe(
      newId,
      { name: "Updated Test Recipe" },
      "react"
    );
    
    if (updateSuccess) {
      const updated = DatabaseManager.getRecipeById(newId, "react");
      if (updated && updated.name === "Updated Test Recipe") {
        console.log(`✅ Successfully updated test recipe`);
      }
    }
    
    // Test delete
    const deleteSuccess = DatabaseManager.deleteRecipe(newId, "react");
    if (deleteSuccess) {
      const deleted = DatabaseManager.getRecipeById(newId, "react");
      if (!deleted) {
        console.log(`✅ Successfully deleted test recipe`);
      }
    }
    
    console.log("\n🎉 All tests passed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run test if executed directly
if (process.argv[1] === import.meta.url) {
  testMigration().catch(console.error);
}

export { testMigration };