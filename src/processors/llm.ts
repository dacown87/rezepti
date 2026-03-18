import OpenAI from "openai";
import { config } from "../config.js";
import { RecipeDataSchema, type RecipeData } from "../types.js";

const groq = new OpenAI({
  apiKey:  config.groq.apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});

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

function buildJsonSchema() {
  return {
    type: "object" as const,
    properties: {
      name:        { type: "string" as const },
      duration:    { type: "string" as const, enum: ["kurz", "mittel", "lang"] },
      tags:        { type: "array" as const, items: { type: "string" as const } },
      imageUrl:    { type: "string" as const },
      calories:    { type: "number" as const },
      emoji:       { type: "string" as const },
      servings:    { type: "string" as const },
      ingredients: { type: "array" as const, items: { type: "string" as const } },
      steps:       { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["name", "duration", "tags", "emoji", "ingredients", "steps"],
    additionalProperties: false,
  };
}

async function chatJSON(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string
): Promise<unknown> {
  const response = await groq.chat.completions.create({
    model,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: { name: "recipe", strict: true, schema: buildJsonSchema() },
    },
    temperature: 0.3,
    max_tokens: 4096,
  });
  return JSON.parse(response.choices[0].message.content ?? "{}");
}

export async function extractRecipeFromText(
  text: string,
  existingImageUrl?: string
): Promise<RecipeData> {
  const raw = await chatJSON([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Extrahiere das Rezept aus folgendem Inhalt:\n\n${text.slice(0, 8000)}`,
    },
  ], config.groq.textModel) as Record<string, unknown>;

  if (!raw.imageUrl && existingImageUrl) {
    raw.imageUrl = existingImageUrl;
  }

  return RecipeDataSchema.parse(raw);
}

export async function extractRecipeFromImage(
  imageUrl: string,
  additionalText?: string
): Promise<RecipeData> {
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "image_url",
      image_url: { url: imageUrl },
    },
    {
      type: "text",
      text: additionalText
        ? `Extrahiere das Rezept aus diesem Bild. Zusätzlicher Kontext:\n${additionalText}`
        : "Extrahiere das Rezept aus diesem Bild.",
    },
  ];

  const raw = await chatJSON([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ], config.groq.visionModel) as Record<string, unknown>;

  if (!raw.imageUrl) {
    raw.imageUrl = imageUrl;
  }

  return RecipeDataSchema.parse(raw);
}

export async function refineRecipe(
  partial: Partial<RecipeData>
): Promise<RecipeData> {
  const raw = await chatJSON([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Übersetze und verfeinere dieses Rezept ins Deutsche. Konvertiere alle Einheiten ins metrische System. Schätze Kalorien. Wähle ein Emoji und Tags.\n\nRezept-Daten:\n${JSON.stringify(partial, null, 2)}`,
    },
  ], config.groq.textModel) as Record<string, unknown>;

  if (!raw.imageUrl && partial.imageUrl) {
    raw.imageUrl = partial.imageUrl;
  }

  return RecipeDataSchema.parse(raw);
}
