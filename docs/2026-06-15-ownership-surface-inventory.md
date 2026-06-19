# Ownership Surface Inventory

Stand: 2026-06-19

Scope: aktueller Code-Stand fuer API-Routen, persistente DB-Flaechen, lokale
Persistenz und serverseitige Singleton-/In-Memory-Pfade.

## Ergebnis

Die verbliebenen Ownership-Flaechen sind jetzt explizit inventarisiert. Es gibt
keine produktive `unknown`-Flaeche mehr ohne benannte Folgeentscheidung.

Offene, aber bewusst akzeptierte Sonderfaelle:

- `ingredient_dictionary` bleibt absichtlich `global`:
  `GET`/`match` public read, `POST` admin-only mutation.
- Extract-Job-Daten bleiben `user-scoped`, aber nur in-memory und ohne
  Restart-Persistenz.

## Klassifikation

- `user-scoped`
- `workspace-scoped`
- `global`
- `admin-only`
- `disabled`
- `open-by-design`

Zusatzmarker:

- `read-only`
- `mutation`
- `transient`
- `device-local`

## API-Surfaces

| Surface | Layer | Owner model | Auth | Read boundary | Write boundary | Risk | Required action |
|---|---|---|---|---|---|---|---|
| `recipes` | Server + RLS | `user-scoped` oder `workspace-scoped` | `requireUserAuth` | owner visibility via `recipeVisibilityForAuth` | owner visibility via same helper | low | — |
| `shopping` | Server + RLS | `workspace-scoped` | `requireAuth` | active household | active household | low | — |
| `planner` | Server + RLS | `workspace-scoped` | `requireAuth` | active household | active household | low | — |
| `auth/bootstrap` | Server + DB | `user-scoped` bootstrap with workspace side-effect | `requireUserAuth` | caller only | caller only creates/ensures own profile + default household | low | — |
| `extract/react`, `extract/photo`, `extract/text`, `extract/jobs` | Server + in-memory | `user-scoped` with household snapshot on async jobs | `requireUserAuth` | caller only | caller only | low | implemented |
| `extract/react/:jobId` GET/DELETE | Server + in-memory | `user-scoped` | inline ownership check | owning user only | owning user only | medium | boundary is correct, but stays middleware-free by design |
| `keys/validate` | Server + DB rate-limit table | `user-scoped` | `requireUserAuth` | caller only | caller only | low | — |
| `push/subscribe` | Server + RLS | `user-scoped` | `requireUserAuth` | caller only | caller only | low | — |
| `cookidoo/status` | Server + Postgres | `user-scoped` with optional `workspace-scoped` fallback | `requireUserAuth` | caller sees resolved scope (`user > household > none`) plus household-share + owner-capability flags | — | low | implemented |
| `cookidoo/credentials` | Server + Postgres | private `user-scoped` row | `requireUserAuth` | no direct readback of secret | caller only mutates own private row | low | implemented |
| `cookidoo/credentials/share` | Server + Postgres | explicit `workspace-scoped` share | `requireUserAuth` | household members can use shared credentials via resolver | active-household owner only | low | implemented |
| `pinterest/*`, `facebook/*` | Server | `disabled` | `requireUserAuth` | — | — | low | stays `501` until real model exists |
| `dictionary` GET | Server | `global` `read-only` | none | public | — | low | intentional public read |
| `dictionary/match` GET | Server | `global` `read-only` | none | public | — | low | intentional public read |
| `dictionary` POST | Server | `admin-only` global mutation | `requireAuth` + admin gate | — | admin only | medium | contract test now exists; no further action |
| `images/search` | Server | `user-scoped` access to external quota | `requireUserAuth` | caller only | caller only | low | auth gate already landed |
| `proxy/image` | Server | `open-by-design` | none | public | — | low | SSRF guard kept mandatory |
| `health` | Server | `open-by-design` | none | public | — | low | — |

## DB-Surfaces

| Surface | Layer | Owner model | Read boundary | Write boundary | Risk | Required action |
|---|---|---|---|---|---|---|
| `recipes` | Postgres + RLS | `user-scoped` or `workspace-scoped` | owner/user-membership visibility | owner/user-membership visibility | low | — |
| `shopping_list` | Postgres + RLS | `workspace-scoped` | household | household | low | note: `user_id` is attribution, not read boundary |
| `meal_plan` | Postgres + RLS | `workspace-scoped` | household | household | low | note: `user_id` is attribution, not read boundary |
| `ingredient_dictionary` | Postgres | `global` | backend role only at DB level; public via server routes only | backend/admin via server route | medium | keep Data API closed |
| `user_profiles` | Postgres + RLS | `user-scoped` | own profile | own bootstrap/admin paths | low | — |
| `households` | Postgres + RLS | `workspace-scoped` | membership-based | bootstrap/membership-managed | low | — |
| `household_memberships` | Postgres + RLS | `workspace-scoped` | membership-based | bootstrap/admin/system-managed | low | no public membership CRUD yet |
| `user_default_households` | Postgres + RLS | `user-scoped` pointer into workspace | caller only | caller only via bootstrap/system helpers | low | — |
| `push_subscriptions` | Postgres + RLS | `user-scoped` | caller only | caller only | low | — |
| `byok_validation_rate_limits` | Postgres | `user-scoped` | backend-only; user influence via own validate calls | backend-only for caller's own rows | low | no UI needed for ownership track |
| `cookidoo_credentials` | Postgres | private `user-scoped` or explicit `workspace-scoped` | backend-only; effective access via resolver `user > household` | private row by caller, household row by owner-only share route | low | implemented 2026-06-19 incl. RLS + revoked direct grants + household FK cascade |
| `api_keys` | removed | deleted | — | — | — | already dropped |

## Local / Device Persistence

| Surface | Layer | Owner model | Storage | Read boundary | Write boundary | Risk | Required action |
|---|---|---|---|---|---|---|---|
| Supabase session | Mobile/Web client | `user-scoped` `device-local` | SecureStore on native, AsyncStorage fallback on web/test | current device/browser profile | current device/browser profile | medium | acceptable; session persistence already tested |
| React Query recipe cache | Mobile/Web client | `user-scoped` `device-local` | AsyncStorage key `recipedeck-query-cache-<userId or anon>` | current device/browser profile, namespaced per user | current device/browser profile | low | namespacing + cold-start clearing already landed |
| PWA recipe cache buckets | Service Worker | `user-scoped` `device-local` | Cache Storage `rd-user-<sha256(userId)>` | current browser profile, per-user hashed bucket | current browser profile | low | known multi-tab last-user-wins limitation remains documented |
| Offline mutation queue | Browser IndexedDB | `workspace-scoped` intent on one device | `recipedeck-offline` / `mutation-queue` | current browser profile | current browser profile | medium | acceptable; server idempotency + auth re-check enforce boundary on flush |
| BYOK Groq key | Mobile client | `user-scoped` `device-local` | SecureStore | current device/browser profile | current device/browser profile | low | intentional BYOK-local design |
| Theme / view mode / server URL / image search count / Facebook ToS / PDF dir URI | Client prefs | `device-local` global-on-device | AsyncStorage/localStorage | current device/browser profile | current device/browser profile | low | no cloud privacy promise; keep as local UX state only |

## Server-Local / Transient Surfaces

| Surface | Layer | Owner model | Persistence | Read boundary | Write boundary | Risk | Required action |
|---|---|---|---|---|---|---|---|
| Extract job registry | Server memory | `user-scoped` `transient` | lost on restart | owner only | owner only | low | acceptable for polling workflow |
| `photoDataStore` / `textDataStore` | Server memory | `user-scoped` `transient` | lost on restart | internal only | internal only | low | ephemeral by design |

## Findings

### P1

- `ingredient_dictionary` intentionally mixes public read with admin-only write.
  This is acceptable because the product position is "shared system dictionary",
  not a private user object.
- Several client-side preference keys are device-local and not account-scoped.
  That is fine because the UI does not promise cloud sync or per-account privacy
  for theme, view mode, PDF directory, or server URL.

## Abschluss

Der offene TODO-Punkt "Weitere ungeschuetzte Ownership-Flaechen
inventarisieren" ist damit inhaltlich abgeschlossen. Verbleibende Ownership-
Folgearbeit ist keine unbekannte Sicherheitsluecke mehr, sondern bewusst
separierte Produktarbeit:

- Workspace invitations
- Multi-workspace switching
- Recipe sharing / collections / favorites
- full credential ownership beyond the remaining interim states
