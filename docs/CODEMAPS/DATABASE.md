# Database Codemap

**Last Updated:** 2026-08-07 (v1.0.196)

**Database:** Supabase PostgreSQL · **ORM:** Drizzle via `postgres-js` ·
**Connection:** `DATABASE_URL` (pooler format)

> **SQLite is fully gone.** `better-sqlite3`, `./data/rezepti-react.db`,
> `src/db.ts` and `src/db-manager.ts` no longer exist. Anything that still
> mentions SQLite predates 2026-04-16.

## Layout

| File | Role |
|------|------|
| `src/schema.ts` (338 lines) | Drizzle table definitions, 17 tables |
| `src/db-react.ts` (2758 lines) | **all** data access — 86 exports |
| `supabase/migrations/*.sql` | the authoritative source for the schema |
| `drizzle.config.ts` | for `db:push` / `db:studio` |

`resolvePostgresSsl()` decides on TLS from the connection string.
`ensureReactSchema()` is a **no-op** — the schema comes from migrations.

`db-react.ts` is by far the largest module in the project. It is not a
repository pattern but a flat set of functions grouped by domain. When
extending it, put the new function into the matching group rather than at the
end of the file.

## Owner Model

Every user-owned row has an explicit owner — a user **or** a household. There
are no global recipes and no null-owner compatibility.

```ts
type RecipeOwner = { type: "user"; userId } | { type: "household"; householdId }
```

- `owner_type = 'user'` → `owner_user_id` set, `household_id` NULL
- `owner_type = 'household'` → `household_id` set, `owner_user_id` NULL

Enforced by CHECK constraints (`*_owner_shape_check`) on top of Row Level
Security. Sharing always means **copying** (`shareCopyRecipe`,
`acceptRecipeShareInvite`), never shared mutation of the same row.

## The Central Pattern: `RecipeAuthContext`

Almost every recipe function takes a `RecipeAuthContext` (user id + households +
active household). The internal helper `recipeVisibilityForAuth(auth)` builds
the `WHERE` clause from it — **one** place where visibility is decided:

```ts
db.select().from(recipes).where(recipeVisibilityForAuth(auth))
```

`canMutateRecipeForAuth` is currently identical to read visibility.

**Rule: no new query against `recipes` without `recipeVisibilityForAuth(auth)`.**
Leaving it out bypasses the primary trust boundary — RLS would still catch it in
production, but tests run without RLS.

## Tables (17)

```
auth.users (Supabase)
   ├── user_profiles            app_role: 'user' | 'admin'
   ├── user_default_households
   └── household_memberships ──► households
                                     │
recipes ◄── recipe_collection_items ──► recipe_collections
   │  ▲                                     (favorites | custom)
   │  └── recipe_share_invites (email-bound, token hash)
   ├──► meal_plan        (household-scoped)
   └──► shopping_list    (household-scoped)

ingredient_dictionary          global, read-only for everyone
cookidoo_credentials           user-default, optional household share
bug_reports (+ rate limits)    user-scoped, admin reads all
push_subscriptions             user-scoped
byok_validation_policies       global, admin-only
byok_validation_rate_limits    per user + key hash + hourly window
```

### `recipes`

Core columns: `id` (serial PK), `name`, `emoji`, `source_url`, `image_url`,
`servings`, `duration`, `calories`, `tags`, `category`, `ingredients`, `steps`,
`transcript`, `equipment`, `nutrition_info`, `ingredient_groups`, `tried`,
`rating`, `notes`, `pdf_created`, `created_at`, `updated_at`.

Ownership columns: `owner_type` (NOT NULL, CHECK), `owner_user_id`,
`household_id`, `created_by`, `source_recipe_id` (origin of a share copy).

Indexes: `recipes_owner_user_idx (owner_user_id, created_at, id)`,
`recipes_household_idx (household_id, created_at, id)`, `recipes_created_by_idx`.

### `recipe_collections` / `recipe_collection_items`

`uuid` PK. `kind` is `favorites` or `custom`; there may be only **one**
favorites list per user and per household, enforced by two partial unique
indexes. Items carry `position` (integer, default 0);
`UNIQUE (collection_id, recipe_id)` prevents duplicates, both FKs are
`ON DELETE CASCADE`.

Putting a **private** recipe into a **household** collection creates a household
copy — a collection never contains foreign-owned recipes.

### `recipe_share_invites`

Email-bound direct invite. Only the `token_hash` is stored, never the token.
`status` ∈ `pending | accepted | revoked | expired`, coupled by CHECK to
`accepted_by_user_id` / `accepted_recipe_id` / `accepted_at` (all set or all
NULL). Accepting creates a **private copy** for the recipient; repeated
acceptance is idempotent and a wrong account cannot accept.

### `shopping_list` / `meal_plan` (household-scoped)

`shopping_list`: `household_id` NOT NULL,
`UNIQUE (household_id, recipe_id, canonical_name)` with `NULLS NOT DISTINCT` —
which is simultaneously the dedupe rule for the offline write path, so the
shopping list needs **no** `client_op_id`.

`meal_plan`: `day_of_week` 0=Monday … 6=Sunday, `week_start` as a Unix timestamp
of the Monday. `client_op_id` (uuid, nullable) plus the partial unique index
`meal_plan_household_opid_uidx` provides **idempotency for the offline mutation
queue**.

### Operations tables

| Table | Purpose | Scope |
|-------|---------|-------|
| `cookidoo_credentials` | Cookidoo login + scoped session | user-default, optional household share (`user > household`) |
| `bug_reports` | Bug reporting incl. `lastFailureSnapshot` | user-scoped, admin reads all |
| `bug_report_submission_rate_limits` | Abuse protection | user-scoped |
| `push_subscriptions` | Web Push endpoints (VAPID) | user-scoped, 410/404 auto-pruned |
| `byok_validation_policies` | Rate-limit policy for `/keys/validate` | global, admin-only |
| `byok_validation_rate_limits` | Consumed budget | per user + key hash + hourly window |

`cookidoo_credentials.password` and `.session_cookies` are encrypted at rest
(AES-256-GCM, format `v1:<iv>:<authTag>:<ciphertext>`) — encrypted on write and
decrypted on read exclusively inside `db-react.ts`, via `src/credential-crypto.ts`.
The key lives in the `CREDENTIAL_ENCRYPTION_KEY` env var, never in the database.
`email` and `session_user_agent` remain plaintext. Rows written before this
shipped may still hold plaintext in `password`/`session_cookies` — tolerated on
read (checked before the key is touched) until `npm run credentials:encrypt-backfill`
has run against that environment.

> The `api_keys` table was **dropped** in migration `20260609143000` — there is
> no server-side BYOK key store.

## Function Groups in `db-react.ts`

| Group | Examples |
|-------|----------|
| Recipes | `saveRecipeToReactDb`, `getRecipeListFromReactDb`, `getRecipeByIdFromReactDb`, `updateRecipeInReactDb`, `deleteRecipeFromReactDb`, `getRecipeCount` |
| Ingredient search | `searchRecipesByIngredients`, `searchRecipesByIngredientsAdvanced`, `findCanonicalBySimilarity` |
| Visibility | `isRecipeVisibleToAuth`, `isShareCopyAllowed`, `isRecipeLegalForCollection`, `loadRecipeOwnerRow` |
| Collections | `getCollectionsForAuth`, `createCollection`, `renameCollection`, `deleteCollection`, `addRecipeToCollection`, `removeRecipeFromCollection`, `reorderCollectionItems`, `bulkRemoveRecipesFromCollection`, `bulkCopyCollectionItems` |
| Favorites | `resolveFavoritesCollection`, `setFavorite`, `toggleFavorite`, `getFavoriteRecipeIdsForAuth` |
| Sharing | `shareCopyRecipe`, `createRecipeShareInvite`, `getRecipeShareInvitePreview`, `acceptRecipeShareInvite`, `deriveRecipeShareReadModel` |
| Users / households | `loadUserAuthorization`, `ensureUserProfile`, `ensureDefaultHouseholdForUser`, `chooseActiveHouseholdId`, `getAccountBootstrapStatus` |
| Cookidoo | `saveUserCookidooCredentials`, `resolveCookidooCredentials`, `shareCookidooCredentialsToHousehold`, `getCookidooStatus`, `updateCookidooScopedSession`; plus `listCookidooCredentialSecretsForBackfill` / `updateCookidooCredentialSecretsById`, two narrow exports used only by `scripts/encrypt-cookidoo-credentials.ts` that deliberately bypass the encrypt-on-write/decrypt-on-read layer |
| Shopping | `getShoppingList`, `addToShoppingList`, `toggleShoppingItem`, `clearCheckedItems`, `clearAllShoppingItems` |
| Meal plan | `getMealPlanForWeek`, `addRecipeToMealPlan`, `removeRecipeFromMealPlan`, `clearMealPlanForWeek` |
| Dictionary | `getAllDictionaryEntries`, `addToDictionary`, `deleteDictionaryEntry` |
| Bug reports | `createBugReport`, `listMyBugReports`, `listBugReportsForAdmin`, `updateBugReportAdminFields`, `recordBugReportSubmissionAttempt` |
| BYOK | `getByokValidationPolicy`, `upsertByokValidationPolicy`, `recordByokValidationAttempt` |
| Push | `getPushSubscriptionsForUser`, `addPushSubscription`, `deletePushSubscriptionByEndpoint` |

## Pitfall: JSON is stored as `text`, not `jsonb`

`tags`, `ingredients`, `steps`, `equipment`, `nutrition_info` and
`ingredient_groups` are `text` columns holding JSON — a leftover from the
SQLite era.

- Write: `JSON.stringify(...)`, `null` when empty
- Read: `JSON.parse(row.tags ?? "[]")`

No SQL querying into the JSON structure — that is why ingredient search loads
rows and filters in JS. Migrating to `jsonb` would be its own migration and has
deliberately not happened.

## Pitfall: camelCase vs snake_case

Drizzle rows are snake_case (`image_url`, `nutrition_info`); `RecipeData` in the
rest of the app is camelCase (`imageUrl`, `nutritionInfo`). The mapping happens
in `db-react.ts`, and PATCH payloads from the client arrive camelCase. This has
been a recurring source of bugs — see `docs/PROJECT_LEARNINGS.md`.

## Changing the Schema — Order of Operations

1. Write the migration: `supabase/migrations/<timestamp>_<name>.sql`
2. Update `src/schema.ts`
3. Add the access functions in `db-react.ts`
4. Set the RLS policy and cover it in `scripts/supabase/rls-smoke.ts`
5. `npm run supabase:rls-smoke` locally, then the `supabase-rls-smoke` CI job

```bash
npx drizzle-kit push          # local experimentation only
npx supabase db push --yes    # staging
```

Production migrations run through the manual *Apply Supabase Migrations*
workflow, not locally.

## Row Level Security

RLS is enabled on every user table; app requests run with the Supabase user JWT
as role `authenticated`. The server API is the primary boundary, RLS the second —
**RLS must never allow more than the API.**

## Connection Notes

The direct host `db.<ref>.supabase.co` works locally but gives **ENOTFOUND**
from Northflank. Always use the transaction pooler:

```
postgresql://postgres.[ref]:<password>@aws-0-[region].pooler.supabase.com:6543/postgres
```

Note the username format: `postgres.[ref]`, not just `postgres`. The pooler URL
is **not** in the main Database → Connection String view — it lives under
Settings → Database → Connection pooling (scroll down).

`prepare: false` is required — pgbouncer in transaction mode does not support
prepared statements.

> If the host stops resolving **locally too**, the Supabase project is
> **paused** (free tier pauses after ~4 weeks of inactivity and removes the DNS
> record). Happened on 2026-07-07 and again on 2026-08-07.

## Tests

`test/unit/db-react.test.ts`, `db-react-fuzzy.test.ts`,
`recipe-collections-routes.test.ts`, `recipe-share-invites-routes.test.ts`,
`collections-sharing.test.ts`, `cookidoo-storage.test.ts`,
`planner-idempotency.test.ts`. The RLS contract is covered separately by
`npm run supabase:rls-smoke`.
