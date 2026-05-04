import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { config } from "../config.js";

export interface WhisperOptions {
  apiKey?: string;
}

function createGroqClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || config.groq.apiKey,
    baseURL: config.groq.baseUrl,
  });
}

/**
 * Transcribe audio file using Groq Whisper API.
 * Returns the transcribed text.
 */
export async function transcribeAudio(
  audioPath: string,
  _tempDir: string,
  options: WhisperOptions = {}
): Promise<string> {
  const groq = createGroqClient(options.apiKey);
  const response = await groq.audio.transcriptions.create({
    file:  createReadStream(audioPath) as unknown as File,
    model: config.groq.whisperModel,
  });

  return response.text.trim();
}
