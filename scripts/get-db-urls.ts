import postgres from "postgres";

const DB_URL = process.env.RECIPE_SOURCE_AUDIT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DB_URL) {
  throw new Error("RECIPE_SOURCE_AUDIT_DATABASE_URL or DATABASE_URL environment variable is required");
}

const sql = postgres(DB_URL);

const rows = await sql`
  SELECT source_url, name, created_at
  FROM recipes
  WHERE source_url IS NOT NULL
    AND source_url NOT LIKE '%youtube%'
    AND source_url NOT LIKE '%tiktok%'
    AND source_url NOT LIKE '%instagram%'
    AND source_url NOT LIKE '%facebook%'
    AND source_url LIKE 'http%'
  ORDER BY created_at DESC
  LIMIT 40
`;

console.log(`Found ${rows.length} web recipes in DB:\n`);
for (const r of rows) {
  const domain = new URL(r.source_url).hostname.replace("www.", "");
  console.log(`${domain.padEnd(35)} | ${r.name?.slice(0, 50) || "(no name)"}`);
  console.log(`  ${r.source_url}`);
}

await sql.end();
