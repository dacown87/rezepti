import { classifyURL } from "./classifier.js";
import { fetchWeb } from "./fetchers/web.js";
import { fetchYouTube } from "./fetchers/youtube.js";
import { fetchInstagram } from "./fetchers/instagram.js";
import { fetchTikTok } from "./fetchers/tiktok.js";
import { fetchCookidoo } from "./fetchers/cookidoo.js";
import { fetchPinterest } from "./fetchers/pinterest.js";
import { fetchFacebook } from "./fetchers/facebook.js";
import { fetchChefkoch } from "./fetchers/chefkoch.js";
import { schemaToRecipeData, finalizeRecipe } from "./processors/schema-org.js";
import {
  extractRecipeFromText,
  extractRecipeFromImage,
  extractRecipeFromImages,
  refineRecipe,
  estimateNutrition,
} from "./processors/llm.js";
import { transcribeAudio } from "./processors/whisper.js";
import { saveRecipeToReactDb } from "./db-react.js";
import { createTempDir, cleanupTempDir } from "./temp.js";
import type {
  ContentBundle,
  PipelineEvent,
  PipelineResult,
  RecipeData,
} from "./types.js";

type EventCallback = (event: PipelineEvent) => void | Promise<void>;

interface PipelineOptions {
  apiKey?: string;
  userId?: string;
}

export function buildQualityWarnings(recipe: Partial<RecipeData>, sourceUrl?: string): string[] {
  const warnings: string[] = [];
  if (!recipe.ingredients || recipe.ingredients.length === 0)
    warnings.push("Keine Zutaten erkannt — bitte manuell ergänzen.");
  if (!recipe.steps || recipe.steps.length === 0)
    warnings.push("Keine Zubereitungsschritte erkannt — bitte manuell ergänzen.");
  if (!recipe.name || recipe.name === sourceUrl || /^https?:\/\//i.test(recipe.name))
    warnings.push("Kein Rezeptname erkannt — bitte manuell eintragen.");
  return warnings;
}

async function emit(cb: EventCallback, event: PipelineEvent) {
  await cb(event);
}

export async function processURL(
  rawUrl: string,
  onEvent: EventCallback,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const tempDir = createTempDir();

  try {
    // Step 1: Classify URL
    await emit(onEvent, { stage: "classifying", message: "URL wird analysiert..." });
    const classified = classifyURL(rawUrl);
    await emit(onEvent, {
      stage: "classifying",
      message: `Erkannt als: ${classified.type}`,
    });

    // Step 2: Fetch content
    await emit(onEvent, {
      stage: "fetching",
      message: `Inhalte werden abgerufen (${classified.type})...`,
    });
    let bundle: ContentBundle;

    switch (classified.type) {
      case "youtube":
        bundle = await fetchYouTube(classified.url, tempDir);
        break;
      case "instagram":
        bundle = await fetchInstagram(classified.url, tempDir);
        break;
      case "tiktok":
        bundle = await fetchTikTok(classified.url, tempDir, { apiKey: options.apiKey });
        break;
      case "cookidoo":
        bundle = await fetchCookidoo(classified.url);
        break;
      case "chefkoch":
        bundle = await fetchChefkoch(classified.url);
        break;
      case "pinterest":
        bundle = await fetchPinterest(classified.url, tempDir);
        break;
      case "facebook":
        bundle = await fetchFacebook(classified.url, tempDir);
        break;
      case "web":
      default:
        bundle = await fetchWeb(classified.url);
        break;
    }

    await emit(onEvent, { stage: "fetching", message: "Inhalte abgerufen." });

    // Step 3: Extract recipe
    let recipe: RecipeData;
    let transcript: string | undefined;

    if (bundle.schemaRecipe) {
      await emit(onEvent, {
        stage: "extracting",
        message: "Schema.org-Rezept gefunden, wird verarbeitet...",
      });
      const partial = schemaToRecipeData(bundle.schemaRecipe);
      const hasRequiredFields = !!(
        partial?.name &&
        partial.ingredients?.length &&
        partial.steps?.length &&
        partial.duration
      );
      if (partial && hasRequiredFields) {
        // All required fields present — no LLM needed
        recipe = finalizeRecipe(partial);
      } else if (partial && partial.ingredients && partial.ingredients.length > 0) {
        // Partial data — let LLM fill in missing fields (name, steps, etc.)
        await emit(onEvent, {
          stage: "extracting",
          message: "Rezept wird übersetzt und konvertiert...",
        });
        recipe = await refineRecipe(partial, { apiKey: options.apiKey });
      } else {
        const result = await extractFromBundle(bundle, tempDir, onEvent, options);
        recipe = result.recipe;
        transcript = result.transcript;
      }
    } else {
      const result = await extractFromBundle(bundle, tempDir, onEvent, options);
      recipe = result.recipe;
      transcript = result.transcript;
    }

    // Inject equipment from bundle (HTML-scraped, not LLM-generated)
    if (bundle.equipment && bundle.equipment.length > 0 && !recipe.equipment?.length) {
      recipe = { ...recipe, equipment: bundle.equipment };
    }
    // Inject ingredient groups from bundle (Cookidoo HTML-scraped)
    if (bundle.ingredientGroups && bundle.ingredientGroups.length >= 2 && !recipe.ingredientGroups?.length) {
      recipe = { ...recipe, ingredientGroups: bundle.ingredientGroups };
    }

    await emit(onEvent, {
      stage: "extracting",
      message: `Rezept extrahiert: ${recipe.name}`,
      data: recipe,
    });

    // Step 3b: Estimate nutrition if calories are missing
    let nutritionEstimated = false;
    if (!recipe.calories && recipe.ingredients && recipe.ingredients.length > 0) {
      await emit(onEvent, { stage: "extracting", message: "Nährwerte werden geschätzt..." });
      const nutrition = await estimateNutrition(recipe.ingredients, recipe.servings, { apiKey: options.apiKey }).catch(() => null);
      if (nutrition) {
        recipe = { ...recipe, calories: nutrition.calories };
        nutritionEstimated = true;
      }
    }

    // Step 4: Save to DB
    await emit(onEvent, {
      stage: "exporting",
      message: "Rezept wird in Datenbank gespeichert...",
    });

    if (!options.userId) {
      throw new Error("Authenticated user is required to save a recipe");
    }

    const recipeId = await saveRecipeToReactDb(recipe, classified.url, transcript, {
      owner: { type: "user", userId: options.userId },
      createdBy: options.userId,
    });
    
    await emit(onEvent, {
      stage: "exporting",
      message: `Rezept gespeichert (ID: ${recipeId}).`,
      data: { recipe, recipeId },
    });

    await emit(onEvent, {
      stage: "done",
      message: "Fertig!",
      data: { recipe, recipeId },
    });

    const qualityWarnings = buildQualityWarnings(recipe, classified.url);

    return {
      success: true,
      recipe,
      recipeId,
      qualityWarnings: qualityWarnings.length ? qualityWarnings : undefined,
      nutritionEstimated: nutritionEstimated || undefined,
    };
  } catch (error) {
    const { message, hint } = toUserFriendlyError(error);
    await emit(onEvent, { stage: "error", message });
    return { success: false, error: message, hint };
  } finally {
    cleanupTempDir(tempDir);
  }
}

interface ExtractionResult {
  recipe: RecipeData;
  transcript?: string;
}

async function extractFromBundle(
  bundle: ContentBundle,
  tempDir: string,
  onEvent: EventCallback,
  options: PipelineOptions = {}
): Promise<ExtractionResult> {
  const textContent =
    bundle.subtitles || bundle.textContent || bundle.description || "";

  if (textContent.length > 50) {
    await emit(onEvent, {
      stage: "extracting",
      message: "Rezept wird aus Text extrahiert...",
    });
    const recipe = await extractRecipeFromText(textContent, bundle.imageUrls[0], { apiKey: options.apiKey });
    return { recipe, transcript: bundle.subtitles };
  }

  if (bundle.audioPath) {
    await emit(onEvent, {
      stage: "transcribing",
      message: "Audio wird transkribiert (Whisper)...",
    });
    const transcript = await transcribeAudio(bundle.audioPath, tempDir, { apiKey: options.apiKey });
    await emit(onEvent, {
      stage: "transcribing",
      message: "Transkription abgeschlossen.",
    });

    if (transcript.length > 50) {
      await emit(onEvent, {
        stage: "extracting",
        message: "Rezept wird aus Transkription extrahiert...",
      });
      const recipe = await extractRecipeFromText(transcript, bundle.imageUrls[0], { apiKey: options.apiKey });
      return { recipe, transcript };
    }
  }

  if (bundle.imageUrls.length > 0) {
    if (bundle.isCarousel && bundle.imageUrls.length > 1) {
      await emit(onEvent, {
        stage: "analyzing_image",
        message: `${bundle.imageUrls.length} Carousel-Bilder werden mit Vision-Modell analysiert...`,
      });
      const recipe = await extractRecipeFromImages(bundle.imageUrls, bundle.description, { apiKey: options.apiKey });
      return { recipe };
    }

    const imageUrl = bundle.imageUrls[0];
    await emit(onEvent, {
      stage: "analyzing_image",
      message: "Bild wird mit Vision-Modell analysiert...",
    });
    const recipe = await extractRecipeFromImage(imageUrl, bundle.description, { apiKey: options.apiKey });
    return { recipe };
  }

  if (bundle.type === "instagram" || bundle.type === "tiktok") {
    throw new Error(
      "Kein Rezept gefunden. Instagram/TikTok erfordern einen Login für vollständige Inhalte. " +
      "Rezepte in den Kommentaren können nicht automatisch abgerufen werden. " +
      "Tipp: Kopiere den Rezepttext manuell und füge ihn als Webseite ein (z.B. über ein Textdokument)."
    );
  }
  throw new Error(
    "Kein verwertbarer Inhalt gefunden. Die Seite enthält kein erkennbares Rezept (kein Text, Audio oder Bild)."
  );
}

interface UserFriendlyError {
  message: string;
  hint?: string;
}

export function toUserFriendlyError(error: unknown): UserFriendlyError {
  const raw = error instanceof Error ? error.message : String(error);

  // Groq / OpenAI rate limit (DX-4)
  if (/429|rate.?limit|quota.?exceeded/i.test(raw)) {
    return {
      message: "Groq API-Limit erreicht. Bitte einen Moment warten oder einen eigenen API-Key hinzufügen.",
      hint: "byok",
    };
  }

  // Auth errors
  if (/401|unauthorized|invalid.?api.?key|authentication/i.test(raw)) {
    return {
      message: "Groq API-Key ungültig. Bitte den Key in den Einstellungen prüfen.",
      hint: "byok",
    };
  }

  // Facebook login / cookie errors
  if (/facebook.*login|login.*erforderlich|facebook.*cookies/i.test(raw)) {
    return {
      message: "Facebook-Login erforderlich. Bitte Facebook-Cookies in den Einstellungen hinterlegen.",
      hint: "facebook-cookies",
    };
  }

  // Facebook yt-dlp outdated / API changed
  if (/facebook.*reel.*konnte|yt-dlp veraltet|facebook api/i.test(raw)) {
    return {
      message: "Facebook-Reel konnte nicht geladen werden. Das Video ist möglicherweise temporär nicht abrufbar.",
    };
  }

  // Bot-protection / access denied (403/401 from fetchWeb)
  if (/HTTP 403|HTTP 401|access denied|bot.?schutz|cloudflare/i.test(raw)) {
    return {
      message: "Diese Website erlaubt kein automatisches Abrufen (Bot-Schutz aktiv).",
      hint: "Öffne die URL direkt im Browser, kopiere den Rezepttext und füge ihn als Freitext ein.",
    };
  }

  // Page not found
  if (/HTTP 404|not found/i.test(raw)) {
    return {
      message: "Seite nicht gefunden (404). Bitte prüfe ob die URL noch gültig ist.",
    };
  }

  // YouTube: no subtitles / transcription available
  if (/keine.*untertitel|no.*subtitle|no.*transcript|untertitel.*nicht/i.test(raw)) {
    return {
      message: "Dieses YouTube-Video hat keine Untertitel. Ohne Untertitel kann kein Rezept extrahiert werden.",
      hint: "Videos mit automatisch generierten Untertiteln funktionieren meistens besser.",
    };
  }

  // TikTok / Instagram: private or login-required
  if (/tiktok.*privat|privates.*video|login.*erforderlich.*tiktok/i.test(raw)) {
    return {
      message: "Dieses TikTok-Video ist privat und kann nicht abgerufen werden.",
    };
  }

  // Instagram/TikTok: no recipe found (thrown in extractFromBundle)
  if (/instagram.*tiktok.*login|instagram\/tiktok.*login/i.test(raw) ||
      /erfordern einen login/i.test(raw)) {
    return {
      message: "Kein Rezept gefunden. Instagram und TikTok erfordern einen Login für vollständige Inhalte.",
      hint: "Kopiere den Rezepttext manuell und füge ihn als Freitext ein.",
    };
  }

  // yt-dlp / video download errors
  if (/yt.?dlp|video unavailable|private video|geo.?blocked|copyright/i.test(raw)) {
    return {
      message: "Video konnte nicht abgerufen werden. Möglicherweise ist es privat, gelöscht oder in deiner Region gesperrt.",
    };
  }

  // Network errors
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network/i.test(raw)) {
    return {
      message: "Verbindungsfehler. Bitte die URL prüfen und es erneut versuchen.",
    };
  }

  // Schema parse / Zod errors (no recipe found)
  if (/ZodError|Expected|invalid_type|Required/i.test(raw) || raw.includes("parse")) {
    return {
      message: "Kein Rezept erkannt. Die Seite enthält möglicherweise kein strukturiertes Rezept.",
    };
  }

  // No usable content (web fallback exhausted)
  if (/kein verwertbarer inhalt|kein erkennbares rezept/i.test(raw)) {
    return {
      message: "Kein Rezept auf dieser Seite gefunden. Versuche eine direktere Rezept-URL oder kopiere den Text manuell.",
    };
  }

  // Timeout with seconds if available in message
  if (/timeout|timed out/i.test(raw)) {
    const seconds = raw.match(/(\d+)\s*s(?:ec|econds?)?/i)?.[1];
    return {
      message: seconds
        ? `Zeitüberschreitung nach ${seconds} Sekunden. Die Seite antwortet zu langsam.`
        : "Zeitüberschreitung beim Abrufen der Seite. Bitte erneut versuchen.",
    };
  }

  return { message: raw };
}
