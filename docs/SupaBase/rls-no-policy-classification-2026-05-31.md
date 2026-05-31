# RLS Without Policy Classification

Stand: 2026-05-31

Source: `docs/SupaBase/security advisor info.md` plus DB preflight output
`docs/SupaBase/runbook-output/preflight-2026-05-31-184128.txt`.

## Decision

`rls_enabled_no_policy` remains intentional for this remediation pass. The
current product runtime uses a direct backend Postgres connection. Supabase Data
API access for `anon` and `authenticated` must stay closed until the separate
Multi-User/Auth track adds JWT validation, owner filters, backfills, and real
RLS policies.

The product tables already have no direct `anon`/`authenticated` table grants in
the final preflight. Several auxiliary/public tables still have broad Data API
grants and are therefore documented as a follow-up hardening/classification
track, not silently changed in this pass.

## Runtime Role

| Role | Finding | Action |
|---|---|---|
| direct DB backend role | `current_user = postgres`, `rolbypassrls = true` | Documented blast radius; app queries are not protected by RLS yet. |
| `anon` / `authenticated` | no product-table grants for `recipes`, `shopping_list`, `meal_plan`, `ingredient_dictionary`, `api_keys` | Keep Data API closed for product tables. |
| `service_role` | retains table/function access | Expected privileged Data API role; never expose to clients. |

## Product Tables

| Table | Classification | Access role | Action | Verification |
|---|---|---|---|---|
| `api_keys` | backend-only secret table | direct DB backend role | no policy now; no `anon`/`authenticated` table grants | final preflight table-grant check |
| `ingredient_dictionary` | backend-only app data | direct DB backend role | no policy now; no `anon`/`authenticated` table grants | final preflight table-grant check |
| `meal_plan` | backend-only now, future Data API | direct DB backend role | no policy now; keep Data API closed | final preflight table-grant check |
| `recipes` | backend-only now, future Data API | direct DB backend role | no policy now; keep Data API closed | final preflight table-grant check |
| `shopping_list` | backend-only now, future Data API | direct DB backend role | no policy now; keep Data API closed | final preflight table-grant check |

## Auxiliary Tables

These 47 tables are not part of Rezepti's current mobile/product Data API
surface. They remain RLS-without-policy in this pass and need an owner-specific
hardening decision before revoking grants or adding policies.

| Table | Classification | Access role | Action | Verification |
|---|---|---|---|---|
| `access_tokens` | auxiliary auth/token data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `budget_ledger` | auxiliary budget/agent data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `budget_reservations` | auxiliary budget/agent data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `calibration_profiles` | auxiliary evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `code_edges_chunk` | code graph data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `code_edges_symbol` | code graph data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `code_traversal_cache` | code graph cache | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `config` | auxiliary config data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `content_chunks` | knowledge/content graph data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `dream_verdicts` | auxiliary evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `drift_decisions` | auxiliary evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `eval_candidates` | evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `eval_capture_failures` | evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `eval_contradictions_cache` | evaluation cache | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `eval_contradictions_runs` | evaluation run data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `eval_takes_quality_runs` | evaluation run data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `facts` | knowledge graph data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `file_migration_ledger` | migration/ops data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `files` | file metadata | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `gbrain_cycle_locks` | gbrain coordination data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `ingest_log` | ingestion ops data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `links` | knowledge graph data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `mcp_request_log` | MCP telemetry/log data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `minion_attachments` | subagent/minion data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `minion_inbox` | subagent/minion data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `minion_jobs` | subagent/minion data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `oauth_clients` | auxiliary OAuth data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `oauth_codes` | auxiliary OAuth data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `oauth_tokens` | auxiliary OAuth data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `op_checkpoints` | ops/checkpoint data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `page_versions` | knowledge/page data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `pages` | knowledge/page data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `query_cache` | query cache | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `raw_data` | raw ingestion data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `search_telemetry` | telemetry data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `sources` | knowledge/source data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `subagent_messages` | subagent data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `subagent_rate_leases` | subagent rate-limit data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `subagent_tool_executions` | subagent tool data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `synthesis_evidence` | synthesis/evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `tags` | knowledge/page data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `take_grade_cache` | take/evaluation cache | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `take_nudge_log` | take/evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `take_proposals` | take/evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `takes` | take/evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `think_ab_results` | experiment/evaluation data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |
| `timeline_entries` | knowledge/page data | owner TBD | classify owner, then revoke or policy | final preflight shows current grants |

## Follow-Ups

- Run Supabase Security Advisor again and archive the new export under
  `docs/SupaBase/`.
- Classify owners for the auxiliary tables before grant revokes.
- Keep `vector`/`pg_trgm` extension moves and unused-index cleanup in their
  separate tracks.
