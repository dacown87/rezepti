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
    reactPath: process.env.SQLITE_REACT_PATH || join(process.cwd(), "data", "rezepti-react.db"),
  },
  cookidoo: {
    email:    process.env.COOKIDOO_EMAIL    || "",
    password: process.env.COOKIDOO_PASSWORD || "",
  },
  port: parseInt(process.env.PORT || "3000", 10),
  jobs: {
    cleanupDays: parseInt(process.env.JOB_CLEANUP_DAYS || "7", 10),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_JOBS || "5", 10),
    pollInterval: parseInt(process.env.POLL_INTERVAL_MS || "2000", 10),
  },
} as const;
