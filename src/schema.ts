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
  created_at:  integer("created_at", { mode: "timestamp" })
                 .default(sql`CURRENT_TIMESTAMP`),
});

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
