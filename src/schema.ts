import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, boolean, timestamp, uuid, unique, primaryKey, index, uniqueIndex, check } from "drizzle-orm/pg-core";

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
  equipment:          text("equipment"),               // JSON-Array (nullable)
  nutrition_info:     text("nutrition_info"),          // JSON: {carbs, fat, protein} (nullable)
  ingredient_groups:  text("ingredient_groups"),       // JSON: [{heading, items}][] (nullable)
  tried:       boolean("tried").default(false),
  rating:      integer("rating"),   // 1–5 stars, null = unrated
  notes:       text("notes"),       // personal notes
  pdf_created: boolean("pdf_created").default(false),
  created_at:  timestamp("created_at").defaultNow(),
  updated_at:  timestamp("updated_at").defaultNow(),
  ownerType:   text("owner_type").notNull(),
  ownerUserId: uuid("owner_user_id"),
  householdId: uuid("household_id"),
  createdBy:   uuid("created_by"),
}, (t) => [
  check("recipes_owner_type_check", sql`${t.ownerType} IN ('user', 'household')`),
  check(
    "recipes_owner_shape_check",
    sql`(
      (${t.ownerType} = 'user' AND ${t.ownerUserId} IS NOT NULL AND ${t.householdId} IS NULL)
      OR
      (${t.ownerType} = 'household' AND ${t.ownerUserId} IS NULL AND ${t.householdId} IS NOT NULL)
    )`,
  ),
  index("recipes_owner_user_idx").on(t.ownerUserId, t.created_at, t.id),
  index("recipes_household_idx").on(t.householdId, t.created_at, t.id),
  index("recipes_created_by_idx").on(t.createdBy),
]);

export const ingredientDictionary = pgTable("ingredient_dictionary", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull().unique(),
  aliases: text("aliases"), // JSON-Array of alternative names
});

export const shoppingList = pgTable("shopping_list", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id"), // nullable for standalone items
  householdId: uuid("household_id").notNull(),
  canonicalName: text("canonical_name").notNull(),
  quantity: text("quantity"), // e.g. "200" or "1/2"
  unit: text("unit"), // e.g. "g", "ml", "Stück"
  checked: boolean("checked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id"),
}, (t) => [
  unique("shopping_list_household_recipe_name_uidx")
    .on(t.householdId, t.recipeId, t.canonicalName)
    .nullsNotDistinct(),
  index("shopping_list_household_idx").on(t.householdId),
  index("shopping_list_recipe_idx").on(t.recipeId),
]);

export const mealPlan = pgTable("meal_plan", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull(),
  householdId: uuid("household_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Montag, 6=Sonntag
  weekStart: integer("week_start").notNull(), // ISO-Wochenstart (Montag) als Unix-Timestamp
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id"),
}, (t) => [
  index("meal_plan_household_week_idx").on(t.householdId, t.weekStart),
  index("meal_plan_recipe_idx").on(t.recipeId),
]);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  email: text("email"),
  appRole: text("app_role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("user_profiles_app_role_idx").on(t.appRole),
]);

export const households = pgTable("households", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const householdMemberships = pgTable("household_memberships", {
  householdId: uuid("household_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.householdId, t.userId], name: "household_memberships_pkey" }),
  index("household_memberships_user_idx").on(t.userId),
  index("household_memberships_household_idx").on(t.householdId),
  uniqueIndex("household_memberships_user_household_uidx").on(t.userId, t.householdId),
]);

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
export type UserProfile = typeof userProfiles.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMembership = typeof householdMemberships.$inferSelect;
