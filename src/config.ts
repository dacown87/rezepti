import "dotenv/config";
import { join } from "node:path";

export const config = {
  groq: {
    apiKey:        process.env.GROQ_API_KEY || "",
    textModel:     process.env.GROQ_TEXT_MODEL    || "llama-3.3-70b-versatile",
    visionModel:   process.env.GROQ_VISION_MODEL  || "meta-llama/llama-4-scout-17b-16e-instruct",
    whisperModel:  process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo",
  },
  sqlite: {
    path: process.env.SQLITE_PATH || join(process.cwd(), "data", "rezepti.db"),
  },
  cookidoo: {
    email:    process.env.COOKIDOO_EMAIL    || "",
    password: process.env.COOKIDOO_PASSWORD || "",
  },
  port: parseInt(process.env.PORT || "3000", 10),
} as const;
