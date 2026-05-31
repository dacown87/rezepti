<!-- /autoplan restore point: /home/patrick/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260531-083207.md -->
# Supabase Advisor Remediation Plan

Stand: 2026-05-31

## Completion Status

Die Kern-Remediation aus diesem Plan wurde am 2026-05-31 umgesetzt und
verifiziert:

- `function_search_path_mutable` wird im Advisor nicht mehr gemeldet.
- Die 5 fehlenden Foreign-Key-Indexes sind angelegt, valide und bereit.
- RLS-ohne-Policy ist fuer das aktuelle Backend-only/Data-API-closed Modell
  klassifiziert.
- Advisor-Exports liegen unter `docs/SupaBase/advisor-output/`.

Die verbleibenden Punkte `extension_in_public` und `unused_index` sind bewusst
ausgelagert nach
`docs/SupaBase/advisor-followups-2026-05-31.md`.

## Plan Summary

Dieser Plan behebt die echten Supabase-Advisor-Risiken, ohne die aktuell absichtliche Backend-only-Sicherheitsgrenze zu schwächen.

Wichtige Entscheidung aus `/autoplan`: `rls_enabled_no_policy` ist fuer Rezepti aktuell kein Fehler, der pauschal "weggefixt" werden soll. Das Projekt nutzt serverseitig `DATABASE_URL`/Drizzle und blockiert Supabase Data API Zugriff fuer `anon`/`authenticated` bewusst durch RLS ohne Policies plus entzogene Grants. Policies werden erst in der separaten Multi-User/Data-API-Phase real.

## Ausgangslage

Die Advisor Exports in diesem Ordner enthalten:

- `security advisor warnings.md`: 6 Security WARNs
- `security advisor info.md`: 52 Security INFOs
- `performance advisor info.md`: 88 Performance INFOs

Die wichtigsten Befunde:

- 4 Funktionen haben keinen festen `search_path`.
- 2 Extensions liegen im `public` Schema: `vector`, `pg_trgm`.
- 52 Tabellen haben RLS aktiv, aber keine Policies.
- 5 Foreign Keys haben keinen passenden Index.
- 83 Indexes wurden als ungenutzt gemeldet.

## Ziele

1. `function_search_path_mutable` WARNs beheben.
2. Fehlende Foreign-Key-Indexes nach Preflight sicher ergänzen.
3. RLS-ohne-Policy als bewusste Data-API-Sperre dokumentieren und mit Grants verifizieren.
4. Runtime-DB-Rolle und `BYPASSRLS`-Blast-Radius explizit auditieren.
5. Extension-Move und unused-index Cleanup nicht mit der Kern-Remediation vermischen.

## Nicht In Scope

- Keine pauschalen RLS-Policies, nur um Advisor INFOs verschwinden zu lassen.
- Kein Multi-User-Login in diesem Remediation-Pass.
- Kein Move von `vector`/`pg_trgm` ohne separates Dependency-Inventar.
- Kein Droppen von unused Indexes ohne Nutzungs- und Redundanznachweis.
- Kein Wechsel auf Supabase CLI Migration-Layout. Dieses Repo nutzt `db/migrations/YYYY-MM-DD-description.sql`.

## What Already Exists

- `src/db-react.ts` nutzt direkte Postgres-Verbindung aus `DATABASE_URL`.
- `db/migrations/2026-05-12-enable-rls.sql` aktiviert RLS auf den Rezepti-Produkt-Tabellen und entzieht `anon`/`authenticated` direkte Grants.
- `db/templates/public-multi-user-data-api-rls.sql` ist ein Draft fuer spaetere Multi-User/Data-API-Policies, aber keine aktive Migration.
- `docs/supabase-data-api-readiness.md` beschreibt bereits die Data-API-Readiness-Matrix.

## Access Model Vocabulary

- **Direct DB backend role**: Die Node/Hono-App verbindet sich per `DATABASE_URL` und Drizzle direkt mit Postgres. Wenn diese Rolle `postgres` oder `BYPASSRLS` hat, greift RLS fuer App-Queries nicht.
- **Supabase Data API `service_role`**: Supabase API-Key mit RLS-Bypass. Nicht gleichsetzen mit der direkten `DATABASE_URL` Rolle.
- **`anon` / `authenticated`**: PostgREST/Data-API-Rollen. Diese sollen bis zur Multi-User-Phase keinen direkten Zugriff auf Backend-only Tabellen haben.

## Execution Preconditions

- Aus Repo-Root ausfuehren: `/home/patrick/Projekte/rezepti`.
- Zielumgebung explizit festlegen: local, staging oder production.
- `DATABASE_URL` fuer die Ziel-DB setzen.
- SQL immer mit `ON_ERROR_STOP=1` laufen lassen.
- Vor produktiven DDL-Aenderungen Backup/Restore-Punkt der DB klaeren.
- Migrationen fuer dieses Repo unter `db/migrations/` anlegen, nicht mit `supabase migration new`.

Empfohlene Datei fuer die Kern-Remediation:

```text
db/migrations/2026-05-31-supabase-advisor-search-path-and-fk-indexes.sql
```

## Phase 1: Baseline und Preflight

### Advisor Baseline

- Aktuelle Advisor-Exports in `docs/SupaBase/` behalten.
- Nach jeder Fix-Welle neue Advisor-Ergebnisse daneben ablegen oder Datum im Dateinamen ergaenzen.

### Funktionssignaturen und aktueller `search_path`

```sql
select
  n.nspname as schema,
  p.oid::regprocedure as signature,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.proconfig,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname in (
    'auto_enable_rls',
    'notify_minion_job_change',
    'update_chunk_search_vector',
    'update_page_search_vector'
  )
order by p.proname;
```

### Runtime Rollen und Grants

```sql
select current_user, session_user;

select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname in (current_user, 'postgres', 'anon', 'authenticated', 'service_role');

select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;
```

Backend-only Tabellen muessen fuer `anon` und `authenticated` keine direkten Grants haben. Wenn Grants existieren, erst bewerten und dann gezielt entziehen.

Der Table-Grant-Check beweist nur Tabellenrechte. Fuer eine vollstaendige Data-API-Sperren-Dokumentation gehoeren zusaetzlich Schema-`USAGE`, Sequence-Rechte und `FUNCTION EXECUTE` fuer `anon`, `authenticated` und `service_role` in den Preflight. `docs/SupaBase/preflight.sql` gibt diese Privilegien deshalb separat aus; Revokes duerfen daraus erst nach Tabellen-/Funktionsklassifizierung abgeleitet werden.

### Foreign-Key- und Index-Preflight

```sql
select
  con.conname,
  con.conrelid::regclass as table_name,
  array_agg(att.attname order by ord.ordinality) as fk_columns
from pg_constraint con
join unnest(con.conkey) with ordinality as ord(attnum, ordinality) on true
join pg_attribute att
  on att.attrelid = con.conrelid
 and att.attnum = ord.attnum
where con.contype = 'f'
  and con.conname in (
    'code_edges_chunk_source_id_fkey',
    'facts_superseded_by_fkey',
    'oauth_codes_client_id_fkey',
    'subagent_rate_leases_owner_job_id_fkey',
    'take_nudge_log_source_id_fkey'
  )
group by con.conname, con.conrelid
order by con.conname;
```

Links fuehrende Index-Abdeckung pruefen:

```sql
select
  con.conname,
  con.conrelid::regclass as table_name,
  idx.indexrelid::regclass as index_name,
  idx.indisvalid,
  idx.indisready,
  idx.indkey::text as index_attnums,
  con.conkey::text as fk_attnums
from pg_constraint con
left join pg_index idx
  on idx.indrelid = con.conrelid
 and idx.indisvalid
 and idx.indisready
 and (idx.indkey::int2[])[0:array_length(con.conkey, 1) - 1] = con.conkey
where con.contype = 'f'
  and con.conname in (
    'code_edges_chunk_source_id_fkey',
    'facts_superseded_by_fkey',
    'oauth_codes_client_id_fkey',
    'subagent_rate_leases_owner_job_id_fkey',
    'take_nudge_log_source_id_fkey'
  )
order by con.conname, index_name;
```

## Phase 2: Function `search_path` Fix

Betroffene Funktionen:

- `public.auto_enable_rls`
- `public.notify_minion_job_change`
- `public.update_chunk_search_vector`
- `public.update_page_search_vector`

SQL nur nach Signatur-Preflight ausfuehren. Wenn Funktionen Argumente haben, muss die Signatur angepasst werden.

```sql
alter function public.auto_enable_rls() set search_path = public, pg_temp;
alter function public.notify_minion_job_change() set search_path = public, pg_temp;
alter function public.update_chunk_search_vector() set search_path = public, pg_temp;
alter function public.update_page_search_vector() set search_path = public, pg_temp;
```

Falls `vector`/`pg_trgm` spaeter in ein `extensions` Schema verschoben werden, muss der `search_path` fuer abhaengige Funktionen erneut bewertet werden. Dann kann `public, extensions, pg_temp` noetig sein, oder die Funktionen muessen Objekte qualifiziert referenzieren.

Rollback:

```sql
alter function public.auto_enable_rls() reset search_path;
alter function public.notify_minion_job_change() reset search_path;
alter function public.update_chunk_search_vector() reset search_path;
alter function public.update_page_search_vector() reset search_path;
```

Verifikation:

- Security Advisor erneut ausfuehren.
- Erwartung: `function_search_path_mutable` Befunde sind weg.
- Betroffene Trigger/Funktionen einmal durch realen App- oder SQL-Pfad ausloesen, falls bekannt.

## Phase 3: Fehlende FK-Indexes

Betroffene Foreign Keys:

- `public.code_edges_chunk`: `code_edges_chunk_source_id_fkey`
- `public.facts`: `facts_superseded_by_fkey`
- `public.oauth_codes`: `oauth_codes_client_id_fkey`
- `public.subagent_rate_leases`: `subagent_rate_leases_owner_job_id_fkey`
- `public.take_nudge_log`: `take_nudge_log_source_id_fkey`

### Entscheidung: Migration vs. Online-Operation

**Repo-Migration / Wartungsfenster:** normale Indexes verwenden, weil Migration Runner haeufig Transaktionen verwenden.

```sql
create index if not exists idx_code_edges_chunk_source_id
on public.code_edges_chunk (source_id);

create index if not exists idx_facts_superseded_by
on public.facts (superseded_by);

create index if not exists idx_oauth_codes_client_id
on public.oauth_codes (client_id);

create index if not exists idx_subagent_rate_leases_owner_job_id
on public.subagent_rate_leases (owner_job_id);

create index if not exists idx_take_nudge_log_source_id
on public.take_nudge_log (source_id);
```

**Production online fix:** `CREATE INDEX CONCURRENTLY` nur als eigene nicht-transaktionale SQL-Ausfuehrung, niemals in `BEGIN`/`COMMIT` und nicht in einem Runner, der automatisch Transaktionen wrappt.

```sql
create index concurrently if not exists idx_code_edges_chunk_source_id
on public.code_edges_chunk (source_id);
```

Dasselbe Muster dann pro Index separat anwenden.

Rollback:

```sql
drop index concurrently if exists public.idx_code_edges_chunk_source_id;
drop index concurrently if exists public.idx_facts_superseded_by;
drop index concurrently if exists public.idx_oauth_codes_client_id;
drop index concurrently if exists public.idx_subagent_rate_leases_owner_job_id;
drop index concurrently if exists public.idx_take_nudge_log_source_id;
```

Wenn Rollback in einer transaktionalen Migration laufen muss, `concurrently` weglassen und Lock-Risiko akzeptieren.

Verifikation:

- Performance Advisor erneut ausfuehren.
- Erwartung: `unindexed_foreign_keys` Befunde sind weg.
- `pg_index` Preflight erneut ausfuehren und Indexnamen/Validitaet pruefen.

## Phase 4: RLS und Grants als Backend-Only Hardening

Advisor meldet 52 Tabellen mit RLS aktiv, aber ohne Policies. Fuer Rezepti ist das aktuell weitgehend beabsichtigt: direkte Backend-DB-Verbindung funktioniert, Data API Rollen bleiben gesperrt.

Die Aufgabe in diesem Pass ist daher:

1. Keine Policies fuer Backend-only Tabellen erstellen.
2. Grants fuer `anon` und `authenticated` pruefen.
3. Abweichungen dokumentieren oder revoken.
4. Backend-DB-Rolle und `BYPASSRLS`-Blast-Radius dokumentieren.

Required classification artifact:

| Table | Classification | Access role | Action | Verification |
|---|---|---|---|---|
| `recipes` | backend-only now, future Data API | direct DB backend role | no policy now; keep Data API closed | Hono API smoke + no anon/auth grants |
| `shopping_list` | backend-only now, future Data API | direct DB backend role | no policy now; keep Data API closed | Hono API smoke + no anon/auth grants |
| `meal_plan` | backend-only now, future Data API | direct DB backend role | no policy now; keep Data API closed | Hono API smoke + no anon/auth grants |
| `ingredient_dictionary` | backend-only | direct DB backend role | no policy; no Data API exposure | no anon/auth grants |
| `api_keys` | backend-only secret table | direct DB backend role | no policy; no Data API exposure | no anon/auth grants |

For all other 47 tables from `security advisor info.md`, produce the same classification before changing grants or policies.

Grant verification:

```sql
select
  c.oid::regclass as table_name,
  has_table_privilege('anon', c.oid, 'select') as anon_select,
  has_table_privilege('anon', c.oid, 'insert') as anon_insert,
  has_table_privilege('anon', c.oid, 'update') as anon_update,
  has_table_privilege('anon', c.oid, 'delete') as anon_delete,
  has_table_privilege('authenticated', c.oid, 'select') as auth_select,
  has_table_privilege('authenticated', c.oid, 'insert') as auth_insert,
  has_table_privilege('authenticated', c.oid, 'update') as auth_update,
  has_table_privilege('authenticated', c.oid, 'delete') as auth_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.oid::regclass::text;
```

If backend-only tables still grant Data API access:

```sql
revoke all on table public.recipes from anon, authenticated;
revoke all on table public.shopping_list from anon, authenticated;
revoke all on table public.meal_plan from anon, authenticated;
revoke all on table public.ingredient_dictionary from anon, authenticated;
revoke all on table public.api_keys from anon, authenticated;
```

Rollback fuer Grant-Revokes nur nach expliziter Entscheidung, weil Restore alter Grants sonst versehentlich Data API oeffnen kann.

## Phase 5: Future Data API / Multi-User Gate

Keine Produkt-Policies in diesem Remediation-Pass.

Vor Aktivierung von `db/templates/public-multi-user-data-api-rls.sql` muessen erledigt sein:

- Supabase Auth/JWT in Hono-Routen validieren.
- `user_id` bei Inserts fuer `recipes`, `shopping_list`, `meal_plan`, `api_keys` setzen.
- Bestehende Rows backfillen oder als globale Legacy-Rows bewusst klassifizieren.
- Queries in `src/db-react.ts` auf Owner-/Global-Filter umstellen.
- `shopping_list.recipe_id` und `meal_plan.recipe_id` gegen eigene oder globale `recipes` absichern.
- Negative RLS-Tests schreiben: fremde `user_id`, `NULL` Legacy-Rows, globale Rezept-Update/Delete-Verbot, Sequence-Permissions.
- Supabase Storage separat pruefen, falls `files` Storage meint: `storage.buckets`, `storage.objects`, Bucket Policies und Objekt-RLS liegen nicht in `public`.

## Phase 6: Extension in Public

Betroffen:

- `vector`
- `pg_trgm`

Entscheidung: nicht Teil der Kern-Remediation. Erst separates Dependency-Inventar, dann eigener Plan.

Dependency-Preflight:

```sql
select
  e.extname,
  e.extnamespace::regnamespace as extension_schema,
  d.classid::regclass as dependent_class,
  d.objid::regclass as dependent_object,
  d.deptype
from pg_extension e
left join pg_depend d on d.refobjid = e.oid
where e.extname in ('vector', 'pg_trgm')
order by e.extname, dependent_class::text, dependent_object::text;
```

Funktionen und Trigger dumpen:

```sql
select p.oid::regprocedure, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ~* '(vector|trgm|similarity|embedding|tsvector|to_tsvector)';

select
  tg.tgname,
  tg.tgrelid::regclass as table_name,
  pg_get_triggerdef(tg.oid)
from pg_trigger tg
where not tg.tgisinternal
order by table_name::text, tg.tgname;
```

Nur wenn Dependency-Inventar sauber ist:

```sql
create schema if not exists extensions;
alter extension vector set schema extensions;
alter extension pg_trgm set schema extensions;
grant usage on schema extensions to authenticated, service_role;
```

Rollback:

```sql
alter extension vector set schema public;
alter extension pg_trgm set schema public;
```

## Phase 7: Unused Indexes

Die 83 `unused_index` Befunde nicht blind loeschen.

Pruefabfrage:

```sql
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
order by idx_scan asc, relname, indexrelname;
```

Regeln:

- Vector-, Search-, Cleanup-, Foreign-Key- und seltene Admin-Indexes behalten, bis ein Query-Pfad bewertet wurde.
- Nur redundant erkannte Indexes droppen.
- Jeder Drop braucht eigenen Rollback-Befehl.

## Phase 8: Runbook

```bash
cd /home/patrick/Projekte/rezepti

# Ziel-DB setzen und pruefen
test -n "$DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select current_user, session_user;"

# Preflight als Datei speichern
mkdir -p docs/SupaBase/runbook-output
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/SupaBase/preflight.sql \
  | tee docs/SupaBase/runbook-output/preflight-$(date +%Y-%m-%d).txt

# Repo-konforme Migration nach Review anlegen
$EDITOR db/migrations/2026-05-31-supabase-advisor-search-path-and-fk-indexes.sql

# Migration ausfuehren
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/2026-05-31-supabase-advisor-search-path-and-fk-indexes.sql
```

Wenn `CREATE INDEX CONCURRENTLY` genutzt wird, nicht ueber obigen Migration-Run ausfuehren, sondern als separate nicht-transaktionale Operational SQL.

## Test Plan

### Current Backend-Only Smoke

- `GET /api/v1/health`
- `GET /api/v1/recipes`
- `POST /api/v1/recipes`
- `PATCH /api/v1/recipes/:id`
- `DELETE /api/v1/recipes/:id`
- Shopping-list add/toggle/delete
- Meal-plan add/remove/clear

Diese Tests beweisen, dass direkte Backend-DB-Nutzung nach RLS/Grant-Verifikation weiter funktioniert.

### Authorization Negative Tests fuer spaeter

Erst in der Multi-User/Data-API-Phase:

- Authenticated User A darf User-B Rows nicht lesen/schreiben.
- `shopping_list.recipe_id` darf nicht auf private fremde Rezepte zeigen.
- `meal_plan.recipe_id` darf nicht auf private fremde Rezepte zeigen.
- Globale Rezepte duerfen gelesen, aber nicht geaendert oder geloescht werden.
- Sequence Grants erlauben Inserts nur fuer freigegebene Tabellen.

## Failure Modes Registry

| Failure mode | Severity | Mitigation |
|---|---:|---|
| RLS INFOs werden durch broad Policies "gefixt" | High | Keine Policies in Kern-Remediation; Data API bleibt geschlossen |
| Backend nutzt Superuser/BYPASSRLS und Team glaubt RLS schuetze App-Queries | High | Runtime-Rollen auditieren und dokumentieren |
| `CREATE INDEX CONCURRENTLY` laeuft in transaktionalem Runner | High | Migration vs. online operation strikt trennen |
| Extension-Move bricht Trigger/Funktionen/Indexes | High | Separates Dependency-Inventar und Rollback |
| Future Data API erlaubt cross-row recipe references | High | `recipe_id` Ownership-Pruefung vor Policy-Aktivierung |
| Unused Indexes werden blind entfernt | Medium | Redundanz- und Query-Pfad-Nachweis verlangen |

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | RLS-without-policy bleibt fuer Backend-only Tabellen absichtlich bestehen | Mechanical | Security first | Aktuelle Architektur nutzt direkte Backend-DB und will Data API geschlossen halten | Policies nur fuer Advisor-Cleanliness |
| 2 | Eng | FK-Index-Erstellung trennt transaktionale Migration von online `CONCURRENTLY` | Mechanical | Explicit over clever | Verhindert Migration-Failures durch Transaktionswrapper | Generisches `CREATE INDEX CONCURRENTLY` in Migration |
| 3 | Eng | Extension-Move wird aus Kern-Remediation herausgenommen | Mechanical | Pragmatic | Dependency-Risiko ist hoeher als Nutzen in diesem Pass | `alter extension ... set schema` direkt ausfuehren |
| 4 | DX | Repo nutzt weiter `db/migrations`, nicht Supabase CLI Layout | Mechanical | Match existing repo | Vorhandene Migrationen liegen unter `db/migrations/YYYY-MM-DD...` | `supabase migration new` |
| 5 | Eng | Runtime-Rollen und Grants werden eigene Preflight-Phase | Mechanical | Completeness | RLS ohne Grants-Audit kann falsche Sicherheit erzeugen | Nur `pg_policies` pruefen |
| 6 | Eng | Multi-User/Data-API wird separater Gate-Track | Mechanical | Boil lake, not ocean | Auth propagation, Backfill und Query-Filter sind mehr als Advisor-Remediation | Produkt-Policies jetzt aktivieren |

## GSTACK REVIEW REPORT

### CEO Review

Premise-Korrektur: Das Ziel ist nicht maximaler Advisor-Clean-State, sondern Entfernen echter Risiken bei Erhalt der absichtlichen Data-API-Sperre. Die groesste 6-Monats-Gefahr waere, RLS-INFOs durch breite Policies zu beseitigen und dadurch Tabellen vor Multi-User-Readiness zu oeffnen.

### Design Review

Skipped: kein UI-Scope.

### Engineering Review

Kritische Aenderungen:

- Access-Model-Begriffe geschaerft: direkte Backend-Rolle vs. Supabase `service_role` vs. `anon`/`authenticated`.
- Grant- und Rollen-Audit als Preflight ergaenzt.
- Data-API-Policies aus Kern-Remediation entfernt.
- FK-Index-Erstellung in Migration/Online-Modus getrennt.
- Extension-Move separat und dependency-gated.

### DX Review

Kritische Aenderungen:

- `supabase migration new` entfernt, weil es nicht zum Repo-Layout passt.
- Runbook mit `psql "$DATABASE_URL" -v ON_ERROR_STOP=1` ergaenzt.
- Rollback-Hinweise fuer Funktionsfixes, Indexes und Extensions ergaenzt.
- Required classification artifact fuer RLS/Grants eingefuehrt.

### Final Approval

Autoplan-Entscheidung: approved as-is mit den oben eingearbeiteten Empfehlungen. Keine User-Challenges offen, weil alle externen Stimmen denselben Richtungswechsel bestaetigen: RLS-INFOs bleiben dokumentierte Exceptions, bis Multi-User/Data-API wirklich umgesetzt wird.

## Abschlusskriterien

- `function_search_path_mutable` WARNs sind weg.
- `unindexed_foreign_keys` Befunde sind weg oder als durch bestehenden linksfuehrenden Index abgedeckt nachgewiesen.
- Alle 52 RLS-ohne-Policy Tabellen sind klassifiziert.
- `anon`/`authenticated` Grants fuer Backend-only Tabellen sind geprueft und dokumentiert.
- Runtime-DB-Rolle, `rolsuper` und `rolbypassrls` sind dokumentiert.
- Extension- und unused-index Befunde sind als separate Follow-up-Tracks dokumentiert, nicht heimlich umgesetzt.
