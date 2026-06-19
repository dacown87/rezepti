import { BYOKValidator } from "./byok-validator.js";
import { loadRuntimeByokValidationPolicy, type ByokValidationPolicy } from "./db-react.js";

export interface ByokEnforcementResult {
  keyHash: string;
  policy: ByokValidationPolicy;
  remaining?: number;
  resetTime?: number;
  model?: string;
}

export interface ByokValidationFailurePayload {
  error: string;
  code: "byok_key_invalid" | "byok_validation_rate_limited";
  details?: string;
  remaining?: number;
  resetTime?: number;
}

export class ByokValidationFailure extends Error {
  constructor(
    public readonly status: 400 | 429,
    public readonly payload: ByokValidationFailurePayload,
    public readonly result?: Partial<ByokEnforcementResult>,
  ) {
    super(payload.details ?? payload.error);
  }
}

export function logByokPolicyFallback(context: string, reason?: "missing_table" | "read_failed") {
  if (!reason) return;
  console.warn(`byok.policy.fallback.${context}`, { reason });
}

export async function enforceByokValidation(
  apiKey: string,
  userId?: string,
): Promise<ByokEnforcementResult> {
  const keyHash = BYOKValidator.hashKey(apiKey);
  const { policy, fallbackReason } = await loadRuntimeByokValidationPolicy();

  logByokPolicyFallback("validate", fallbackReason);

  const rateLimit = userId
    ? await BYOKValidator.checkRateLimit(
      keyHash,
      policy.windowMinutes,
      policy.maxRequests,
      userId,
    )
    : await BYOKValidator.checkRateLimit(
      keyHash,
      policy.windowMinutes,
      policy.maxRequests,
    );

  if (!rateLimit.allowed) {
    throw new ByokValidationFailure(429, {
      error: "BYOK validation rate limit exceeded",
      code: "byok_validation_rate_limited",
      remaining: rateLimit.remaining ?? 0,
      resetTime: rateLimit.resetTime,
    }, {
      keyHash,
      policy,
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime,
    });
  }

  const validation = await BYOKValidator.validateKey(apiKey);
  if (!validation.valid) {
    throw new ByokValidationFailure(400, {
      error: "Invalid API key",
      code: "byok_key_invalid",
      details: validation.reason ?? "Unknown validation error",
    }, {
      keyHash,
      policy,
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime,
      model: validation.model,
    });
  }

  return {
    keyHash,
    policy,
    remaining: rateLimit.remaining,
    resetTime: rateLimit.resetTime,
    model: validation.model,
  };
}
