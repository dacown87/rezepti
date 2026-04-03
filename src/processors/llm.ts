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

Antworte NUR mit folgendem JSON-Format, exakt diese Feldnamen:
{
  "name": "Rezeptname auf Deutsch",
  "duration": "kurz" | "mittel" | "lang",
  "tags": ["Tag1", "Tag2"],
  "emoji": "🍕",
  "calories": 450,
  "servings": "4 Portionen",
  "imageUrl": "",
  "ingredients": ["200g Mehl", "2 Eier"],
  "steps": ["Schritt 1", "Schritt 2"]
}`;

async function chatJSON(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string
): Promise<unknown> {
  const response = await groq.chat.completions.create({
    model,
    messages,
    response_format: { type: "json_object" },
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

export async function extractRecipeFromImages(
  imageUrls: string[],
  additionalText?: string
): Promise<RecipeData> {
  const imageParts: OpenAI.Chat.ChatCompletionContentPart[] = imageUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

  const textPart: OpenAI.Chat.ChatCompletionContentPart = {
    type: "text",
    text: additionalText
      ? `Extrahiere das Rezept aus diesen ${imageUrls.length} Bildern. Zusätzlicher Kontext:\n${additionalText}`
      : `Extrahiere das Rezept aus diesen ${imageUrls.length} Bildern eines Instagram-Carousels.`,
  };

  const userContent = [...imageParts, textPart];

  const raw = await chatJSON([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ], config.groq.visionModel) as Record<string, unknown>;

  if (!raw.imageUrl && imageUrls.length > 0) {
    raw.imageUrl = imageUrls[0];
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
      content: `Ergänze und übersetze dieses Rezept ins Deutsche. Wichtige Regeln:
- Übernimm "ingredients" und "steps" EXAKT wie angegeben – keine Umformulierungen, keine Zusammenfassungen, keine Schritte zusammenfassen
- Behalte alle Unicode-Sonderzeichen in steps unverändert bei (z.B. ↺ ⟳ ⚙ und andere Symbole – NICHT ersetzen oder entfernen)
- Übersetze einzelne Felder nur wenn sie noch nicht auf Deutsch sind
- Konvertiere Mengenangaben in metrische Einheiten falls nötig
- Schätze Kalorien falls nicht vorhanden
- Wähle ein passendes Emoji und deutsche Tags falls nicht vorhanden

Rezept-Daten:\n${JSON.stringify(partial, null, 2)}`,
    },
  ], config.groq.textModel) as Record<string, unknown>;

  if (!raw.imageUrl && partial.imageUrl) {
    raw.imageUrl = partial.imageUrl;
  }

  return RecipeDataSchema.parse(raw);
}
