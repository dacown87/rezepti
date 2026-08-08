import "dotenv/config";

export const config = {
  groq: {
    apiKey:        process.env.GROQ_API_KEY || "",
    baseUrl:       process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    textModel:     process.env.GROQ_TEXT_MODEL    || "llama-3.3-70b-versatile",
    visionModel:   process.env.GROQ_VISION_MODEL  || "meta-llama/llama-4-scout-17b-16e-instruct",
    whisperModel:  process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo",
  },
  supabase: {
    url:     process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  cookidoo: {
    email:    process.env.COOKIDOO_EMAIL    || "",
    password: process.env.COOKIDOO_PASSWORD || "",
  },
  tiktok: {
    ocrEnabled: process.env.TIKTOK_OCR_ENABLED !== "false",
    maxOcrFrames: parseInt(process.env.TIKTOK_MAX_OCR_FRAMES || "10", 10),
    proxyUrl: process.env.TIKTOK_PROXY_URL || "",
  },
  cobalt: {
    apiUrl: process.env.COBALT_API_URL || "https://api.cobalt.tools/",
    apiKey: process.env.COBALT_API_KEY || "",
  },
  web: {
    mlFallback: process.env.ENABLE_ML_FALLBACK === "true",
  },
  port: parseInt(process.env.PORT || "3000", 10),
  jobs: {
    cleanupDays: parseInt(process.env.JOB_CLEANUP_DAYS || "7", 10),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_JOBS || "6", 10),
    maxConcurrentPerUser: parseInt(process.env.MAX_CONCURRENT_JOBS_PER_USER || "3", 10),
    pollInterval: parseInt(process.env.POLL_INTERVAL_MS || "2000", 10),
    stalledAfterMs: parseInt(process.env.JOB_STALLED_AFTER_MINUTES || "30", 10) * 60 * 1000,
  },
} as const;
