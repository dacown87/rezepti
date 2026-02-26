import { Client } from "@notionhq/client";
import { config } from "./config.js";
import type { RecipeData } from "./types.js";

let notion: Client | null = null;
let databaseId: string = config.notion.databaseId;

function getClient(): Client {
  if (!config.notion.token) {
    throw new Error(
      "NOTION_TOKEN nicht gesetzt. Bitte in .env konfigurieren."
    );
  }
  if (!notion) {
    notion = new Client({ auth: config.notion.token });
  }
  return notion;
}

/**
 * Ensure the recipe database exists. Creates it if needed.
 */
export async function ensureDatabase(): Promise<string> {
  if (databaseId) return databaseId;

  const client = getClient();

  if (!config.notion.parentPageId) {
    throw new Error(
      "NOTION_PARENT_PAGE_ID nicht gesetzt. Wird für die DB-Erstellung benötigt."
    );
  }

  // Step 1: Create the database (SDK v5 doesn't support properties in create)
  const createDb = await client.databases.create({
    parent: { type: "page_id", page_id: config.notion.parentPageId },
    title: [{ type: "text", text: { content: "Rezepte" } }],
  });
  const newDbId = createDb.id;

  // Step 2: Add properties via REST API (SDK v5 types don't expose this on create)
  const res = await fetch(`https://api.notion.com/v1/databases/${newDbId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${config.notion.token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      properties: {
        Name: { title: {} },
        Zubereitungsdauer: {
          select: {
            options: [
              { name: "kurz", color: "green" },
              { name: "mittel", color: "yellow" },
              { name: "lang", color: "red" },
            ],
          },
        },
        Tags: { multi_select: {} },
        Foto: { url: {} },
        Quelle: { url: {} },
        Ausprobiert: { checkbox: {} },
        Kalorien: { number: { format: "number" } },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Notion DB-Properties Fehler: ${JSON.stringify(err)}`);
  }

  const db = { id: newDbId };

  databaseId = db.id;
  console.log(`Notion-Datenbank erstellt: ${db.id}`);
  return databaseId;
}

/**
 * Create a recipe page in the Notion database.
 */
export async function createRecipePage(
  recipe: RecipeData,
  sourceUrl: string,
  transcript?: string
): Promise<string> {
  const client = getClient();
  const dbId = await ensureDatabase();

  // Build properties
  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: recipe.name } }],
    },
    Zubereitungsdauer: {
      select: { name: recipe.duration },
    },
    Tags: {
      multi_select: recipe.tags
        .filter((t) => t && t.trim() !== "")
        .map((t) => ({ name: t.trim() })),
    },
    Quelle: {
      url: sourceUrl,
    },
    Ausprobiert: {
      checkbox: false,
    },
  };

  if (recipe.imageUrl) {
    properties.Foto = { url: recipe.imageUrl };
  }

  if (recipe.calories) {
    properties.Kalorien = { number: recipe.calories };
  }

  // Build page body: Zutaten + Schritte
  const children: unknown[] = [];

  // Heading: Zutaten
  children.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "Zutaten" } }],
    },
  });

  // Servings info
  if (recipe.servings) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: `Für ${recipe.servings}` },
            annotations: { italic: true },
          },
        ],
      },
    });
  }

  // Ingredient list (bulleted)
  for (const ingredient of recipe.ingredients) {
    children.push({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: ingredient } }],
      },
    });
  }

  // Divider
  children.push({ object: "block", type: "divider", divider: {} });

  // Heading: Zubereitung
  children.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "Zubereitung" } }],
    },
  });

  // Steps (numbered)
  for (const step of recipe.steps) {
    children.push({
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [{ type: "text", text: { content: step } }],
      },
    });
  }

  // Transcript (if available, as toggle block)
  if (transcript) {
    children.push({ object: "block", type: "divider", divider: {} });

    // Split transcript into chunks of max 2000 chars (Notion limit)
    const chunks: string[] = [];
    for (let i = 0; i < transcript.length; i += 2000) {
      chunks.push(transcript.slice(i, i + 2000));
    }

    children.push({
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "Transkript" }, annotations: { bold: true } }],
        children: chunks.map((chunk) => ({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: chunk } }],
          },
        })),
      },
    });
  }

  // Create the page
  const page = (await client.pages.create({
    parent: { database_id: dbId },
    icon: {
      type: "emoji",
      emoji: (recipe.emoji || "\u{1F37D}\uFE0F") as any,
    },
    ...(recipe.imageUrl
      ? {
          cover: {
            type: "external" as const,
            external: { url: recipe.imageUrl },
          },
        }
      : {}),
    properties: properties as any,
    children: children as any[],
  })) as any;

  return page.url;
}
