import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { config } from "../config.js";

const groq = new OpenAI({
  apiKey:  config.groq.apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Transcribe audio file using Groq Whisper API.
 * Returns the transcribed text.
 */
export async function transcribeAudio(
  audioPath: string,
  _tempDir: string
): Promise<string> {
  const response = await groq.audio.transcriptions.create({
    file:  createReadStream(audioPath) as unknown as File,
    model: config.groq.whisperModel,
  });

  return response.text.trim();
}
