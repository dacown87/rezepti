# Ownership Surface Inventory

Stand: 2026-06-15

Scope: aktueller Code-Stand fuer API-Routen, persistente DB-Flaechen, lokale
Persistenz und serverseitige Singleton-/In-Memory-Pfade.

## Ergebnis

Die verbliebenen Ownership-Flaechen sind jetzt explizit inventarisiert. Es gibt
keine produktive `unknown`-Flaeche mehr ohne benannte Folgeentscheidung.

Offene, aber bewusst akzeptierte Sonderfaelle:

- `cookidoo/credentials` ist aktuell noch `server-scoped-singleton`, hat jetzt
  aber ein beschlossenes Zielmodell: `user-scoped` als Default mit optionaler
  expliziter Household-Freigabe.
- `ingredient_dictionary` bleibt absichtlich `global`:
  `GET`/`match` public read, `POST` admin-only mutation.
- Extract-Job-Daten bleiben `user-scoped`, aber nur in-memory und ohne
  Restart-Persistenz.

## Klassifikation

- `user-scoped`
- `workspace-scoped`
- `global`
- `admin-only`
- `server-scoped-singleton`
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
| `extract/react`, `extract/photo`, `extract/text`, `extract/jobs` | Server + in-memory | `user-scoped` | `requireUserAuth` | caller only | caller only | low | — |
| `extract/react/:jobId` GET/DELETE | Server + in-memory | `user-scoped` | inline ownership check | owning user only | owning user only | medium | boundary is correct, but stays middleware-free by design |
| `keys/validate` | Server + DB rate-limit table | `user-scoped` | `requireUserAuth` | caller only | caller only | low | — |
| `push/subscribe` | Server + RLS | `user-scoped` | `requireUserAuth` | caller only | caller only | low | — |
| `cookidoo/status` | Server (disk) | `server-scoped-singleton` | `requireUserAuth` | any authenticated user can observe global connection state | — | medium | interim only; replace with user-default + optional household-share |
| `cookidoo/credentials` | Server (disk) | `server-scoped-singleton` | `requireUserAuth` | no direct readback of secret | any authenticated user can replace/delete global credentials | medium | replace with user-default + optional household-share; old global file gets dropped |
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
| Cookidoo credentials file + session cache | Server disk + memory | `server-scoped-singleton` | survives restart | any authenticated user sees status only | any authenticated user can replace/delete | medium | temporary state only; target plan removes singleton semantics |
| Extract job registry | Server memory | `user-scoped` `transient` | lost on restart | owner only | owner only | low | acceptable for polling workflow |
| `photoDataStore` / `textDataStore` | Server memory | `user-scoped` `transient` | lost on restart | internal only | internal only | low | ephemeral by design |

## Findings

### P1

- `cookidoo/credentials` is still a shared server singleton behind user auth.
  That is not a leak anymore, but it is not true per-user ownership either.
  Follow-up is now explicit: user-default with optional household-share, global
  legacy credentials dropped on migration.

### P2

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
- Cookidoo user-default ownership with optional explicit household-share:
  [2026-06-15-cookidoo-user-household-ownership-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-cookidoo-user-household-ownership-plan.md)
- full credential ownership beyond the remaining interim states
