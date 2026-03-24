import { classifyURL } from "./classifier.js";
import { fetchWeb } from "./fetchers/web.js";
import { fetchYouTube } from "./fetchers/youtube.js";
import { fetchInstagram } from "./fetchers/instagram.js";
import { fetchTikTok } from "./fetchers/tiktok.js";
import { fetchCookidoo } from "./fetchers/cookidoo.js";
import { schemaToRecipeData } from "./processors/schema-org.js";
import {
  extractRecipeFromText,
  extractRecipeFromImage,
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
      if (partial && partial.ingredients && partial.ingredients.length > 0) {
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
    
    const recipeId = saveRecipeToReactDb(recipe, classified.url, transcript);
    
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
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    await emit(onEvent, { stage: "error", message });
    return { success: false, error: message };
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
    const imageUrl = bundle.imageUrls[0];
    await emit(onEvent, {
      stage: "analyzing_image",
      message: "Bild wird mit Vision-Modell analysiert...",
    });
    const recipe = await extractRecipeFromImage(imageUrl, bundle.description);
    return { recipe };
  }

  throw new Error(
    "Kein Rezept-Inhalt gefunden. Weder Text, Audio noch Bilder verfügbar."
  );
}
