import { pgTable, serial, integer, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const recipes = pgTable("recipes", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  emoji:       text("emoji"),
  source_url:  text("source_url"),
  image_url:   text("image_url"),
  servings:    text("servings"),
  duration:    text("duration"),          // 'kurz' | 'mittel' | 'lang'
  calories:    integer("calories"),
  tags:        text("tags"),              // JSON-Array
  category:    text("category"),          // Auto-assigned category label
  ingredients: text("ingredients").notNull(), // JSON-Array
  steps:       text("steps").notNull(),       // JSON-Array
  transcript:  text("transcript"),
  equipment:      text("equipment"),             // JSON-Array (nullable)
  nutrition_info: text("nutrition_info"),        // JSON: {carbs, fat, protein} (nullable)
  tried:       boolean("tried").default(false),
  rating:      integer("rating"),   // 1–5 stars, null = unrated
  notes:       text("notes"),       // personal notes
  pdf_created: boolean("pdf_created").default(false),
  created_at:  timestamp("created_at").defaultNow(),
  user_id:     uuid("user_id"),     // null = global/unauthenticated; set when multi-user auth is active
});

export const ingredientDictionary = pgTable("ingredient_dictionary", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull().unique(),
  aliases: text("aliases"), // JSON-Array of alternative names
});

export const shoppingList = pgTable("shopping_list", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id"), // nullable for standalone items
  canonicalName: text("canonical_name").notNull(),
  quantity: text("quantity"), // e.g. "200" or "1/2"
  unit: text("unit"), // e.g. "g", "ml", "Stück"
  checked: boolean("checked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id"),
});

export const mealPlan = pgTable("meal_plan", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Montag, 6=Sonntag
  weekStart: integer("week_start").notNull(), // ISO-Wochenstart (Montag) als Unix-Timestamp
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id"),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id"),
});

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type IngredientDictionaryEntry = typeof ingredientDictionary.$inferSelect;
export type NewIngredientDictionaryEntry = typeof ingredientDictionary.$inferInsert;
export type ShoppingListItem = typeof shoppingList.$inferSelect;
export type NewShoppingListItem = typeof shoppingList.$inferInsert;
export type MealPlanEntry = typeof mealPlan.$inferSelect;
export type NewMealPlanEntry = typeof mealPlan.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
