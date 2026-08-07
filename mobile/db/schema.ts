// Row-Typen der Backend-Tabellen — spiegelt src/schema.ts
// Reine Typdatei: die Daten kommen ueber /api/v1/*, nicht aus einer lokalen DB.

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
  category: string | null;     // Auto-assigned category label
  ingredients: string;         // JSON-Array serialized as TEXT
  steps: string;               // JSON-Array serialized as TEXT
  transcript: string | null;
  equipment: string | null;         // JSON-Array serialized as TEXT
  nutrition_info: string | null;    // JSON: {carbs, fat, protein}
  ingredient_groups: string | null; // JSON: [{heading, items}][]
  tried: number;               // 0 | 1
  rating: number | null;       // 1–5 | null
  notes: string | null;
  pdf_created: number;         // 0 | 1
  created_at: number | null;   // Unix timestamp
  // Sharing / favorites read-model (Phase 3 — optional, not a DB column on mobile).
  // Flows through from the API via apiToRecipe so list/detail can show scope hints
  // and the favorites filter. Absent on locally-created/offline rows.
  scope?: 'private' | 'household';
  isFavorite?: boolean;
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
