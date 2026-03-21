/**
 * BYOK (Bring Your Own Key) Validator
 * Validates user-provided Groq API keys before allowing extraction
 */

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { config } from "./config.js";

/**
 * BYOK validation result
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  model?: string;
}

/**
 * BYOK validator class
 */
export class BYOKValidator {
  /**
   * Validate a Groq API key by making a simple test request
   */
  static async validateKey(apiKey: string): Promise<ValidationResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        valid: false,
        reason: "API key is empty",
      };
    }
    
    // Basic format check (Groq keys start with 'gsk_')
    if (!apiKey.startsWith("gsk_")) {
      return {
        valid: false,
        reason: "Invalid API key format. Groq keys should start with 'gsk_'",
      };
    }
    
    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      
      // Test the key with a simple request
      const response = await openai.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
      });
      
      if (!response.choices?.[0]?.message?.content) {
        return {
          valid: false,
          reason: "API key test failed: No response from Groq API",
        };
      }
      
      return {
        valid: true,
        model: response.model,
      };
    } catch (error: any) {
      console.error("BYOK validation error:", error);
      
      let reason = "Unknown validation error";
      let statusCode = 0;
      
      if (error?.status) {
        statusCode = error.status;
      } else if (error?.response?.status) {
        statusCode = error.response.status;
      }
      
      switch (statusCode) {
        case 401:
          reason = "Invalid API key (unauthorized)";
          break;
        case 403:
          reason = "API key lacks required permissions";
          break;
        case 429:
          reason = "Rate limit exceeded with this key";
          break;
        default:
          if (error?.message?.includes("rate limit")) {
            reason = "Rate limit exceeded";
          } else if (error?.message?.includes("invalid")) {
            reason = "Invalid API key";
          } else {
            reason = `API key validation failed: ${error?.message || "Unknown error"}`;
          }
      }
      
      return {
        valid: false,
        reason,
      };
    }
  }
  
  /**
   * Create a hash of the API key for storage (never store raw keys)
   */
  static hashKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }
  
  /**
   * Determine which API key to use for a request
   * Priority: BYOK key > environment key > error
   */
  static async getValidatedKey(userKey?: string): Promise<{
    apiKey: string;
    isUserKey: boolean;
    validationResult?: ValidationResult;
  }> {
    // If user provided a key, validate it
    if (userKey) {
      const validation = await this.validateKey(userKey);
      if (validation.valid) {
        return {
          apiKey: userKey,
          isUserKey: true,
          validationResult: validation,
        };
      }
      // If user key is invalid, fall back to environment key
    }
    
    // Use environment key
    const envKey = config.groq.apiKey;
    if (!envKey) {
      throw new Error("No valid API key available. Please provide a Groq API key or set GROQ_API_KEY in environment.");
    }
    
    const validation = await this.validateKey(envKey);
    if (!validation.valid) {
      throw new Error(`Environment API key is invalid: ${validation.reason}`);
    }
    
    return {
      apiKey: envKey,
      isUserKey: false,
      validationResult: validation,
    };
  }
  
  /**
   * Rate limiting for BYOK keys (simple implementation)
   */
  static async checkRateLimit(keyHash: string, windowMinutes = 60, maxRequests = 100): Promise<{
    allowed: boolean;
    remaining?: number;
    resetTime?: number;
  }> {
    // Simple in-memory rate limiting
    // In production, use Redis or similar for distributed rate limiting
    
    // TODO: Implement proper rate limiting with persistence
    // For now, always allow
    
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: Date.now() + (windowMinutes * 60 * 1000),
    };
  }
  
  /**
   * Get available models for a given API key
   */
  static async getAvailableModels(apiKey: string): Promise<string[]> {
    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      
      const response = await openai.models.list();
      
      const groqModels = response.data
        .filter(model => model.id.includes("llama") || model.id.includes("mixtral") || model.id.includes("gemma"))
        .map(model => model.id);
      
      return [...new Set(groqModels)]; // Remove duplicates
    } catch (error) {
      console.error("Failed to fetch available models:", error);
      return [];
    }
  }
}