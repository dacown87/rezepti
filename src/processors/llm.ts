import { Ollama } from "ollama";
import { config } from "../config.js";
import { RecipeDataSchema, type RecipeData } from "../types.js";

const ollama = new Ollama({ host: config.ollama.baseUrl });

const SYSTEM_PROMPT = `Du bist ein Rezept-Extraktor. Deine Aufgabe:

1. Extrahiere das Rezept aus dem gegebenen Text/Inhalt.
2. Übersetze ALLES ins Deutsche (Rezeptname, Zutaten, Schritte).
3. Konvertiere alle Mengenangaben in metrische Einheiten:
   - cups → ml (1 cup = 240ml)
   - oz → g (1 oz = 28g)
   - lbs → g (1 lb = 454g)
   - tbsp → EL, tsp → TL
   - Fahrenheit → Celsius
   - inches → cm
4. Schätze die Kalorien pro Portion (kcal).
5. Wähle passende deutsche Tags (z.B. Pasta, Vegan, Asiatisch, Schnell, Dessert).
6. Wähle ein passendes Emoji für das Rezept.
7. Bestimme die Zubereitungsdauer: "kurz" (<20min), "mittel" (20-60min), "lang" (>60min).

Antworte NUR mit dem JSON-Objekt, kein zusätzlicher Text.`;

function buildRecipeJsonSchema() {
  return {
    type: "object" as const,
    properties: {
      name: { type: "string" as const },
      duration: { type: "string" as const, enum: ["kurz", "mittel", "lang"] },
      tags: { type: "array" as const, items: { type: "string" as const } },
      imageUrl: { type: "string" as const },
      calories: { type: "number" as const },
      emoji: { type: "string" as const },
      servings: { type: "string" as const },
      ingredients: {
        type: "array" as const,
        items: { type: "string" as const },
      },
      steps: { type: "array" as const, items: { type: "string" as const } },
    },
    required: [
      "name",
      "duration",
      "tags",
      "emoji",
      "ingredients",
      "steps",
    ],
  };
}

export async function extractRecipeFromText(
  text: string,
  existingImageUrl?: string
): Promise<RecipeData> {
  const prompt = `Extrahiere das Rezept aus folgendem Inhalt:\n\n${text.slice(0, 8000)}`;

  const response = await ollama.chat({
    model: config.ollama.textModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    format: buildRecipeJsonSchema(),
    options: {
      temperature: 0.3,
      num_predict: 4096,
    },
  });

  const raw = JSON.parse(response.message.content);

  // Apply existing image if LLM didn't provide one
  if (!raw.imageUrl && existingImageUrl) {
    raw.imageUrl = existingImageUrl;
  }

  return RecipeDataSchema.parse(raw);
}

export async function extractRecipeFromImage(
  imageUrl: string,
  additionalText?: string
): Promise<RecipeData> {
  // Download image first, then send as base64
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const base64Image = imageBuffer.toString("base64");

  const prompt = additionalText
    ? `Extrahiere das Rezept aus diesem Bild. Zusätzlicher Kontext:\n${additionalText}`
    : "Extrahiere das Rezept aus diesem Bild.";

  const response = await ollama.chat({
    model: config.ollama.visionModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: prompt,
        images: [base64Image],
      },
    ],
    format: buildRecipeJsonSchema(),
    options: {
      temperature: 0.3,
      num_predict: 4096,
    },
  });

  const raw = JSON.parse(response.message.content);
  if (!raw.imageUrl) {
    raw.imageUrl = imageUrl;
  }

  return RecipeDataSchema.parse(raw);
}

/**
 * Refine a partially extracted recipe (e.g. from schema.org fast path)
 * by translating and converting units via LLM.
 */
export async function refineRecipe(
  partial: Partial<RecipeData>
): Promise<RecipeData> {
  const prompt = `Übersetze und verfeinere dieses Rezept ins Deutsche. Konvertiere alle Einheiten ins metrische System. Schätze Kalorien. Wähle ein Emoji und Tags.\n\nRezept-Daten:\n${JSON.stringify(partial, null, 2)}`;

  const response = await ollama.chat({
    model: config.ollama.textModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    format: buildRecipeJsonSchema(),
    options: {
      temperature: 0.3,
      num_predict: 4096,
    },
  });

  const raw = JSON.parse(response.message.content);

  // Preserve image URL from partial data
  if (!raw.imageUrl && partial.imageUrl) {
    raw.imageUrl = partial.imageUrl;
  }

  return RecipeDataSchema.parse(raw);
}
