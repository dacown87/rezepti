import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const recipes = sqliteTable("recipes", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  name:        text("name").notNull(),
  emoji:       text("emoji"),
  source_url:  text("source_url"),
  image_url:   text("image_url"),
  servings:    text("servings"),
  duration:    text("duration"),          // 'kurz' | 'mittel' | 'lang'
  calories:    integer("calories"),
  tags:        text("tags"),              // JSON-Array
  ingredients: text("ingredients").notNull(), // JSON-Array
  steps:       text("steps").notNull(),       // JSON-Array
  transcript:  text("transcript"),
  tried:       integer("tried", { mode: "boolean" }).default(false),
  rating:      integer("rating"),   // 1–5 stars, null = unrated
  notes:       text("notes"),       // personal notes
  created_at:  integer("created_at", { mode: "timestamp" })
                 .default(sql`(strftime('%s', 'now'))`),
});

export const ingredientDictionary = sqliteTable("ingredient_dictionary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  canonicalName: text("canonical_name").notNull().unique(),
  aliases: text("aliases"), // JSON-Array of alternative names
});

export const shoppingList = sqliteTable("shopping_list", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id"), // nullable for standalone items
  canonicalName: text("canonical_name").notNull(),
  quantity: text("quantity"), // e.g. "200" or "1/2"
  unit: text("unit"), // e.g. "g", "ml", "Stück"
  checked: integer("checked", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
               .default(sql`(strftime('%s', 'now'))`),
});

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type IngredientDictionaryEntry = typeof ingredientDictionary.$inferSelect;
export type NewIngredientDictionaryEntry = typeof ingredientDictionary.$inferInsert;
export type ShoppingListItem = typeof shoppingList.$inferSelect;
export type NewShoppingListItem = typeof shoppingList.$inferInsert;
