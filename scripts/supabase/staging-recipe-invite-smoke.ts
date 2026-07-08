import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const password = "RecipeInviteSmoke-2026!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userAEmail = `recipe-invite-a-${runId}@example.test`;
const userBEmail = `recipe-invite-b-${runId}@example.test`;

const createdUserIds: string[] = [];
const createdRecipeIds: number[] = [];
const createdCollectionIds: string[] = [];

type SmokeTarget = "staging" | "production";

type SmokeConfig = {
  target: SmokeTarget;
  label: string;
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  databaseUrl: string;
  apiBaseUrl: string | null;
  sourceUrl: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optional(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function readTarget(): SmokeTarget {
  const raw = process.env.RECIPE_INVITE_SMOKE_TARGET?.trim().toLowerCase() || "staging";
  if (raw === "staging" || raw === "production") return raw;
  throw new Error("RECIPE_INVITE_SMOKE_TARGET must be staging or production.");
}

function readConfig(): SmokeConfig {
  const target = readTarget();
  if (target === "staging") {
    const supabaseUrl = required("STAGING_SUPABASE_URL");
    assert(!/prod|production/i.test(supabaseUrl), "Refusing to run staging smoke against a Supabase URL that looks like production.");
    return {
      target,
      label: "Staging",
      supabaseUrl,
      publishableKey: optional("STAGING_SUPABASE_PUBLISHABLE_KEY", "STAGING_SUPABASE_ANON_KEY")
        ?? required("STAGING_SUPABASE_PUBLISHABLE_KEY"),
      secretKey: optional("STAGING_SUPABASE_SECRET_KEY", "STAGING_SUPABASE_SERVICE_ROLE_KEY")
        ?? required("STAGING_SUPABASE_SECRET_KEY"),
      databaseUrl: required("STAGING_DATABASE_URL"),
      apiBaseUrl: optional("RECIPE_INVITE_SMOKE_API_BASE_URL", "STAGING_API_BASE_URL"),
      sourceUrl: `https://staging-smoke.example.test/recipe-invites/${runId}`,
    };
  }

  const confirm = process.env.RECIPE_INVITE_SMOKE_CONFIRM?.trim();
  if (confirm !== "rezepti-production") {
    throw new Error("Production smoke requires RECIPE_INVITE_SMOKE_CONFIRM=rezepti-production.");
  }

  return {
    target,
    label: "Production",
    supabaseUrl: optional("PRODUCTION_SUPABASE_URL", "SUPABASE_URL")
      ?? required("PRODUCTION_SUPABASE_URL"),
    publishableKey: optional(
      "PRODUCTION_SUPABASE_PUBLISHABLE_KEY",
      "PRODUCTION_SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
    ) ?? required("PRODUCTION_SUPABASE_PUBLISHABLE_KEY"),
    secretKey: optional(
      "PRODUCTION_SUPABASE_SECRET_KEY",
      "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ) ?? required("PRODUCTION_SUPABASE_SECRET_KEY"),
    databaseUrl: optional("PRODUCTION_DATABASE_URL", "DATABASE_URL")
      ?? required("PRODUCTION_DATABASE_URL"),
    apiBaseUrl: optional(
      "RECIPE_INVITE_SMOKE_API_BASE_URL",
      "PRODUCTION_API_BASE_URL",
      "BASE_URL",
    ) ?? "https://p01--rezepti-app--2s7hvlwm5zc5.code.run",
    sourceUrl: `https://production-smoke.example.test/recipe-invites/${runId}`,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function assertOk(response: Response, label: string) {
  if (response.ok) return readJson(response);
  throw new Error(`${label} failed: ${response.status} ${JSON.stringify(await readJson(response))}`);
}

async function signIn(supabaseUrl: string, publishableKey: string, email: string) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Could not sign in ${email}: ${error?.message ?? "missing session"}`);
  }
  return data.session.access_token;
}

async function main() {
  const config = readConfig();

  process.env.DATABASE_URL = config.databaseUrl;
  process.env.SUPABASE_URL = config.supabaseUrl;
  process.env.SUPABASE_PUBLISHABLE_KEY = config.publishableKey;

  const app = config.apiBaseUrl ? null : (await import("../../src/api-react.js")).default;
  const request = (path: string, init?: RequestInit) => {
    if (config.apiBaseUrl) {
      return fetch(new URL(path, config.apiBaseUrl), init);
    }
    return app!.request(path, init);
  };

  const admin = createClient(config.supabaseUrl, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(config.databaseUrl, { ssl: "require", prepare: false, max: 1 });

  try {
    for (const email of [userAEmail, userBEmail]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Could not create staging smoke user ${email}: ${error?.message ?? "missing user"}`);
      }
      createdUserIds.push(data.user.id);
    }

    const [userAId, userBId] = createdUserIds;
    const tokenA = await signIn(config.supabaseUrl, config.publishableKey, userAEmail);
    const tokenB = await signIn(config.supabaseUrl, config.publishableKey, userBEmail);

    const bootstrapA = await assertOk(
      await request("/api/v1/auth/bootstrap", { method: "POST", headers: authHeaders(tokenA) }),
      "bootstrap user A",
    );
    await assertOk(
      await request("/api/v1/auth/bootstrap", { method: "POST", headers: authHeaders(tokenB) }),
      "bootstrap user B",
    );

    const householdId = bootstrapA.workspace?.id;
    assert(typeof householdId === "string" && householdId.length > 0, "bootstrap did not return user A workspace id");

    const createRecipe = await assertOk(
      await request("/api/v1/recipes", {
        method: "POST",
        headers: authHeaders(tokenA),
        body: JSON.stringify({
          sourceUrl: config.sourceUrl,
          recipe: {
            name: `Invite Smoke ${runId}`,
            emoji: "🍝",
            tags: ["smoke"],
            ingredients: ["100 g Pasta"],
            steps: ["Kochen"],
          },
        }),
      }),
      "create private recipe",
    );
    const privateRecipeId = Number(createRecipe.id);
    assert(Number.isInteger(privateRecipeId), "create recipe did not return an integer id");
    createdRecipeIds.push(privateRecipeId);

    const createCollection = await assertOk(
      await request("/api/v1/recipe-collections", {
        method: "POST",
        headers: authHeaders(tokenA),
        body: JSON.stringify({
          name: `Household Smoke ${runId}`,
          ownerType: "household",
          householdId,
        }),
      }),
      "create household collection",
    );
    const collectionId = createCollection.collection?.id;
    assert(typeof collectionId === "string" && collectionId.length > 0, "collection create did not return id");
    createdCollectionIds.push(collectionId);

    const addToHousehold = await assertOk(
      await request(`/api/v1/recipe-collections/${collectionId}/items`, {
        method: "POST",
        headers: authHeaders(tokenA),
        body: JSON.stringify({ recipeId: privateRecipeId }),
      }),
      "add private recipe to household collection",
    );
    assert(addToHousehold.copied === true, "household collection add did not report copied=true");
    assert(addToHousehold.recipeId !== privateRecipeId, "household collection add reused the private recipe id");
    createdRecipeIds.push(Number(addToHousehold.recipeId));

    const invite = await assertOk(
      await request(`/api/v1/recipes/${privateRecipeId}/share-invites`, {
        method: "POST",
        headers: authHeaders(tokenA),
        body: JSON.stringify({ email: userBEmail }),
      }),
      "create recipe share invite",
    );
    const token = invite.invite?.token;
    assert(typeof token === "string" && token.length > 20, "invite create did not return token");

    const preview = await assertOk(
      await request(`/api/v1/share-invites/${encodeURIComponent(token)}`),
      "fetch invite preview",
    );
    assert(preview.invite?.status === "pending", "invite preview is not pending");
    assert(preview.invite?.recipientEmail === userBEmail, "invite preview recipient mismatch");

    const mismatch = await request(`/api/v1/share-invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      headers: authHeaders(tokenA),
    });
    assert(mismatch.status === 403, `accept with sender should return 403, got ${mismatch.status}`);

    const accepted = await assertOk(
      await request(`/api/v1/share-invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: authHeaders(tokenB),
      }),
      "accept invite as recipient",
    );
    assert(accepted.status === "accepted", "accept response status mismatch");
    const acceptedRecipeId = Number(accepted.recipe?.id);
    assert(Number.isInteger(acceptedRecipeId), "accept did not return copied recipe id");
    assert(acceptedRecipeId !== privateRecipeId, "accept reused source recipe id");
    createdRecipeIds.push(acceptedRecipeId);

    const acceptedDetail = await assertOk(
      await request(`/api/v1/recipes/${acceptedRecipeId}`, { headers: authHeaders(tokenB) }),
      "fetch accepted private copy",
    );
    assert(acceptedDetail.scope === "private", "accepted recipe copy is not private");

    const acceptedAgain = await assertOk(
      await request(`/api/v1/share-invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: authHeaders(tokenB),
      }),
      "accept invite again",
    );
    assert(acceptedAgain.alreadyAccepted === true, "second accept did not report alreadyAccepted=true");
    assert(Number(acceptedAgain.recipe?.id) === acceptedRecipeId, "second accept returned a different recipe id");

    console.log(`${config.label} recipe invite smoke passed:`);
    console.log("- private recipe added to household collection as household copy");
    console.log("- email-bound invite preview works");
    console.log("- wrong account cannot accept invite");
    console.log("- recipient accepts invite as private copy");
    console.log("- repeated accept is idempotent");

    // Keep user variables referenced for type-safety and easier debugging.
    assert(userAId && userBId, "created users missing");
  } finally {
    try {
      if (createdCollectionIds.length > 0) {
        await sql`delete from recipe_collection_items where collection_id = any(${createdCollectionIds})`;
        await sql`delete from recipe_collections where id = any(${createdCollectionIds})`;
      }
      if (createdRecipeIds.length > 0) {
        await sql`delete from recipe_share_invites where accepted_recipe_id = any(${createdRecipeIds}) or source_recipe_id = any(${createdRecipeIds})`;
        await sql`delete from recipes where id = any(${createdRecipeIds})`;
      }
      if (createdUserIds.length > 0) {
        await sql`delete from recipe_share_invites where sender_user_id = any(${createdUserIds}) or accepted_by_user_id = any(${createdUserIds})`;
        await sql`delete from user_default_households where user_id = any(${createdUserIds})`;
        await sql`delete from household_memberships where user_id = any(${createdUserIds})`;
        await sql`delete from households where created_by = any(${createdUserIds})`;
        await sql`delete from user_profiles where user_id = any(${createdUserIds})`;
      }
    } finally {
      await sql.end({ timeout: 5 });
      await Promise.all(createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId)));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
