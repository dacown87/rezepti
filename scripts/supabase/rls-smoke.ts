import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

type SupabaseStatus = {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};

type ShoppingRow = {
  id: number;
  household_id: string;
  user_id: string;
  canonical_name: string;
  quantity: string | null;
};

type MealPlanRow = {
  id: number;
  household_id: string;
  user_id: string;
  recipe_id: number;
  week_start: number;
};

const password = "RlsSmoke-2026-Local-Only!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userAEmail = `rls-smoke-a-${runId}@example.test`;
const userBEmail = `rls-smoke-b-${runId}@example.test`;

const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

function readLocalStatus(): SupabaseStatus {
  let raw: string;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      "Local Supabase is not running. Start it with `npx supabase start`, then run `npm run supabase:rls-smoke`.",
      { cause: error },
    );
  }

  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("Could not parse `supabase status -o json` output.");
  }

  const status = JSON.parse(raw.slice(jsonStart)) as Partial<SupabaseStatus>;
  if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error("Supabase status is missing API_URL, ANON_KEY, or SERVICE_ROLE_KEY.");
  }

  return {
    API_URL: status.API_URL,
    ANON_KEY: status.ANON_KEY,
    SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createConfirmedUser(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Could not create auth user ${email}: ${error?.message ?? "missing user"}`);
  }

  createdUserIds.push(data.user.id);
  return data.user;
}

async function signIn(url: string, anonKey: string, email: string) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Could not sign in ${email}: ${error.message}`);
  }

  return client;
}

async function insertHousehold(admin: SupabaseClient, name: string, createdBy: string) {
  const { data, error } = await admin
    .from("households")
    .insert({ name, created_by: createdBy })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not create household ${name}: ${error?.message ?? "missing row"}`);
  }

  createdHouseholdIds.push(data.id);
  return data.id as string;
}

async function insertMembership(admin: SupabaseClient, householdId: string, userId: string, role: "owner" | "member") {
  const { error } = await admin
    .from("household_memberships")
    .insert({ household_id: householdId, user_id: userId, role });

  if (error) {
    throw new Error(`Could not create membership ${householdId}/${userId}: ${error.message}`);
  }
}

async function bootstrap(admin: SupabaseClient) {
  const userA = await createConfirmedUser(admin, userAEmail);
  const userB = await createConfirmedUser(admin, userBEmail);

  await admin.from("user_profiles").upsert([
    { user_id: userA.id, email: userA.email, app_role: "admin" },
    { user_id: userB.id, email: userB.email, app_role: "user" },
  ]);

  const householdA = await insertHousehold(admin, `RLS Smoke A ${runId}`, userA.id);
  const householdB = await insertHousehold(admin, `RLS Smoke B ${runId}`, userB.id);
  const sharedHousehold = await insertHousehold(admin, `RLS Smoke Shared ${runId}`, userA.id);

  await insertMembership(admin, householdA, userA.id, "owner");
  await insertMembership(admin, householdB, userB.id, "owner");
  await insertMembership(admin, sharedHousehold, userA.id, "owner");
  await insertMembership(admin, sharedHousehold, userB.id, "member");

  return { userA, userB, householdA, householdB, sharedHousehold };
}

async function expectAnonBlocked(anon: SupabaseClient) {
  const { data, error } = await anon.from("shopping_list").select("id").limit(1);
  assert(error || (data?.length ?? 0) === 0, "anon unexpectedly read shopping_list rows");
}

async function expectRecipesClosed(userClient: SupabaseClient) {
  const { error } = await userClient.from("recipes").select("id").limit(1);
  assert(error, "authenticated user unexpectedly accessed recipes through the Data API");
}

async function runShoppingChecks(
  userAClient: SupabaseClient,
  userBClient: SupabaseClient,
  ids: Awaited<ReturnType<typeof bootstrap>>,
) {
  const marker = `RLS smoke shopping ${runId}`;
  const { data: inserted, error: insertError } = await userAClient
    .from("shopping_list")
    .insert({
      household_id: ids.householdA,
      user_id: ids.userA.id,
      canonical_name: marker,
      quantity: "1",
      unit: "test",
    })
    .select("id, household_id, user_id, canonical_name, quantity")
    .single<ShoppingRow>();

  assert(!insertError && inserted, `User A could not insert own shopping row: ${insertError?.message}`);

  const { data: ownRows, error: ownReadError } = await userAClient
    .from("shopping_list")
    .select("id")
    .eq("household_id", ids.householdA)
    .eq("canonical_name", marker);

  assert(!ownReadError && ownRows?.length === 1, `User A could not read own shopping row: ${ownReadError?.message}`);

  const { data: crossRows, error: crossReadError } = await userBClient
    .from("shopping_list")
    .select("id")
    .eq("household_id", ids.householdA)
    .eq("canonical_name", marker);

  assert(!crossReadError && crossRows?.length === 0, "User B read User A household shopping row");

  const { error: crossUpdateError } = await userBClient
    .from("shopping_list")
    .update({ quantity: "99" })
    .eq("id", inserted.id);

  assert(!crossUpdateError, `Cross-household update should be filtered, not error: ${crossUpdateError?.message}`);

  const { data: afterCrossUpdate, error: verifyError } = await userAClient
    .from("shopping_list")
    .select("quantity")
    .eq("id", inserted.id)
    .single<Pick<ShoppingRow, "quantity">>();

  assert(!verifyError && afterCrossUpdate?.quantity === "1", "User B changed User A shopping row");

  const { error: ownUpdateError } = await userAClient
    .from("shopping_list")
    .update({ quantity: "2" })
    .eq("id", inserted.id);

  assert(!ownUpdateError, `User A could not update own shopping row: ${ownUpdateError?.message}`);

  const { data: sharedInsert, error: sharedInsertError } = await userAClient
    .from("shopping_list")
    .insert({
      household_id: ids.sharedHousehold,
      user_id: ids.userA.id,
      canonical_name: `${marker} shared`,
    })
    .select("id")
    .single<Pick<ShoppingRow, "id">>();

  assert(!sharedInsertError && sharedInsert, `User A could not insert shared shopping row: ${sharedInsertError?.message}`);

  const { data: sharedRows, error: sharedReadError } = await userBClient
    .from("shopping_list")
    .select("id")
    .eq("id", sharedInsert.id);

  assert(!sharedReadError && sharedRows?.length === 1, "User B could not read shared household shopping row");

  const { error: ownDeleteError } = await userAClient
    .from("shopping_list")
    .delete()
    .eq("id", inserted.id);

  assert(!ownDeleteError, `User A could not delete own shopping row: ${ownDeleteError?.message}`);
}

async function runPlannerChecks(
  userAClient: SupabaseClient,
  userBClient: SupabaseClient,
  ids: Awaited<ReturnType<typeof bootstrap>>,
) {
  const weekStart = 1810000000;
  const { data: inserted, error: insertError } = await userAClient
    .from("meal_plan")
    .insert({
      household_id: ids.householdA,
      user_id: ids.userA.id,
      recipe_id: 123456,
      day_of_week: 2,
      week_start: weekStart,
    })
    .select("id, household_id, user_id, recipe_id, week_start")
    .single<MealPlanRow>();

  assert(!insertError && inserted, `User A could not insert own planner row: ${insertError?.message}`);

  const { data: ownRows, error: ownReadError } = await userAClient
    .from("meal_plan")
    .select("id")
    .eq("household_id", ids.householdA)
    .eq("week_start", weekStart);

  assert(!ownReadError && ownRows?.length === 1, `User A could not read own planner row: ${ownReadError?.message}`);

  const { data: crossRows, error: crossReadError } = await userBClient
    .from("meal_plan")
    .select("id")
    .eq("household_id", ids.householdA)
    .eq("week_start", weekStart);

  assert(!crossReadError && crossRows?.length === 0, "User B read User A household planner row");

  const { error: crossDeleteError } = await userBClient
    .from("meal_plan")
    .delete()
    .eq("id", inserted.id);

  assert(!crossDeleteError, `Cross-household delete should be filtered, not error: ${crossDeleteError?.message}`);

  const { data: afterCrossDelete, error: verifyError } = await userAClient
    .from("meal_plan")
    .select("id")
    .eq("id", inserted.id);

  assert(!verifyError && afterCrossDelete?.length === 1, "User B deleted User A planner row");

  const { error: ownUpdateError } = await userAClient
    .from("meal_plan")
    .update({ day_of_week: 3 })
    .eq("id", inserted.id);

  assert(!ownUpdateError, `User A could not update own planner row: ${ownUpdateError?.message}`);

  const { data: sharedInsert, error: sharedInsertError } = await userAClient
    .from("meal_plan")
    .insert({
      household_id: ids.sharedHousehold,
      user_id: ids.userA.id,
      recipe_id: 654321,
      day_of_week: 4,
      week_start: weekStart,
    })
    .select("id")
    .single<Pick<MealPlanRow, "id">>();

  assert(!sharedInsertError && sharedInsert, `User A could not insert shared planner row: ${sharedInsertError?.message}`);

  const { data: sharedRows, error: sharedReadError } = await userBClient
    .from("meal_plan")
    .select("id")
    .eq("id", sharedInsert.id);

  assert(!sharedReadError && sharedRows?.length === 1, "User B could not read shared household planner row");

  const { error: ownDeleteError } = await userAClient
    .from("meal_plan")
    .delete()
    .eq("id", inserted.id);

  assert(!ownDeleteError, `User A could not delete own planner row: ${ownDeleteError?.message}`);
}

async function cleanup(admin: SupabaseClient) {
  if (createdHouseholdIds.length > 0) {
    await admin.from("meal_plan").delete().in("household_id", createdHouseholdIds);
    await admin.from("shopping_list").delete().in("household_id", createdHouseholdIds);
    await admin.from("household_memberships").delete().in("household_id", createdHouseholdIds);
    await admin.from("households").delete().in("id", createdHouseholdIds);
  }

  if (createdUserIds.length > 0) {
    await admin.from("user_profiles").delete().in("user_id", createdUserIds);
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

async function main() {
  const status = readLocalStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(status.API_URL, status.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const ids = await bootstrap(admin);
    const userAClient = await signIn(status.API_URL, status.ANON_KEY, userAEmail);
    const userBClient = await signIn(status.API_URL, status.ANON_KEY, userBEmail);

    await expectAnonBlocked(anon);
    await expectRecipesClosed(userAClient);
    await runShoppingChecks(userAClient, userBClient, ids);
    await runPlannerChecks(userAClient, userBClient, ids);

    console.log("Supabase local RLS smoke passed:");
    console.log(`- anon cannot read shopping_list`);
    console.log(`- authenticated users cannot access recipes through the Data API`);
    console.log(`- User A can CRUD own household shopping/planner rows`);
    console.log(`- User B cannot read/update/delete User A household rows`);
    console.log(`- shared household rows are visible to both members`);
  } finally {
    await cleanup(admin);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
