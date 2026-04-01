// expo-sqlite DB schema — spiegelt src/schema.ts (Backend)
// Kein Drizzle auf Mobile: raw SQL via expo-sqlite

export const DB_NAME = 'recipedeck.db';
export const DB_VERSION = 1;

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT,
    source_url TEXT,
    image_url TEXT,
    servings TEXT,
    duration TEXT,
    calories INTEGER,
    tags TEXT,
    ingredients TEXT NOT NULL,
    steps TEXT NOT NULL,
    transcript TEXT,
    tried INTEGER DEFAULT 0,
    rating INTEGER,
    notes TEXT,
    pdf_created INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER,
    canonical_name TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    checked INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS meal_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    week_start INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS db_version (
    version INTEGER NOT NULL
  );
`;

export interface Recipe {
  id: number;
  name: string;
  emoji: string | null;
  source_url: string | null;
  image_url: string | null;
  servings: string | null;
  duration: string | null;
  calories: number | null;
  tags: string | null;         // JSON-Array serialized as TEXT
  ingredients: string;         // JSON-Array serialized as TEXT
  steps: string;               // JSON-Array serialized as TEXT
  transcript: string | null;
  tried: number;               // 0 | 1
  rating: number | null;       // 1–5 | null
  notes: string | null;
  pdf_created: number;         // 0 | 1
  created_at: number | null;   // Unix timestamp
}

export interface ShoppingListItem {
  id: number;
  recipe_id: number | null;
  canonical_name: string;
  quantity: string | null;
  unit: string | null;
  checked: number;             // 0 | 1
  created_at: number | null;
}

export interface MealPlanEntry {
  id: number;
  recipe_id: number;
  day_of_week: number;         // 0=Montag, 6=Sonntag
  week_start: number;          // Unix timestamp (Montag)
  created_at: number | null;
}
