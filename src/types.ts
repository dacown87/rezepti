import { z } from "zod";

// --- URL Classification ---

export type SourceType = "youtube" | "instagram" | "tiktok" | "cookidoo" | "pinterest" | "facebook" | "chefkoch" | "web";

export interface ClassifiedURL {
  url: string;
  type: SourceType;
}

// --- Content Bundle (output of fetchers) ---

export interface ContentBundle {
  url: string;
  type: SourceType;
  title?: string;
  description?: string;
  textContent?: string;
  subtitles?: string;
  imageUrls: string[];
  audioPath?: string;
  schemaRecipe?: SchemaOrgRecipe | null;
  isCarousel?: boolean;
  carouselCount?: number;
}

// --- schema.org/Recipe (from JSON-LD) ---

export interface SchemaOrgRecipe {
  name: string;
  description?: string;
  image?: string | string[] | { url?: string } | { url?: string }[];
  recipeIngredient?: string[];
  recipeInstructions?: (string | { text?: string } | { "@type": "HowToSection"; itemListElement?: { text?: string }[] })[];
  totalTime?: string;
  prepTime?: string;
  cookTime?: string;
  recipeYield?: string;
  recipeCategory?: string[];
  recipeCuisine?: string[];
  nutrition?: { calories?: string };
  author?: string | { name?: string };
}

// --- Recipe Data (LLM output / final structure) ---

export const RecipeDataSchema = z.object({
  name: z.string().describe("Rezeptname auf Deutsch"),
  duration: z
    .enum(["kurz", "mittel", "lang"])
    .describe("Zubereitungsdauer: kurz (<20min), mittel (20-60min), lang (>60min)"),
  tags: z
    .array(z.string())
    .describe("Tags auf Deutsch, z.B. Pasta, Vegan, Asiatisch"),
  imageUrl: z.string().optional().describe("URL zum Rezeptfoto"),
  calories: z.number().optional().describe("Geschätzte kcal pro Portion"),
  emoji: z.string().describe("Ein passendes Emoji für das Rezept"),
  servings: z.string().optional().describe("Anzahl Portionen"),
  ingredients: z
    .array(z.string())
    .describe("Zutatenliste auf Deutsch, metrische Einheiten (ml, g, kg)"),
  steps: z
    .array(z.string())
    .describe("Zubereitungsschritte auf Deutsch, nummeriert"),
});

export type RecipeData = z.infer<typeof RecipeDataSchema>;

// --- Pipeline ---

export type PipelineStage =
  | "classifying"
  | "fetching"
  | "transcribing"
  | "analyzing_image"
  | "extracting"
  | "exporting"
  | "done"
  | "error";

export interface PipelineEvent {
  stage: PipelineStage;
  message: string;
  data?: unknown;
}

export interface PipelineResult {
  success: boolean;
  recipe?: RecipeData;
  recipeId?: number;
  error?: string;
}
