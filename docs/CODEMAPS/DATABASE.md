# Database Codemap

**Last Updated:** 2026-03-28

## Database

**File:** `data/rezepti-react.db`

**Technology:** SQLite with Drizzle ORM + better-sqlite3

**Initialization:** `ensureReactSchema()` called on server startup

## Schema

### Recipes Table

```sql
CREATE TABLE recipes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  emoji       TEXT,
  source_url  TEXT,
  image_url   TEXT,
  servings    TEXT,
  duration    TEXT,          -- 'kurz' | 'mittel' | 'lang'
  calories    INTEGER,
  tags        TEXT,           -- JSON array
  ingredients TEXT NOT NULL,  -- JSON array
  steps       TEXT NOT NULL,  -- JSON array
  transcript  TEXT,
  tried       INTEGER DEFAULT 0,
  rating      INTEGER,       -- 1-5 stars, null = unrated
  notes       TEXT,          -- personal notes
  pdf_created INTEGER DEFAULT 0,
  created_at  INTEGER         -- Unix timestamp
);
```

### Ingredient Dictionary Table

```sql
CREATE TABLE ingredient_dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL UNIQUE,
  aliases TEXT        -- JSON array
);
```

### Shopping List Table

```sql
CREATE TABLE shopping_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER,
  canonical_name TEXT NOT NULL,
  quantity TEXT,      -- e.g. "200" or "1/2"
  unit TEXT,          -- e.g. "g", "ml", "Stück"
  checked INTEGER DEFAULT 0,
  created_at INTEGER
);
```

### Meal Plan Table

```sql
CREATE TABLE meal_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,  -- 0=Monday, 6=Sunday
  week_start INTEGER NOT NULL,  -- Monday as Unix timestamp
  created_at INTEGER
);
```

### Extraction Jobs Table

```sql
CREATE TABLE extraction_jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  current_stage TEXT,
  message TEXT,
  result TEXT,         -- JSON
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  api_key_hash TEXT,
  user_agent TEXT
);
```

Indexes:
- `idx_extraction_jobs_status` - (status, updated_at)
- `idx_extraction_jobs_created` - (created_at DESC)
- `idx_extraction_jobs_url` - (url)

## Drizzle Schema

**Location:** `src/schema.ts`

```typescript
export const recipes = sqliteTable("recipes", { ... });
export const ingredientDictionary = sqliteTable("ingredient_dictionary", { ... });
export const shoppingList = sqliteTable("shopping_list", { ... });
export const mealPlan = sqliteTable("meal_plan", { ... });
```

## Database Functions

**Location:** `src/db-react.ts`

### Recipe CRUD

| Function | Purpose |
|----------|---------|
| `saveRecipeToReactDb(recipe, sourceUrl, transcript?)` | Insert new recipe |
| `getAllRecipesFromReactDb()` | Get all recipes (ordered by created_at) |
| `getRecipeByIdFromReactDb(id)` | Get single recipe |
| `updateRecipeInReactDb(id, fields)` | Update recipe fields |
| `deleteRecipeFromReactDb(id)` | Delete recipe |
| `getRecipeCount()` | Lightweight count |
| `searchRecipesByIngredients(ingredients[])` | Filter by ingredients (OR logic) |

### Ingredient Dictionary

| Function | Purpose |
|----------|---------|
| `getAllDictionaryEntries()` | List all entries |
| `addToDictionary(canonicalName, aliases?)` | Add entry |
| `findCanonicalBySimilarity(name)` | Fuzzy match |

### Shopping List

| Function | Purpose |
|----------|---------|
| `getShoppingList()` | Get all items |
| `addToShoppingList(recipeId?, canonicalName, quantity?, unit?)` | Add item |
| `toggleShoppingItem(id)` | Toggle checked state |
| `deleteShoppingItem(id)` | Delete single item |
| `clearCheckedItems()` | Delete all checked |
| `clearAllShoppingItems()` | Clear entire list |

### Meal Plan

| Function | Purpose |
|----------|---------|
| `getMealPlanForWeek(weekStart)` | Get week's plan |
| `addRecipeToMealPlan(recipeId, dayOfWeek, weekStart)` | Add recipe |
| `removeRecipeFromMealPlan(id)` | Remove entry |
| `clearMealPlanForWeek(weekStart)` | Clear week |

## JSON Serialization

JSON arrays (tags, ingredients, steps, aliases) are stored as TEXT in SQLite and parsed/serialized in code:

```typescript
// Deserialize (DB → API)
JSON.parse(row.tags) as string[]

// Serialize (API → DB)
JSON.stringify(recipe.tags)
```

## Migrations

Migrations are handled in `ensureReactSchema()` using `ALTER TABLE` with try/catch to handle existing databases gracefully.

## Configuration

**Location:** `src/config.ts`

```typescript
sqlite: {
  path: process.env.SQLITE_PATH || "data/rezepti.db",
  reactPath: process.env.SQLITE_REACT_PATH || "data/rezepti-react.db"
}
```
