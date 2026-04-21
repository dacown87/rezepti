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

async function emit(cb: EventCallback, event: PipelineEvent) {
  await cb(event);
}

export async function processURL(
  rawUrl: string,
  onEvent: EventCallback
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
        bundle = await fetchTikTok(classified.url, tempDir);
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
        recipe = await refineRecipe(partial);
      } else {
        const result = await extractFromBundle(bundle, tempDir, onEvent);
        recipe = result.recipe;
        transcript = result.transcript;
      }
    } else {
      const result = await extractFromBundle(bundle, tempDir, onEvent);
      recipe = result.recipe;
      transcript = result.transcript;
    }

    // Inject equipment from bundle (HTML-scraped, not LLM-generated)
    if (bundle.equipment && bundle.equipment.length > 0 && !recipe.equipment?.length) {
      recipe = { ...recipe, equipment: bundle.equipment };
    }

    await emit(onEvent, {
      stage: "extracting",
      message: `Rezept extrahiert: ${recipe.name}`,
      data: recipe,
    });

    // Step 4: Save to SQLite
    await emit(onEvent, {
      stage: "exporting",
      message: "Rezept wird in Datenbank gespeichert...",
    });
    
    const recipeId = await saveRecipeToReactDb(recipe, classified.url, transcript);
    
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

    return { success: true, recipe, recipeId };
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
  onEvent: EventCallback
): Promise<ExtractionResult> {
  const textContent =
    bundle.subtitles || bundle.textContent || bundle.description || "";

  if (textContent.length > 50) {
    await emit(onEvent, {
      stage: "extracting",
      message: "Rezept wird aus Text extrahiert...",
    });
    const recipe = await extractRecipeFromText(textContent, bundle.imageUrls[0]);
    return { recipe, transcript: bundle.subtitles };
  }

  if (bundle.audioPath) {
    await emit(onEvent, {
      stage: "transcribing",
      message: "Audio wird transkribiert (Whisper)...",
    });
    const transcript = await transcribeAudio(bundle.audioPath, tempDir);
    await emit(onEvent, {
      stage: "transcribing",
      message: "Transkription abgeschlossen.",
    });

    if (transcript.length > 50) {
      await emit(onEvent, {
        stage: "extracting",
        message: "Rezept wird aus Transkription extrahiert...",
      });
      const recipe = await extractRecipeFromText(transcript, bundle.imageUrls[0]);
      return { recipe, transcript };
    }
  }

  if (bundle.imageUrls.length > 0) {
    if (bundle.isCarousel && bundle.imageUrls.length > 1) {
      await emit(onEvent, {
        stage: "analyzing_image",
        message: `${bundle.imageUrls.length} Carousel-Bilder werden mit Vision-Modell analysiert...`,
      });
      const recipe = await extractRecipeFromImages(bundle.imageUrls, bundle.description);
      return { recipe };
    }

    const imageUrl = bundle.imageUrls[0];
    await emit(onEvent, {
      stage: "analyzing_image",
      message: "Bild wird mit Vision-Modell analysiert...",
    });
    const recipe = await extractRecipeFromImage(imageUrl, bundle.description);
    return { recipe };
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

  // Generic timeout
  if (/timeout|timed out/i.test(raw)) {
    return {
      message: "Zeitüberschreitung beim Abrufen der Seite. Bitte erneut versuchen.",
    };
  }

  return { message: raw };
}
