import "dotenv/config";

export const config = {
  notion: {
    token: process.env.NOTION_TOKEN || "",
    databaseId: process.env.NOTION_DATABASE_ID || "",
    parentPageId: process.env.NOTION_PARENT_PAGE_ID || "",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    textModel: process.env.OLLAMA_TEXT_MODEL || "llama3.2:3b",
    visionModel: process.env.OLLAMA_VISION_MODEL || "llava:7b",
  },
  port: parseInt(process.env.PORT || "3000", 10),
} as const;
