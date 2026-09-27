// End-to-end check for Supabase Auth mail on production.
//
// Signs up a throwaway account on a plus-address of the operator mailbox
// (recipedeckapp+e2e-<timestamp>@gmail.com, lands in the same inbox), then
// reports what can be verified without reading the inbox:
//   1. Supabase accepted the signup and set confirmation_sent_at
//   2. Supabase auth logs show the mail being sent (Management API)
//   3. Brevo's transactional event log shows the message for that address
// Finally the throwaway user is deleted again (pass --keep to keep it, e.g. to
// click the confirmation link by hand; run with --cleanup later to remove all
// e2e users).
//
// Needs in .env: SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL,
// SUPABASE_ACCESS_TOKEN; optional BREVO_API_KEY.
// Guard: pass --confirm=rezepti-production (or AUTH_MAIL_E2E_CONFIRM).
//
//   npm run supabase:auth-mail-e2e -- --confirm=rezepti-production [--keep | --cleanup]
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const PROJECT_REF = "zdiqtnljdxuhinqzgcnd";
const MAILBOX_LOCAL = "recipedeckapp";
const MAILBOX_DOMAIN = "gmail.com";
const E2E_PREFIX = `${MAILBOX_LOCAL}+e2e-`;
const REDIRECT_TO = "https://www.recipedeckapp.de/account";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function deleteE2eUsers(databaseUrl: string, onlyEmail?: string): Promise<number> {
  const sql = postgres(databaseUrl, { ssl: "require", prepare: false, max: 1 });
  try {
    // Only ever touches addresses this script generates.
    const rows = onlyEmail
      ? await sql`delete from auth.users where email = ${onlyEmail} and email like ${E2E_PREFIX + "%"} returning id`
      : await sql`delete from auth.users where email like ${E2E_PREFIX + "%@" + MAILBOX_DOMAIN} returning id`;
    return rows.length;
  } finally {
    await sql.end();
  }
}

async function fetchAuthMailLogs(accessToken: string, email: string, since: Date): Promise<string[]> {
  // Since 2026-09-23 the Management API serves one `logs` table filtered by
  // `source` (the old logs.all endpoint is gone); retention is about a day.
  const safeEmail = email.replace(/'/g, "");
  const query =
    "select timestamp, event_message from logs where source = 'auth_logs' and (" +
    `event_message like '%${safeEmail}%' or event_message like '%/signup%' ` +
    "or event_message like '%mail%' or event_message like '%smtp%'" +
    ") order by timestamp desc limit 20";
  const params = new URLSearchParams({
    sql: query,
    iso_timestamp_start: since.toISOString(),
    iso_timestamp_end: new Date().toISOString(),
  });
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) return [`(auth logs unavailable: HTTP ${response.status} ${await response.text()})`];
  const body = (await response.json()) as { result?: Array<{ timestamp: number; event_message: string }> };
  return (body.result ?? []).map((row) => row.event_message);
}

async function fetchBrevoEvents(apiKey: string, email: string): Promise<string[]> {
  const params = new URLSearchParams({ email, limit: "20", days: "1" });
  const response = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?${params}`, {
    headers: { "api-key": apiKey, accept: "application/json" },
  });
  if (!response.ok) return [`(brevo events unavailable: HTTP ${response.status} ${await response.text()})`];
  const body = (await response.json()) as { events?: Array<{ event: string; date: string; subject?: string; from?: string }> };
  return (body.events ?? []).map((e) => `${e.date} ${e.event} from=${e.from ?? "?"} subject=${e.subject ?? "?"}`);
}

async function main() {
  const confirmed =
    process.argv.includes("--confirm=rezepti-production") ||
    process.env.AUTH_MAIL_E2E_CONFIRM === "rezepti-production";
  if (!confirmed) {
    throw new Error("Refusing to run against production: pass --confirm=rezepti-production");
  }
  const supabaseUrl = required("SUPABASE_URL");
  if (!supabaseUrl.includes(PROJECT_REF)) throw new Error(`SUPABASE_URL is not project ${PROJECT_REF}`);
  const databaseUrl = required("DATABASE_URL");

  if (process.argv.includes("--cleanup")) {
    console.log(`Deleted ${await deleteE2eUsers(databaseUrl)} e2e user(s).`);
    return;
  }

  const anonKey = required("SUPABASE_ANON_KEY");
  const accessToken = required("SUPABASE_ACCESS_TOKEN");
  const keep = process.argv.includes("--keep");
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
  const email = `${E2E_PREFIX}${stamp}@${MAILBOX_DOMAIN}`;
  const startedAt = new Date(Date.now() - 60_000);

  console.log(`Signing up ${email} (redirect ${REDIRECT_TO})`);
  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signUp({
    email,
    password: randomBytes(18).toString("base64url"),
    options: { emailRedirectTo: REDIRECT_TO },
  });
  if (error) throw new Error(`signUp failed: ${error.status} ${error.message}`);
  const confirmationSentAt = data.user?.confirmation_sent_at ?? null;
  console.log(`1. signUp ok, user ${data.user?.id?.slice(0, 8)}, confirmation_sent_at=${confirmationSentAt}`);

  try {
    console.log("   waiting 30 s for logs to arrive ...");
    await sleep(30_000);

    console.log("2. Supabase auth logs:");
    for (const line of await fetchAuthMailLogs(accessToken, email, startedAt)) console.log(`   ${line}`);

    const brevoKey = process.env.BREVO_API_KEY?.trim();
    console.log("3. Brevo events:");
    if (!brevoKey) console.log("   (BREVO_API_KEY not set, skipped)");
    else for (const line of await fetchBrevoEvents(brevoKey, email)) console.log(`   ${line}`);

    if (!confirmationSentAt) process.exitCode = 1;
  } finally {
    if (keep) {
      console.log(`Kept ${email}; remove later with --cleanup.`);
    } else {
      console.log(`Deleted ${await deleteE2eUsers(databaseUrl, email)} user(s).`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
