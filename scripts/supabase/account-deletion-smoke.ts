import "dotenv/config";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

/**
 * Proves that private.delete_user_account leaves nothing of a user behind.
 *
 * Seeds one row per user-related table for user A, a second user B whose data
 * must survive, and a pair that shares a household (deletion must be refused).
 * Then checks every column in `public` that can hold a user or household id, so
 * a new table that nobody taught the function about fails this script.
 *
 * Local by default. Staging only with SUPABASE_RLS_SMOKE_TARGET=staging and
 * SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging (same guard as rls-smoke.ts).
 */

const password = "AccountDelete-2026-Smoke-Only!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdUserIds: string[] = [];

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function readTarget() {
  const target = process.env.SUPABASE_RLS_SMOKE_TARGET?.trim() || "local";
  if (target === "staging") {
    if (process.env.SUPABASE_RLS_SMOKE_CONFIRM?.trim() !== "rezepti-staging") {
      fail("Refusing to run against staging without SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging.");
    }
    const apiUrl = process.env.STAGING_SUPABASE_URL?.trim();
    const serviceKey = (process.env.STAGING_SUPABASE_SECRET_KEY ?? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY)?.trim();
    const dbUrl = process.env.STAGING_DATABASE_URL?.trim();
    if (!apiUrl || !serviceKey || !dbUrl) {
      fail("STAGING_SUPABASE_URL, STAGING_SUPABASE_SECRET_KEY and STAGING_DATABASE_URL are required.");
    }
    if (/prod|production/i.test(apiUrl)) fail("Refusing: the staging URL looks like production.");
    return { apiUrl, serviceKey, dbUrl, ssl: "require" as const };
  }
  if (target !== "local") fail("SUPABASE_RLS_SMOKE_TARGET must be `local` or `staging`.");

  let raw: string;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error("Local Supabase is not running. Start it with `npx supabase start`.", { cause: error });
  }
  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as { API_URL?: string; SERVICE_ROLE_KEY?: string; DB_URL?: string };
  if (!status.API_URL || !status.SERVICE_ROLE_KEY || !status.DB_URL) {
    fail("Supabase status is missing API_URL, SERVICE_ROLE_KEY or DB_URL.");
  }
  return { apiUrl: status.API_URL, serviceKey: status.SERVICE_ROLE_KEY, dbUrl: status.DB_URL, ssl: false as const };
}

async function createUser(admin: SupabaseClient, label: string) {
  const email = `acct-delete-${label}-${runId}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) fail(`Could not create ${email}: ${error?.message ?? "missing user"}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

type Sql = postgres.Sql;

async function seedHousehold(sql: Sql, userId: string, name: string, role: "owner" | "member" = "owner", existing?: string) {
  const householdId =
    existing ??
    (await sql<{ id: string }[]>`insert into public.households (name, created_by) values (${name}, ${userId}) returning id`)[0].id;
  await sql`insert into public.user_profiles (user_id, email) values (${userId}, ${name + "@example.test"}) on conflict do nothing`;
  await sql`insert into public.household_memberships (household_id, user_id, role) values (${householdId}, ${userId}, ${role})`;
  return householdId;
}

/** One row in every user-related table. Returns ids the checks need. */
async function seedFullUser(sql: Sql, user: { id: string; email: string }, other: { id: string }, tag: string) {
  const householdId = await seedHousehold(sql, user.id, `${tag}-home`);
  await sql`insert into public.user_default_households (user_id, household_id) values (${user.id}, ${householdId})`;

  const [privateRecipe] = await sql<{ id: number }[]>`
    insert into public.recipes (name, ingredients, steps, owner_type, owner_user_id, created_by)
    values (${tag + " privat"}, '[]', '[]', 'user', ${user.id}, ${user.id}) returning id`;
  const [householdRecipe] = await sql<{ id: number }[]>`
    insert into public.recipes (name, ingredients, steps, owner_type, household_id, created_by)
    values (${tag + " haushalt"}, '[]', '[]', 'household', ${householdId}, ${user.id}) returning id`;

  await sql`insert into public.shopping_list (household_id, user_id, canonical_name) values (${householdId}, ${user.id}, ${tag})`;
  await sql`insert into public.meal_plan (household_id, user_id, recipe_id, day_of_week, week_start) values (${householdId}, ${user.id}, ${householdRecipe.id}, 1, 1)`;

  const [userCollection] = await sql<{ id: string }[]>`
    insert into public.recipe_collections (owner_type, owner_user_id, kind, name, created_by)
    values ('user', ${user.id}, 'custom', ${tag + " sammlung"}, ${user.id}) returning id`;
  await sql`insert into public.recipe_collection_items (collection_id, recipe_id, created_by) values (${userCollection.id}, ${privateRecipe.id}, ${user.id})`;
  await sql`insert into public.recipe_collections (owner_type, household_id, kind, name, created_by)
            values ('household', ${householdId}, 'custom', ${tag + " haushalts-sammlung"}, ${user.id})`;

  await sql`insert into public.cookidoo_credentials (scope_type, user_id, email, password, created_by) values ('user', ${user.id}, 'x@example.test', 'v1:enc', ${user.id})`;
  await sql`insert into public.cookidoo_credentials (scope_type, household_id, email, password, created_by) values ('household', ${householdId}, 'x@example.test', 'v1:enc', ${user.id})`;
  await sql`insert into public.push_subscriptions (user_id, endpoint, keys) values (${user.id}, ${"https://push.example.test/" + tag}, '{}')`;
  await sql`insert into public.byok_validation_rate_limits (user_id, key_hash, window_start) values (${user.id}, 'h', now())`;
  await sql`insert into public.bug_report_submission_rate_limits (user_id, window_start) values (${user.id}, now())`;
  await sql`insert into public.byok_validation_policies (singleton_key, window_minutes, max_requests, updated_by_user_id)
            values (${"smoke-" + tag}, 10, 10, ${user.id})`;

  // Invites: sent by the user, addressed to the user (by email), accepted by the user.
  const expires = new Date(Date.now() + 86_400_000);
  await sql`insert into public.recipe_share_invites (source_recipe_id, sender_user_id, recipient_email, token_hash, expires_at)
            values (${privateRecipe.id}, ${user.id}, 'someone@example.test', ${"sent-" + tag + runId}, ${expires})`;
  const [otherRecipe] = await sql<{ id: number }[]>`
    insert into public.recipes (name, ingredients, steps, owner_type, owner_user_id, created_by)
    values (${tag + " fremd"}, '[]', '[]', 'user', ${other.id}, ${other.id}) returning id`;
  await sql`insert into public.recipe_share_invites (source_recipe_id, sender_user_id, recipient_email, token_hash, expires_at)
            values (${otherRecipe.id}, ${other.id}, ${user.email}, ${"received-" + tag + runId}, ${expires})`;
  await sql`insert into public.recipe_share_invites (source_recipe_id, sender_user_id, recipient_email, token_hash, status, accepted_by_user_id, accepted_at, expires_at)
            values (${otherRecipe.id}, ${other.id}, 'accepted@example.test', ${"accepted-" + tag + runId}, 'accepted', ${user.id}, now(), ${expires})`;

  const [report] = await sql<{ id: string }[]>`
    insert into public.bug_reports (id, report_type, status, description, user_id, household_id, source_area)
    values (gen_random_uuid(), 'general', 'new', ${tag + " bug"}, ${user.id}, ${householdId}, 'global_button') returning id`;

  return { householdId, reportId: report.id, otherRecipeId: otherRecipe.id };
}

// Every public column that can hold a user id; each must be listed here.
const COVERED_USER_COLUMNS = new Set([
  "bug_report_submission_rate_limits.user_id",
  "bug_reports.user_id",
  "byok_validation_policies.updated_by_user_id",
  "byok_validation_rate_limits.user_id",
  "cookidoo_credentials.created_by",
  "cookidoo_credentials.user_id",
  "household_memberships.user_id",
  "households.created_by",
  "meal_plan.user_id",
  "push_subscriptions.user_id",
  "recipe_collection_items.created_by",
  "recipe_collections.created_by",
  "recipe_collections.owner_user_id",
  "recipe_share_invites.accepted_by_user_id",
  "recipe_share_invites.sender_user_id",
  "recipes.created_by",
  "recipes.owner_user_id",
  "shopping_list.user_id",
  "user_default_households.user_id",
  "user_profiles.user_id",
]);

async function discoverColumns(sql: Sql) {
  const rows = await sql<{ table_name: string; column_name: string }[]>`
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.data_type = 'uuid'
       and (c.column_name in ('user_id', 'created_by') or c.column_name like '%\\_user\\_id')
     order by 1, 2`;
  return rows.map((r) => ({ table: r.table_name, column: r.column_name }));
}

async function countReferences(sql: Sql, columns: Array<{ table: string; column: string }>, userId: string) {
  const left: string[] = [];
  for (const { table, column } of columns) {
    if (table === "bug_reports") continue; // checked separately: rows stay, links go
    const [row] = await sql.unsafe(`select count(*)::int as n from public."${table}" where "${column}" = $1`, [userId]);
    if (row.n > 0) left.push(`${table}.${column}=${row.n}`);
  }
  return left;
}

async function householdLeftovers(sql: Sql, householdId: string) {
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.columns where table_schema = 'public' and column_name = 'household_id'`;
  const left: string[] = [];
  for (const { table_name } of tables) {
    if (table_name === "bug_reports") continue;
    const [row] = await sql.unsafe(`select count(*)::int as n from public."${table_name}" where household_id = $1`, [householdId]);
    if (row.n > 0) left.push(`${table_name}.household_id=${row.n}`);
  }
  const [h] = await sql`select count(*)::int as n from public.households where id = ${householdId}`;
  if (h.n > 0) left.push("households.id");
  return left;
}

async function snapshot(sql: Sql, userId: string, householdId: string) {
  const [row] = await sql`
    select
      (select count(*) from public.recipes where owner_user_id = ${userId} or household_id = ${householdId})::int as recipes,
      (select count(*) from public.recipe_collections where owner_user_id = ${userId} or household_id = ${householdId})::int as collections,
      (select count(*) from public.cookidoo_credentials where user_id = ${userId} or household_id = ${householdId})::int as cookidoo,
      (select count(*) from public.push_subscriptions where user_id = ${userId})::int as push,
      (select count(*) from public.shopping_list where household_id = ${householdId})::int as shopping,
      (select count(*) from public.households where id = ${householdId})::int as households`;
  return row;
}

async function main() {
  const { apiUrl, serviceKey, dbUrl, ssl } = readTarget();
  const admin = createClient(apiUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const sql = postgres(dbUrl, { ssl, max: 1, onnotice: () => {} });

  try {
    const [a, b, c, d] = [
      await createUser(admin, "a"),
      await createUser(admin, "b"),
      await createUser(admin, "c"),
      await createUser(admin, "d"),
    ];

    // Completeness guard: a new user-id column nobody covered fails here.
    const columns = await discoverColumns(sql);
    const uncovered = columns.filter((col) => !COVERED_USER_COLUMNS.has(`${col.table}.${col.column}`));
    assert(
      uncovered.length === 0,
      `Columns with user ids not covered by this smoke or private.delete_user_account: ${uncovered.map((u) => `${u.table}.${u.column}`).join(", ")}. ` +
        "Teach the function about them, then add them to COVERED_USER_COLUMNS.",
    );

    const seededA = await seedFullUser(sql, a, b, "a");
    const seededB = await seedFullUser(sql, b, a, "b");
    const beforeB = await snapshot(sql, b.id, seededB.householdId);

    // 1. Refusal: user C and D share a household, deletion of C must change nothing.
    const sharedHousehold = await seedHousehold(sql, c.id, "shared");
    await seedHousehold(sql, d.id, "shared-d", "member", sharedHousehold);
    let refused = false;
    try {
      await sql`select private.delete_user_account(${c.id}::uuid)`;
    } catch (error) {
      refused = (error as { code?: string }).code === "RD409";
    }
    assert(refused, "Deleting a user who shares a household was not refused with RD409.");
    const [stillThere] = await sql`select (select count(*) from auth.users where id = ${c.id})::int as u, (select count(*) from public.households where id = ${sharedHousehold})::int as h`;
    assert(stillThere.u === 1 && stillThere.h === 1, "The refused deletion still removed data.");

    // 2. Deletion of A leaves nothing behind.
    const [{ result }] = await sql`select private.delete_user_account(${a.id}::uuid) as result`;
    const leftovers = [
      ...(await countReferences(sql, columns, a.id)),
      ...(await householdLeftovers(sql, seededA.householdId)),
    ];
    const [authLeft] = await sql`select count(*)::int as n from auth.users where id = ${a.id}`;
    if (authLeft.n > 0) leftovers.push("auth.users");
    const [invitesByEmail] = await sql`select count(*)::int as n from public.recipe_share_invites where lower(recipient_email) = ${a.email}`;
    if (invitesByEmail.n > 0) leftovers.push("recipe_share_invites.recipient_email");
    assert(leftovers.length === 0, `Rows left after deleting user A: ${leftovers.join(", ")}`);

    const [report] = await sql`select user_id, household_id, description from public.bug_reports where id = ${seededA.reportId}`;
    assert(report && report.user_id === null && report.household_id === null, "Bug report was not anonymised (or was deleted).");
    assert(report.description === "a bug", "Bug report content must be kept unchanged.");

    // 3. Everything of user B is untouched.
    const afterB = await snapshot(sql, b.id, seededB.householdId);
    assert(JSON.stringify(afterB) === JSON.stringify(beforeB), `User B's data changed: ${JSON.stringify(beforeB)} -> ${JSON.stringify(afterB)}`);
    const [bInvites] = await sql`select count(*)::int as n from public.recipe_share_invites where sender_user_id = ${b.id}`;
    // B's own invite stays; the two B sent to A went with A (addressed to / accepted by A).
    assert(bInvites.n === 1, `Expected exactly B's own sent invite to remain, found ${bInvites.n}.`);

    // 4. Idempotence of the contract: a second call reports user_not_found.
    let notFound = false;
    try {
      await sql`select private.delete_user_account(${a.id}::uuid)`;
    } catch (error) {
      notFound = (error as { code?: string }).code === "RD404";
    }
    assert(notFound, "Deleting an already deleted user did not raise RD404.");

    console.log("Account deletion smoke passed:");
    console.log(`- counts reported for user A: ${JSON.stringify(result)}`);
    console.log(`- no row references user A or A's household in ${columns.length} user columns`);
    console.log("- bug report anonymised, content kept");
    console.log("- user B's data untouched; shared household refused with RD409 and left intact");
  } finally {
    await sql`delete from public.byok_validation_policies where singleton_key like 'smoke-%'`.catch(() => {});
    await sql`delete from public.bug_reports where description in ('a bug', 'b bug')`.catch(() => {});
    // Clean up whatever is left of the seeded users (B, C, D and their households).
    for (const userId of createdUserIds) {
      await sql`select private.delete_user_account(${userId}::uuid)`.catch(() => {});
    }
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
    // The shared household survives its members (refusal case); once the users are
    // gone their memberships cascade, so it can be removed afterwards.
    await sql`delete from public.households h where h.name in ('shared', 'shared-d') and not exists (select 1 from public.household_memberships m where m.household_id = h.id)`.catch(() => {});
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
