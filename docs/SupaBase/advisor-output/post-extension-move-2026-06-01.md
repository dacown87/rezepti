# Supabase Advisor Check After Extension Move

Stand: 2026-06-01

## Production Change

Executed against production:

- `create schema if not exists extensions;`
- `alter extension vector set schema extensions;`
- `alter extension pg_trgm set schema extensions;`
- `grant usage on schema extensions to anon, authenticated, service_role;`

Verification:

```text
 extname |   schema
---------+------------
 pg_trgm | extensions
 vector  | extensions
```

Runtime smoke:

- `pages` search-vector trigger passed.
- `content_chunks` search-vector trigger passed.
- `extensions.vector_dims('[1,2,3]'::extensions.vector)` passed.
- `pg_trgm` `%` operator passed.
- Smoke transaction ended with `ROLLBACK`.

Runtime output:

```text
NOTICE: prod_extension_runtime_smoke_ok page_id=61 chunk_id=333
DO
ROLLBACK
```

## Advisor Result

Commands:

```bash
npx supabase db advisors --db-url "$DATABASE_URL" --type security --level warn --fail-on none --output-format json
npx supabase db advisors --db-url "$DATABASE_URL" --type performance --level warn --fail-on none --output-format json
```

Results:

- Security Advisor WARN+: `No issues found`
- Performance Advisor WARN+: `No issues found`

Note: Supabase CLI reported `v2.103.0` available while local CLI is
`v2.102.0`; this did not block the advisor checks.
