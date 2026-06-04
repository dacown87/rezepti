import { createClient } from "@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "hono";
import { loadUserAuthorization, type AppRole, type HouseholdRole, type UserAuthorization } from "./db-react.js";

export type AuthErrorCode =
  | "auth_missing"
  | "auth_invalid"
  | "token_expired"
  | "admin_required"
  | "forbidden"
  | "not_found"
  | "setup_required"
  | "no_household";

export interface AuthContext {
  userId: string;
  email: string | null;
  appRole: AppRole;
  memberships: Array<{ householdId: string; role: HouseholdRole }>;
  activeHouseholdId: string;
  accessToken: string;
  isAuthenticated: true;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export interface ApiErrorPayload {
  error: {
    code: AuthErrorCode;
    message: string;
    cause?: string;
    fix?: string;
  };
}

export class AuthFlowError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly status: 401 | 403 | 404 | 500,
    public readonly causeText?: string,
    public readonly fix?: string,
  ) {
    super(message);
  }
}

type VerifyAccessToken = (accessToken: string) => Promise<AuthenticatedUser>;
type LoadAuthorization = (user: AuthenticatedUser) => Promise<UserAuthorization>;

let verifyAccessToken: VerifyAccessToken = verifySupabaseAccessToken;
let loadAuthorization: LoadAuthorization = (user) => loadUserAuthorization(user.id, user.email);

export function configureAuthForTests(adapters: {
  verifyAccessToken?: VerifyAccessToken;
  loadAuthorization?: LoadAuthorization;
}) {
  if (adapters.verifyAccessToken) verifyAccessToken = adapters.verifyAccessToken;
  if (adapters.loadAuthorization) loadAuthorization = adapters.loadAuthorization;
}

export function resetAuthAdaptersForTests() {
  verifyAccessToken = verifySupabaseAccessToken;
  loadAuthorization = (user) => loadUserAuthorization(user.id, user.email);
}

export function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token, extra] = authorizationHeader.trim().split(/\s+/);
  if (extra || scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function authErrorPayload(
  code: AuthErrorCode,
  message: string,
  cause?: string,
  fix?: string,
): ApiErrorPayload {
  return {
    error: {
      code,
      message,
      ...(cause ? { cause } : {}),
      ...(fix ? { fix } : {}),
    },
  };
}

export function authErrorResponse(c: Context, error: AuthFlowError) {
  return c.json(authErrorPayload(error.code, error.message, error.causeText, error.fix), error.status);
}

async function verifySupabaseAccessToken(accessToken: string): Promise<AuthenticatedUser> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new AuthFlowError(
      "setup_required",
      "Supabase Auth is not configured",
      500,
      "SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY are required",
      "Set the server Supabase env vars before calling protected routes",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    const code = error?.message.toLowerCase().includes("expired") ? "token_expired" : "auth_invalid";
    throw new AuthFlowError(
      code,
      code === "token_expired" ? "Access token has expired" : "Invalid access token",
      401,
      error?.message,
      "Sign in again and retry with a fresh Bearer token",
    );
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

export async function resolveAuthContext(authorizationHeader: string | null | undefined): Promise<AuthContext> {
  const accessToken = extractBearerToken(authorizationHeader);
  if (!accessToken) {
    throw new AuthFlowError(
      "auth_missing",
      "Missing Authorization Bearer token",
      401,
      "Protected endpoints require Authorization: Bearer <Supabase access token>",
      "Sign in and retry with the session access token",
    );
  }

  const user = await verifyAccessToken(accessToken);
  const authorization = await loadAuthorization(user);

  if (!authorization.activeHouseholdId) {
    throw new AuthFlowError(
      "no_household",
      "User has no active household",
      403,
      "Shopping and planner endpoints are household-scoped in this slice",
      "Create a default household and membership for this user",
    );
  }

  return {
    userId: user.id,
    email: user.email,
    appRole: authorization.appRole,
    memberships: authorization.memberships,
    activeHouseholdId: authorization.activeHouseholdId,
    accessToken,
    isAuthenticated: true,
  };
}

export function getAuth(c: Context): AuthContext {
  const auth = c.get("auth");
  if (!auth) {
    throw new AuthFlowError("auth_missing", "Auth context is missing", 401);
  }
  return auth as AuthContext;
}

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    try {
      const auth = await resolveAuthContext(c.req.header("Authorization"));
      c.set("auth", auth);
      await next();
    } catch (error) {
      if (error instanceof AuthFlowError) {
        return authErrorResponse(c, error);
      }
      console.error("Unexpected auth error:", error);
      return c.json(
        authErrorPayload("auth_invalid", "Authentication failed", error instanceof Error ? error.message : undefined),
        401,
      );
    }
  };
}

export function getCurrentUserId(): string | null {
  return null;
}

export function isAuthenticated(): boolean {
  return false;
}
