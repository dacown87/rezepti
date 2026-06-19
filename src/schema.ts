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
  clientOpId: uuid("client_op_id"),
}, (t) => [
  index("meal_plan_household_week_idx").on(t.householdId, t.weekStart),
  index("meal_plan_recipe_idx").on(t.recipeId),
  uniqueIndex("meal_plan_household_opid_uidx")
    .on(t.householdId, t.clientOpId)
    .where(sql`${t.clientOpId} IS NOT NULL`),
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

export const userDefaultHouseholds = pgTable("user_default_households", {
  userId: uuid("user_id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("user_default_households_household_idx").on(t.householdId),
]);

export const cookidooCredentials = pgTable("cookidoo_credentials", {
  id: serial("id").primaryKey(),
  scopeType: text("scope_type").notNull(),
  userId: uuid("user_id"),
  householdId: uuid("household_id"),
  email: text("email").notNull(),
  password: text("password").notNull(),
  createdBy: uuid("created_by").notNull(),
  sessionCookies: text("session_cookies"),
  sessionUserAgent: text("session_user_agent"),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  check("cookidoo_credentials_scope_type_check", sql`${t.scopeType} IN ('user', 'household')`),
  check(
    "cookidoo_credentials_scope_shape_check",
    sql`(
      (${t.scopeType} = 'user' AND ${t.userId} IS NOT NULL AND ${t.householdId} IS NULL)
      OR
      (${t.scopeType} = 'household' AND ${t.userId} IS NULL AND ${t.householdId} IS NOT NULL)
    )`,
  ),
  uniqueIndex("cookidoo_credentials_user_uidx")
    .on(t.userId)
    .where(sql`${t.scopeType} = 'user'`),
  uniqueIndex("cookidoo_credentials_household_uidx")
    .on(t.householdId)
    .where(sql`${t.scopeType} = 'household'`),
  index("cookidoo_credentials_created_by_idx").on(t.createdBy),
]);

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type IngredientDictionaryEntry = typeof ingredientDictionary.$inferSelect;
export type NewIngredientDictionaryEntry = typeof ingredientDictionary.$inferInsert;
export type ShoppingListItem = typeof shoppingList.$inferSelect;
export type NewShoppingListItem = typeof shoppingList.$inferInsert;
export type MealPlanEntry = typeof mealPlan.$inferSelect;
export type NewMealPlanEntry = typeof mealPlan.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMembership = typeof householdMemberships.$inferSelect;
export type UserDefaultHousehold = typeof userDefaultHouseholds.$inferSelect;
export type CookidooCredential = typeof cookidooCredentials.$inferSelect;
export type NewCookidooCredential = typeof cookidooCredentials.$inferInsert;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  keys: text("keys").notNull(), // JSON { p256dh, auth }
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique("push_subscriptions_user_endpoint_uidx").on(t.userId, t.endpoint),
  index("push_subscriptions_user_idx").on(t.userId),
]);
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;

export const byokValidationRateLimits = pgTable("byok_validation_rate_limits", {
  userId: uuid("user_id").notNull(),
  keyHash: text("key_hash").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({
    columns: [t.userId, t.keyHash, t.windowStart],
    name: "byok_validation_rate_limits_pkey",
  }),
  index("byok_validation_rate_limits_user_window_idx").on(t.userId, t.windowStart),
]);
export type ByokValidationRateLimitRow = typeof byokValidationRateLimits.$inferSelect;

export const byokValidationPolicies = pgTable("byok_validation_policies", {
  singletonKey: text("singleton_key").primaryKey(),
  windowMinutes: integer("window_minutes").notNull(),
  maxRequests: integer("max_requests").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedByUserId: uuid("updated_by_user_id"),
}, (t) => [
  check("byok_validation_policies_window_minutes_check", sql`${t.windowMinutes} >= 1 AND ${t.windowMinutes} <= 1440`),
  check("byok_validation_policies_max_requests_check", sql`${t.maxRequests} >= 1 AND ${t.maxRequests} <= 1000`),
  index("byok_validation_policies_updated_by_idx").on(t.updatedByUserId),
]);
export type ByokValidationPolicyRow = typeof byokValidationPolicies.$inferSelect;
