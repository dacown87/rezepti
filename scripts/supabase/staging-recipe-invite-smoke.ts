// Smoke test for the recipe-invite flow: ownership boundaries, idempotent
// accept, and household-collection copy semantics against a real Supabase +
// Postgres target (staging or production).
//
// This does NOT validate email deliverability. Three reasons: (1) recipients
// are `@example.test` addresses — a reserved, non-deliverable TLD, so no
// inbox can ever receive them and a provider rejection proves nothing about
// mail config; (2) the script does not read or report the `delivery` field
// that `POST /api/v1/recipes/:id/share-invites` returns; (3) without
// `RECIPE_INVITE_SMOKE_API_BASE_URL` set, requests run in-process against the
// LOCAL build and LOCAL env, never the deployed server. See the mode banner
// printed at startup and the delivery output near invite creation below.

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const password = "RecipeInviteSmoke-2026!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userAEmail = `recipe-invite-a-${runId}@example.test`;
const userBEmail = `recipe-invite-b-${runId}@example.test`;
const userCEmail = `recipe-invite-c-${runId}@example.test`;

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

  console.log("========================================================");
  console.log(`EXECUTION MODE: ${config.label} (target=${config.target})`);
  if (config.apiBaseUrl) {
    console.log(`Requests go over HTTP to: ${config.apiBaseUrl}`);
  } else {
    console.log("Requests run IN-PROCESS (no HTTP, no base URL configured).");
    console.log("This exercises the LOCAL build with the LOCAL environment.");
    console.log("The deployed server is NOT exercised by this run.");
  }
  console.log("========================================================");

  if (config.target === "production" && !config.apiBaseUrl) {
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.log("! WARNING: production target without an API base URL. !");
    console.log("! The deployed production server is NOT being tested. !");
    console.log("! Only the production DATABASE is touched directly.   !");
    console.log("! Mail configuration (Brevo etc.) is read from the    !");
    console.log("! LOCAL environment, not from the deployed service.   !");
    console.log("! Set RECIPE_INVITE_SMOKE_API_BASE_URL to actually    !");
    console.log("! exercise the deployed server and its real config.   !");
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  }

  const admin = createClient(config.supabaseUrl, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(config.databaseUrl, { ssl: "require", prepare: false, max: 1 });

  try {
    for (const email of [userAEmail, userBEmail, userCEmail]) {
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

    const [userAId, userBId, userCId] = createdUserIds;
    const tokenA = await signIn(config.supabaseUrl, config.publishableKey, userAEmail);
    const tokenB = await signIn(config.supabaseUrl, config.publishableKey, userBEmail);
    const tokenC = await signIn(config.supabaseUrl, config.publishableKey, userCEmail);

    const bootstrapA = await assertOk(
      await request("/api/v1/auth/bootstrap", { method: "POST", headers: authHeaders(tokenA) }),
      "bootstrap user A",
    );
    await assertOk(
      await request("/api/v1/auth/bootstrap", { method: "POST", headers: authHeaders(tokenB) }),
      "bootstrap user B",
    );
    await assertOk(
      await request("/api/v1/auth/bootstrap", { method: "POST", headers: authHeaders(tokenC) }),
      "bootstrap user C",
    );

    const householdId = bootstrapA.workspace?.id;
    assert(typeof householdId === "string" && householdId.length > 0, "bootstrap did not return user A workspace id");

    const [targetHousehold] = await sql<{ id: string }[]>`
      insert into households (name, created_by)
      values (${`Target household ${runId}`}, ${userAId})
      returning id
    `;
    assert(targetHousehold?.id, "could not create second household");
    await sql`
      insert into household_memberships (household_id, user_id, role)
      values
        (${targetHousehold.id}, ${userAId}, 'owner'),
        (${targetHousehold.id}, ${userCId}, 'member')
    `;

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

    const shareToSecondHousehold = await assertOk(
      await request(`/api/v1/recipes/${privateRecipeId}/share`, {
        method: "POST",
        headers: authHeaders(tokenA),
        body: JSON.stringify({ target: { type: "household", householdId: targetHousehold.id } }),
      }),
      "copy private recipe to selected second household",
    );
    const secondHouseholdRecipeId = Number(shareToSecondHousehold.recipe?.id);
    assert(Number.isInteger(secondHouseholdRecipeId), "selected household copy did not return an integer id");
    createdRecipeIds.push(secondHouseholdRecipeId);

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

    const createTargetCollection = await assertOk(
      await request("/api/v1/recipe-collections", {
        method: "POST",
        headers: authHeaders(tokenA),
        body: JSON.stringify({
          name: `Target Household Smoke ${runId}`,
          ownerType: "household",
          householdId: targetHousehold.id,
        }),
      }),
      "create selected household collection",
    );
    const targetCollectionId = createTargetCollection.collection?.id;
    assert(typeof targetCollectionId === "string" && targetCollectionId.length > 0, "target collection create did not return id");
    createdCollectionIds.push(targetCollectionId);

    const targetCollections = await assertOk(
      await request(`/api/v1/recipe-collections?ownerType=household&householdId=${encodeURIComponent(targetHousehold.id)}`, {
        headers: authHeaders(tokenA),
      }),
      "filter collections by selected household",
    );
    assert(targetCollections.collections.some((collection: { id?: string }) => collection.id === targetCollectionId), "target household collection is missing from filtered list");

    const mismatchedTarget = await request(`/api/v1/recipe-collections/${collectionId}/items`, {
      method: "POST",
      headers: authHeaders(tokenA),
      body: JSON.stringify({ recipeId: privateRecipeId, targetHouseholdId: targetHousehold.id }),
    });
    assert(mismatchedTarget.status === 400, `mismatched target household should return 400, got ${mismatchedTarget.status}`);

    const memberAddsItem = await assertOk(
      await request(`/api/v1/recipe-collections/${targetCollectionId}/items`, {
        method: "POST",
        headers: authHeaders(tokenC),
        body: JSON.stringify({ recipeId: secondHouseholdRecipeId, targetHouseholdId: targetHousehold.id }),
      }),
      "member adds household collection item",
    );
    assert(memberAddsItem.added === true, "member could not add household collection item");

    const memberRenamesCollection = await request(`/api/v1/recipe-collections/${targetCollectionId}`, {
      method: "PATCH",
      headers: authHeaders(tokenC),
      body: JSON.stringify({ name: "Member must not rename" }),
    });
    assert(memberRenamesCollection.status === 404, `member rename should return 404, got ${memberRenamesCollection.status}`);

    const memberReorder = await assertOk(
      await request(`/api/v1/recipe-collections/${targetCollectionId}/items/reorder`, {
        method: "PATCH",
        headers: authHeaders(tokenC),
        body: JSON.stringify({ recipeIds: [secondHouseholdRecipeId] }),
      }),
      "member reorders household collection item",
    );
    assert(memberReorder.succeeded?.[0]?.recipeId === secondHouseholdRecipeId, "member reorder did not succeed");

    const createPrivateRecipe = async (suffix: string) => {
      const response = await assertOk(
        await request("/api/v1/recipes", {
          method: "POST",
          headers: authHeaders(tokenA),
          body: JSON.stringify({
            sourceUrl: `${config.sourceUrl}/${suffix}`,
            recipe: { name: `Collection Smoke ${suffix} ${runId}`, emoji: "🍲", tags: ["smoke"], ingredients: ["1 item"], steps: ["Testen"] },
          }),
        }),
        `create private collection recipe ${suffix}`,
      );
      const id = Number(response.id);
      assert(Number.isInteger(id), `private collection recipe ${suffix} did not return an integer id`);
      createdRecipeIds.push(id);
      return id;
    };
    const bulkRecipeIds = await Promise.all(["one", "two", "three"].map(createPrivateRecipe));

    const createUserCollection = async (name: string) => {
      const response = await assertOk(
        await request("/api/v1/recipe-collections", {
          method: "POST",
          headers: authHeaders(tokenA),
          body: JSON.stringify({ name, ownerType: "user" }),
        }),
        `create user collection ${name}`,
      );
      const id = response.collection?.id;
      assert(typeof id === "string" && id.length > 0, `user collection ${name} did not return id`);
      createdCollectionIds.push(id);
      return id;
    };
    const sourceCollectionId = await createUserCollection(`Bulk Source ${runId}`);
    const destinationCollectionId = await createUserCollection(`Bulk Destination ${runId}`);
    for (const recipeId of bulkRecipeIds) {
      await assertOk(
        await request(`/api/v1/recipe-collections/${sourceCollectionId}/items`, {
          method: "POST", headers: authHeaders(tokenA), body: JSON.stringify({ recipeId }),
        }),
        `add recipe ${recipeId} to bulk source collection`,
      );
    }

    const reorderedIds = [bulkRecipeIds[2], bulkRecipeIds[0], bulkRecipeIds[1]];
    const reordered = await assertOk(
      await request(`/api/v1/recipe-collections/${sourceCollectionId}/items/reorder`, {
        method: "PATCH", headers: authHeaders(tokenA), body: JSON.stringify({ recipeIds: reorderedIds }),
      }),
      "reorder collection items",
    );
    assert(reordered.succeeded?.map((item: { recipeId: number }) => item.recipeId).join(",") === reorderedIds.join(","), "reorder response does not match requested order");

    const bulkCopied = await assertOk(
      await request(`/api/v1/recipe-collections/${sourceCollectionId}/items/bulk-copy`, {
        method: "POST", headers: authHeaders(tokenA), body: JSON.stringify({ targetCollectionId: destinationCollectionId, recipeIds: bulkRecipeIds }),
      }),
      "bulk copy collection items",
    );
    assert(bulkCopied.succeeded?.length === bulkRecipeIds.length && bulkCopied.failed?.length === 0, "bulk copy did not copy every selected item");

    const bulkRemoved = await assertOk(
      await request(`/api/v1/recipe-collections/${sourceCollectionId}/items/bulk-remove`, {
        method: "POST", headers: authHeaders(tokenA), body: JSON.stringify({ recipeIds: [bulkRecipeIds[0]] }),
      }),
      "bulk remove collection item",
    );
    assert(bulkRemoved.succeeded?.[0]?.recipeId === bulkRecipeIds[0], "bulk remove did not remove the selected membership");
    await assertOk(
      await request(`/api/v1/recipes/${bulkRecipeIds[0]}`, { headers: authHeaders(tokenA) }),
      "verify bulk remove did not delete recipe",
    );

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

    console.log("--------------------------------------------------------");
    console.log("INFORMATIONAL — mail delivery outcome (not asserted, not pass/fail):");
    console.log(`  status: ${invite.delivery?.status}`);
    console.log(`  provider: ${invite.delivery?.provider}`);
    console.log(`  errorCode: ${invite.delivery?.errorCode ?? "-"}`);
    console.log(`  Recipient (${userBEmail}) is an @example.test address, which cannot`);
    console.log("  receive real mail. A 'failed'/'provider_rejected' result here is");
    console.log("  expected and is NOT evidence of a mail configuration defect.");
    console.log("--------------------------------------------------------");

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
    console.log("- selected household copy/filter and target mismatch boundary work");
    console.log("- household members can mutate items but cannot manage collection metadata");
    console.log("- collection reorder, bulk copy, and bulk remove preserve recipe ownership");

    // Keep user variables referenced for type-safety and easier debugging.
    assert(userAId && userBId && userCId, "created users missing");
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
