<!-- /autoplan restore point: /home/patrick/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260607-064544.md -->

# Auth Onboarding Deferred Follow-Ups Plan

Datum: 2026-06-07
Status: Folgeplan

## Revisit-Gate

Dieser Folgeplan muss erneut aktualisiert werden, sobald
`docs/superpowers/plans/2026-06-07-auth-onboarding-slice-plan.md`
abgeschlossen ist. Dann gilt nicht mehr die Planannahme, sondern der tatsaechlich
gelieferte Auth-Onboarding-Stand: Account-Erstellung, Login, Bootstrap,
Default-Haushalt, sichtbare Auth-Zustaende, Credential-Guardrails und offene
Abweichungen muessen gegen diesen Folgeplan abgeglichen werden.

## Ziel

Dieser Plan sammelt die Punkte, die bewusst nicht in den naechsten
Auth-Onboarding-Slice gehoeren. Der Onboarding-Slice soll nur Account erstellen,
Login, Bootstrap und sichtbare Auth-Zustaende fertig machen. Alles, was
Einladungen, mehrere Haushalte, Sharing oder groessere Account-Verwaltung
betrifft, bleibt ein separater Folge-Track.

## Warum ausklammern

Der aktuelle Engpass ist nicht fehlende Multi-User-Vision, sondern fehlende
Benutzbarkeit des vorhandenen Auth-Unterbaus. Wenn Signup, Login und
Default-Haushalt noch nicht funktionieren, wuerden groessere Household- und
Sharing-Features auf einer instabilen Nutzerreise aufbauen.

## Folge-Slice 1: Recipe Sharing und Copy-Flow

Ziel: Private Rezepte koennen bewusst in einen Haushalt kopiert werden.
Der erste kleine Produktnutzen nach Auth ist: Ein privat importiertes Rezept
kann fuer den aktiven Haushalt planbar gemacht werden.

Umfang:

- Server-Helper `copyRecipeToOwner`.
- UI-Aktion `In Haushalt kopieren`.
- Planner-Flow: privates Rezept auswaehlen -> Kopie erstellen -> Haushaltskopie
  planen.
- Sichtbare Ownership-Badges: privat, Haushalt, System.
- Copy-Kontrakt fuer kopierte und zurueckgesetzte Felder:
  `notes`, `rating`, `tried`, `pdf_created`, `image_url`, Source-Metadaten,
  `createdBy`, Duplicate-Verhalten.
- Haushalt zu privat und Haushalt zu Haushalt bleiben spaeter moeglich.

Nicht loesen im Auth-Onboarding-Slice:

- Kein Recipe-Sharing.
- Kein Copy-Endpoint.
- Kein Planner-Autocopy.

## Folge-Slice 2: Credential-Boundary-Guardrail

Ziel: Auth darf keine falsche Privacy-Erwartung erzeugen, solange BYOK-Keys und
Plattform-Zugangsdaten noch nicht sauber user- oder haushaltsbezogen sind.

Umfang:

- `/api/v1/keys`, Cookidoo-, Pinterest- und Facebook-Credential-Mutation
  explizit klassifizieren: deaktiviert, versteckt, admin/local-only oder
  bereits user-scoped.
- Settings-Copy so anpassen, dass keine user-private Credential-Speicherung
  versprochen wird, wenn der aktuelle Zustand global oder disk-backed ist.
- Route-Tests fuer die gewaehlte Zwischenregel: unauthenticated denied,
  admin-only, disabled oder user A/user B isoliert.
- Falls user-scoped: `api_keys.user_id` nutzen und Delete mit
  `key_hash AND user_id` absichern.

Nicht loesen im Auth-Onboarding-Slice:

- Keine vollstaendige Credential-Migration.
- Keine Rotation oder BYOK-Historie.
- Kein dauerhaftes per-household Credential-Modell, wenn die UI im ersten
  Auth-Slice ausgeblendet bleibt.

## Folge-Slice 3: Passwort vergessen und Account Recovery Lite

Ziel: Nutzer koennen ihren Account ohne Admin-Hilfe wiederherstellen, bevor
Haushaltseinladungen breiter genutzt werden.

Umfang:

- Supabase Password-Recovery-Flow.
- Deep-Link oder Web-Link fuer Reset.
- UI fuer neues Passwort.
- Session-Handling nach Reset.
- Runbook-Matrix fuer Supabase Auth URL, Mobile-Deep-Link, Web-Redirects,
  E-Mail-Templates, Staging/Production und abgelaufene Links.

Nicht loesen im Auth-Onboarding-Slice:

- Keine volle Account-Recovery-Politur.
- Kein OAuth-Provider-Linking.
- Keine komplexen Support-Workflows.

## Folge-Slice 4: Haushaltseinladungen

Ziel: Nutzer koennen andere Personen in ihren Haushalt einladen, nachdem
Recovery-lite und Redirect-Grundlagen stehen.

Umfang:

- Invite-Modell fuer Haushalte.
- Einladungsstatus: offen, angenommen, abgelaufen, widerrufen.
- Annahme-Flow fuer eingeloggte und noch nicht registrierte Nutzer.
- Rollen: Owner und Member.
- Recipient-UX fuer: ausgelaufen, widerrufen, falsche E-Mail, bereits Mitglied,
  Login/Signup-Abzweig und neue Einladung anfordern.
- Aktivierungsnachweis: zweite Person tritt bei und kann ein Haushaltsrezept
  planen oder hinzufuegen.
- Optional E-Mail-Versand oder Magic-Link spaeter.

Nicht loesen im Auth-Onboarding-Slice:

- Keine Invite-Links.
- Kein E-Mail-Versand.
- Keine Annahme-UX.

## Folge-Slice 5: Aktiver Haushalt und Haushalt wechseln

Ziel: Ein User kann Mitglied in mehreren Haushalten sein und aktiv wechseln.
Der minimale Server-Kontrakt wird aber schon vorher festgelegt, weil
Shopping/Planner heute einen aktiven Haushalt brauchen.

Umfang:

- Minimaler Kontrakt: Server waehlt Default-Haushalt deterministisch aus
  Memberships; kein Client-Switch/header im ersten Auth-Slice; fehlender
  Haushalt liefert `no_household`.
- Active-Household-Auswahl in UI.
- Query-Cache nach Household-Wechsel isolieren oder leeren.
- Server-Kontrakt fuer aktiven Haushalt explizit machen.
- Planner/Shopping/Household-Recipes nach aktivem Haushalt laden.

Nicht loesen im Auth-Onboarding-Slice:

- Kein Household-Switcher.
- Kein Multi-Household-Dashboard.
- Keine komplexen Rollenrechte.

## Folge-Slice 6: Vollstaendige Credential-Ownership

Ziel: API-Keys, Cookidoo/Facebook/Pinterest-Zugangsdaten und Import-Kontexte
sind sauber account- oder haushaltsbezogen.

Umfang:

- Datenmodell fuer Credential-Owner.
- Sichere Speicherung und Rotation.
- Server-Ratenlimits pro User/Household.
- Privacy-Copy in UI, die keine falschen Versprechen macht.
- Sichtbare Credential-Scopes in Settings: nur dieses Geraet, mein Account,
  Haushalt, admin/systemweit.

Nicht loesen im Auth-Onboarding-Slice:

- Keine Credential-Migration.
- Keine BYOK-Persistenzentscheidung.
- Kein serverseitiges Rate-Limit-Persistenzmodell.

## Folge-Slice 7: Favoriten und Collections

Ziel: Favoriten werden nicht als Feld am Rezept gespeichert, sondern als eigene
private oder haushaltsbezogene Collections.

Umfang:

- `recipe_collections`.
- `recipe_collection_items`.
- Owner-Modell analog zu Recipes.
- UI fuer private und Haushalts-Favoriten.

Nicht loesen im Auth-Onboarding-Slice:

- Keine Collections.
- Keine Favoritenmigration.

## Folge-Slice 8: Account-Loeschung und Datenexport

Ziel: Nutzer koennen ihre Daten exportieren oder ihren Account loeschen.
Mindestens Policy und manueller Support-Pfad muessen vor nicht-interner Beta
stehen.

Umfang:

- Exportformat fuer Rezepte, Planner, Shopping und Import-Jobs.
- Account-Deletion-Flow mit Bestaetigung.
- Household-Datenregeln: Was passiert, wenn ein Owner den Haushalt verlaesst?
- Supabase Auth User Loeschung plus DB-Cascade-Verhalten pruefen.
- Manueller Support-Pfad, falls Self-Service-UI noch nicht fertig ist.

Nicht loesen im Auth-Onboarding-Slice:

- Kein Export.
- Keine Account-Loeschung.
- Keine Household-Ownership-Transfer-Regeln.

## Folge-Slice 9: Admin-Oberflaeche

Ziel: Admins koennen spaeter Nutzer, Haushalte, Support-Faelle oder Systemdaten
gezielt verwalten.

Umfang:

- Admin-Routen und Admin-UI.
- Rollen- und Audit-Modell.
- Klare Abgrenzung: Admin sieht nicht automatisch private Rezeptinhalte, wenn
  dafuer kein explizites Produkt-/Support-Ziel existiert.

Nicht loesen im Auth-Onboarding-Slice:

- Kein Admin-Dashboard.
- Keine globale Datensicht fuer Admins.
- Keine Moderationsrechte fuer Rezepte.

## Architektur-Gate: Direkte Supabase Data API fuer Recipes

Ziel: Recipes koennen spaeter direkt ueber Supabase Data API gelesen oder
geschrieben werden, falls ein echter Produktbedarf entsteht: Offline-Sync,
Client-Schreibpfad, Latenz oder ein anderer klarer Grund. Das ist kein
Produkt-Folge-Slice.

Umfang:

- Entscheidungs-Gate: Warum reicht die Server-API nicht mehr?
- RLS-Policies fuer private Recipes.
- RLS-Policies fuer Household-Recipes.
- Insert-/Update-/Delete-Policies mit Owner-Shape-Checks.
- Immutable-Regeln fuer Owner-Felder und `created_by`.
- Grants-/Sequence-Preflight und Rollback-Plan.
- Data-API-Smoke fuer User A/User B/Household-Mitglieder.

Nicht loesen im Auth-Onboarding-Slice:

- `recipes` bleibt ueber Data API geschlossen.
- Server-API bleibt die autoritative Grenze.

## Empfohlene Reihenfolge nach Auth-Onboarding

1. Recipe Copy-Flow fuer `privat -> Haushalt`, weil der Planner sonst private
   Rezepte korrekt blockiert, aber keine gute Nutzeraktion anbietet.
2. Credential-Boundary-Guardrail, bevor Auth als Privacy-Versprechen sichtbar
   wird.
3. Recovery-lite und Supabase-Redirect-/E-Mail-Runbook.
4. Haushaltseinladungen, damit Shared Household Cooking sichtbar wird.
5. Aktiver-Haushalt-Kontrakt jetzt; Household-Switcher, sobald mehrere
   Haushalte real entstehen.
6. Vollstaendige Credential-Ownership.
7. Collections/Favoriten.
8. Account-Export/-Loeschung mit mindestens manuellem Support-Pfad vor
   nicht-interner Beta.
9. Admin-Oberflaeche.
10. Direkte Recipes Data API nur bei echtem Bedarf als Architektur-Gate.

---

## GSTACK REVIEW REPORT

Review: `/autoplan`
Datum: 2026-06-07
Base branch: `main`
Restore point: `/home/patrick/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260607-064544.md`

### Scope Detection

- UI scope: ja. Der Plan enthaelt Haushalt-Switcher, Recovery-UI, OAuth, Copy-Aktion, Collections, Credential-Privacy-Copy und Admin-Oberflaeche.
- DX scope: ja. Der Plan beruehrt Supabase Data API, API-Keys, Plattform-Credentials, Fehlercodes, Runbooks, Auth-Redirects und Test-Smokes.
- Codebasis geprueft: `src/auth.ts`, `src/schema.ts`, `src/db-react.ts`, `src/routes/recipes.ts`, `src/routes/planner.ts`, `src/routes/extraction.ts`, `src/routes/keys.ts`, `src/routes/platforms.ts`, `docs/auth-runbook-route-privacy.md`, `docs/supabase-data-api-readiness.md`, relevante Auth-/Planner-/Recipe-Tests.

### Plan Summary

Der Plan trennt den naechsten Auth-Onboarding-Slice sinnvoll von groesseren Household-, Sharing- und Account-Management-Themen. Die wichtigste Korrektur ist nicht mehr "mehr Scope in den Onboarding-Slice", sondern ein schaerferes Sequencing: Credential-Grenzen, Recovery-Basis, aktiver Haushalt und sichtbare Ownership duerfen nicht so spaet kommen, dass Auth eine falsche Privacy-Erwartung erzeugt.

### Premise Challenge

| Premise | Bewertung | Entscheidung |
|---|---|---|
| Auth-Onboarding soll nur Account, Login, Bootstrap und sichtbare Auth-Zustaende liefern. | Tragfaehig, solange keine Privacy-Versprechen fuer noch globale Credentials gemacht werden. | Akzeptiert mit Guardrail. |
| Einladungen, mehrere Haushalte, Sharing und groessere Account-Verwaltung bleiben Folge-Track. | Grundsaetzlich richtig. Aber Recovery und Credential-Boundary sind Abhaengigkeiten fuer echte externe Nutzer. | Teilweise geaendert: Basisarbeit frueher. |
| Recipe Copy-Flow ist der erste Follow-up nach Auth-Onboarding. | Richtig, weil `src/routes/planner.ts` nur Household-Rezepte plant und neue Recipes aktuell user-owned starten. | Akzeptiert und als "private recipe plannable machen" geschaerft. |
| Direkte Supabase Data API fuer Recipes ist spaet und nur bei Bedarf. | Richtig. Das ist Architektur-Option, kein Produkt-Slice. | In Architektur-Backlog statt Produktfolge verschieben. |

### What Already Exists

| Subproblem | Existing code/docs | Leverage |
|---|---|---|
| Bearer Auth und strukturierte Auth-Fehler | `src/auth.ts` | `auth_missing`, `auth_invalid`, `token_expired`, `no_household` existieren als Contract-Basis. |
| User-/Household-Owned Recipes | `src/schema.ts`, `src/db-react.ts`, `src/routes/recipes.ts` | `owner_type`, `owner_user_id`, `household_id`, `created_by`; Server-API filtert nach Auth-Kontext. |
| Planner/Shopping Household-Scope | `src/routes/planner.ts`, `src/db-react.ts` | `requireAuth()` verlangt active household; Planner akzeptiert nur Household-Rezepte. |
| Supabase Data API Boundary | `docs/supabase-data-api-readiness.md`, `supabase/migrations/*` | Recipes bleiben fuer Data API geschlossen; Shopping/Planner haben RLS-Smoke-Matrix. |
| Auth/Route Tests | `test/unit/auth.test.ts`, `test/unit/planner-auth-routes.test.ts`, `test/unit/recipes-routes.test.ts` | Gute Basis fuer no-household, recipe auth, planner auth. |

### Not In Scope For Auth-Onboarding

- Keine vollstaendigen Invite-Links, Mailversand oder Annahme-UX.
- Kein kompletter Household-Switcher mit Persistenz und Multi-Household-Dashboard.
- Kein vollstaendiger OAuth-/Provider-Linking-Flow.
- Keine Collections/Favoriten-Migration.
- Keine direkte Supabase Data API fuer Recipes.
- Keine Admin-Oberflaeche.

Guardrails, die vor oder mit Auth-Onboarding sichtbar sein muessen:

- Credential-Routen entweder verstecken/deaktivieren oder als global/admin/local-only schuetzen.
- Active-Household-Kontrakt dokumentieren: Server waehlt Default per Membership-Sortierung; kein Client-Switch/header im ersten Slice; fehlender Haushalt liefert `no_household`.
- UI darf private Recipes nicht als direkt plannbar darstellen, solange Copy-Flow fehlt.

### CEO Review

#### Step 0A - Premises

Die Kernpraemisse "erst Auth nutzbar machen, dann Multi-User" ist richtig. Der groesste Fehler waere aber, sichtbares Login mit impliziter Datensicherheit gleichzusetzen, waehrend BYOK/Cookidoo/Pinterest/Facebook-Credentials noch globale oder unauthentifizierte Routen haben. Das muss als Release-Kommunikationsgrenze in den Plan.

#### Step 0B - Existing Code Leverage

Die Codebasis hat bereits genug Ownership-Modell, um den Copy-Flow gezielt zu bauen: `parseRequestedOwner()` erzeugt user- oder household-owned Recipes, `recipeVisibilityForAuth()` filtert nach User plus Household-Memberships, und `recipeBelongsToHousehold()` blockiert private Recipes im Planner. Der Copy-Flow soll deshalb nicht als grosses Sharing-System starten, sondern als "private Recipe in aktiven Haushalt kopieren und dann planen".

#### Step 0C - Dream State

```text
CURRENT
  Auth + user-owned / household-owned recipes existieren,
  aber Credentials und sichtbare Ownership sind uneinheitlich.

THIS PLAN AFTER REVIEW
  Auth-Onboarding bleibt klein.
  Follow-ups sind nach realen User-Blockern sortiert:
  Recovery-lite, credential boundary, recipe copy, invites.

12-MONTH IDEAL
  Jeder Inhalt und jedes Secret zeigt sichtbar:
  Besitzer, Sichtbarkeit, aktiver Haushalt, Admin-/Support-Zugriff,
  Export-/Loeschverhalten und Data-API-Grenze.
```

#### Step 0C-bis - Alternatives

| Alternative | Effort | Risk | Decision |
|---|---:|---|---|
| Original order beibehalten | niedrig | Externe Nutzer treffen Invite ohne Recovery; Credentials wirken privat, sind es aber nicht. | Abgelehnt. |
| Alles in Auth-Onboarding ziehen | hoch | Slice wird breit und langsam; viele Folgeflows blockieren Account/Login. | Abgelehnt. |
| Auth-Onboarding klein halten, aber Guardrails und Follow-up-Reihenfolge schaerfen | mittel | Plan muss strenger werden, aber Implementierung bleibt kontrollierbar. | Gewaehlt. |

#### CEO Dual Voices - Consensus Table

| Dimension | Claude/Subagent | Codex | Consensus |
|---|---|---|---|
| Premises valid? | Ja, mit Credential-/Recovery-Korrektur | Ja, mit Recovery-Korrektur | CONFIRMED |
| Right problem to solve? | Ja: Auth nutzbar machen | Ja | CONFIRMED |
| Scope calibration correct? | Teilweise, credential boundary zu spaet | Recovery zu spaet | DISAGREE/TASTE |
| Alternatives explored? | Need narrower activation proof | Need activation metric | CONFIRMED |
| Competitive/market risks covered? | Privacy trust risk | Invite support risk | CONFIRMED |
| 6-month trajectory sound? | Nur mit revised order | Nur mit revised order | CONFIRMED |

#### CEO Findings

1. **High - Credential ownership is sequenced too late.** `src/routes/keys.ts` and `src/routes/platforms.ts` expose credential mutation paths that are not yet user-/household-owned. Auth UX must not imply privacy before this is guarded.
2. **High - Password recovery comes too late for invite-led growth.** Invites create external users; external users need reset/recovery before the collaboration loop is reliable.
3. **Medium - Shared Household Cooking lacks an activation proof.** Define a narrow metric: second user joins and plans/adds one household recipe within 24h.
4. **Medium - Data API is architecture, not product roadmap.** Keep Recipes Data API closed until a real offline/sync/client-write need appears.

### Design Review

#### Initial Rating

Design completeness: 5/10. The plan names the right product areas, but not the visible ownership model users need to trust them.

#### Design Dual Voices - Litmus Scorecard

| Dimension | Designer/Subagent | Codex/Primary | Consensus |
|---|---|---|---|
| Information hierarchy | Missing global active-household affordance | Missing active-household contract | CONFIRMED |
| Missing states | Invite/recovery/copy states underspecified | Stable blocked states needed | CONFIRMED |
| User journey | Planner moment underspecified | Copy-required UX needed | CONFIRMED |
| Specific UI decisions | Too generic | Too generic | CONFIRMED |
| Accessibility/responsive | Not specified | Not assessed deeply | N/A |
| Design system alignment | Needs visible ownership pattern | Needs ownership/status badges | CONFIRMED |
| Unresolved design decisions | Several | Several | CONFIRMED |

#### Passes 1-7

1. **Information architecture:** Add a persistent active-household indicator before multi-household switching exists. Even if switching is deferred, users must see which household Planner/Shopping acts on.
2. **Interaction states:** Define states for private recipe blocked from planning, copy-required, copy-success, duplicate household copy, no household, expired invite, revoked invite, wrong email, expired recovery link, OAuth callback failure.
3. **User journey:** The critical moment is Planner recipe selection. Current UI cannot treat all visible recipes as equally plannable because the server blocks private recipes.
4. **AI slop risk:** Generic "UI fuer X" bullets are insufficient. Each slice needs one concrete screen/state contract.
5. **Design system alignment:** Use ownership badges consistently: `Privat`, `Haushalt`, `System`, `Nur dieses Geraet`, `Admin`.
6. **Responsive/accessibility:** Future invite/recovery/OAuth screens need keyboard focus order, touch targets, error summaries, and deep-link fallback copy.
7. **Unresolved decisions:** Whether credentials are user-owned, household-owned, device-local, or admin/global must be visible in Settings.

### Engineering Review

#### Scope Challenge

This is a docs-plan change, but the plan depends on live code contracts:

- `loadUserAuthorization()` picks active household by sorted memberships, not by persisted user selection.
- `requireAuth()` blocks Planner/Shopping without active household.
- `POST /api/v1/recipes` defaults to user-owned recipes.
- `POST /api/v1/planner` only accepts household-owned recipes.
- BYOK/platform credential routes are still global or unauthenticated.

#### Architecture Diagram

```text
Supabase Auth Session
        |
        v
src/auth.ts
  resolveUserAuthContext()
        |
        v
src/db-react.ts
  loadUserAuthorization()
  -> user_profiles
  -> household_memberships
  -> activeHouseholdId default
        |
        +--> requireUserAuth()
        |     recipes/extraction jobs
        |     private + household visible recipes
        |
        +--> requireAuth()
              planner/shopping
              active household required
              household-owned recipes only

Credential routes today:
  keys/platforms -> global or disk-backed state
  [needs guard before Auth privacy claims]
```

#### Eng Dual Voices - Consensus Table

| Dimension | Claude/Subagent | Codex | Consensus |
|---|---|---|---|
| Architecture sound? | Mostly, active household implicit | Active household contract missing | CONFIRMED issue |
| Test coverage sufficient? | Missing credential-route tests | Missing bootstrap/credential/Data API tests | CONFIRMED issue |
| Performance risks addressed? | Ingredient search in-memory risk later | Not primary | PARTIAL |
| Security threats covered? | Credential boundary high risk | Credential boundary high risk | CONFIRMED issue |
| Error paths handled? | Ad hoc errors remain | Stable error semantics missing | CONFIRMED issue |
| Deployment risk manageable? | Needs guardrails | Needs guardrails | CONFIRMED issue |

#### Code Quality / DRY / Complexity

No code edits are required by this review. Future implementation should reuse `authErrorPayload()` or a sibling shared API error helper instead of adding more ad hoc `{ error: string }` shapes across `recipes`, `planner`, `extraction`, `keys`, and `platforms`.

#### Test Diagram

| Codepath / UX flow | Existing coverage | Gap | Required test |
|---|---|---|---|
| Missing/malformed bearer token | `test/unit/auth.test.ts`, `planner-auth-routes.test.ts`, `recipes-routes.test.ts` | Good baseline | Keep. |
| New user bootstrap -> default household | Partial via auth helpers | No full bootstrap route/data contract in this plan | Add bootstrap test: profile + default household + owner membership. |
| Active household default with multiple memberships | Unit helper can cover | No explicit future switch contract | Test deterministic owner-first fallback; later switch invalidates query cache. |
| Private recipe selected for Planner | Server blocks via `recipeBelongsToHousehold()` | UI state unspecified | Test private recipe rejected and UI shows copy CTA. |
| Recipe copy private -> household | Not implemented | Full contract missing | Test copied fields, reset fields, duplicate behavior, source metadata, createdBy. |
| BYOK key store/delete | E2E validates basic route | No auth/user isolation | Require auth/user-scope or route disabled/admin-only tests. |
| Cookidoo/Pinterest/Facebook credentials | Unit credential file tests | Global unauthenticated mutation not guarded | Add route tests for forbidden/hidden/global-admin policy. |
| Supabase Recipes Data API | RLS smoke docs exist | Future opening lacks preflight checklist | Smoke anon/auth denied until policies intentionally open. |
| Error-code contract | Auth errors structured | Route validation errors ad hoc | Contract tests exact `code`, `cause`, `fix` for protected/deferred routes. |

#### Performance

The plan can defer performance work for invites/recovery. Collections and multi-household search should include a checkpoint before implementation because `searchRecipesByIngredientsAdvanced()` loads all visible recipes and filters in JS. That is acceptable for small personal libraries, but not for multi-household collections at scale.

### DX Review

#### Product Type

Developer-facing scope: internal API/server/mobile developers plus future operators configuring Supabase Auth redirects, OAuth providers, RLS grants, and credential storage.

#### Developer Journey Map

| Stage | Current risk | Fix |
|---|---|---|
| Read plan | Understands deferred slices | Add revised order and guardrails. |
| Configure Auth | Supabase redirect/recovery/OAuth matrix absent | Add runbook acceptance matrix. |
| Implement recipe copy | Copy semantics missing | Add explicit field contract. |
| Implement invites | Depends on email/deep-link/recovery | Make invite depend on recovery-lite. |
| Implement credentials | Global routes conflict with Auth privacy | Add interim gate or ownership model. |
| Write tests | Test matrix scattered | Use this report's test diagram. |
| Deploy | Data API/Server API distinction can blur | Add preflight: Recipes Data API closed unless explicitly opened. |
| Debug user issue | Error codes inconsistent | Extend structured error registry. |
| Operate/support | Admin boundaries vague | Add metadata-first support model and audit trail. |

#### Developer Empathy Narrative

I am implementing the next slice and need to know whether a recipe, credential, job, planner row, or admin action belongs to a user, a household, the device, or the system. Today the plan tells me the future feature name, but not always the contract. The implementation gets safer when every slice states owner, visibility, active household behavior, error codes, and tests.

#### DX Dual Voices - Consensus Table

| Dimension | Claude/Subagent | Codex | Consensus |
|---|---|---|---|
| Getting started < 5 min? | N/A for users; dev setup needs runbook | Auth redirect setup missing | CONFIRMED issue |
| API naming guessable? | Route scopes unclear for credentials | Error codes unclear | CONFIRMED issue |
| Error messages actionable? | Many ad hoc errors | Need registry/helper | CONFIRMED issue |
| Docs complete? | Runbook stale around Recipes | Need split Server API vs Data API | CONFIRMED issue |
| Upgrade path safe? | Credential migration missing | Guard before privacy claims | CONFIRMED issue |
| Dev env friction-free? | Supabase redirect matrix missing | Need smoke matrix | CONFIRMED issue |

#### DX Scorecard

| Dimension | Score | Reason |
|---|---:|---|
| Getting started / TTHW | 6/10 | Auth basics documented, redirect/recovery/OAuth setup missing. |
| API/route ergonomics | 6/10 | Auth routes structured; credential and validation errors inconsistent. |
| Error/debugging | 5/10 | Auth codes good; many routes still string errors. |
| Documentation | 6/10 | Strong RLS docs; follow-up plan needs sharper contracts. |
| Upgrade/migration | 5/10 | Credential and account deletion/export migration rules missing. |
| Dev tooling/tests | 6/10 | Existing tests good; credential/copy/bootstrap gaps. |
| Ecosystem/admin ops | 5/10 | Supabase setup matrix missing for recovery/OAuth. |
| Measurement/feedback | 4/10 | No activation metric for shared household cooking. |

Overall DX: 5.4/10.

### Error & Rescue Registry

| Failure | User/dev sees | Rescue |
|---|---|---|
| User invited but forgot password | Cannot accept invite without support | Recovery-lite before broad invites. |
| User thinks Cookidoo/Groq credentials are private | Global/shared credential state | Hide/disable or guard credential routes until ownership lands. |
| User picks private recipe in Planner | Server returns not found/rejects | UI copy CTA: "In Haushalt kopieren & planen". |
| User has multiple households | Server silently chooses first sorted membership | State active-household default and defer only switching. |
| Developer opens Recipes Data API too early | Authenticated users can bypass Server API contract | Keep grants revoked; require RLS smoke before opening. |

### Failure Modes Registry

| Severity | Failure mode | Detection | Decision |
|---|---|---|---|
| High | Credential privacy mismatch | Route review + tests | Add pre-auth guardrail task. |
| High | Invite flow without recovery | Product sequence review | Move recovery-lite before broad invites or make invite alpha-only. |
| Medium | Private recipes appear plannable | Planner tests/UI tests | Add copy-required state and tests. |
| Medium | Active household implicit and invisible | Auth helper tests/UI review | Define minimal contract now. |
| Medium | Error codes inconsistent | Contract tests | Add shared error registry/helper. |
| Low | Multi-household recipe search slows | Perf checkpoint | Defer until collections/switching scale. |

### Cross-Phase Themes

**Theme: Visible ownership model** - flagged by CEO, Design, Eng, and DX. Every relevant object should answer: who owns this, who can see it, which household is active, and what happens when I switch/share/delete.

**Theme: Credential boundary before privacy claims** - flagged by all voices. Full credential ownership can be deferred, but global unauthenticated mutation cannot be invisible once Auth ships.

**Theme: Recovery before external invites** - flagged by CEO, Design, Codex, and DX. Invite acceptance depends on the same email/deep-link reliability as recovery.

### User Challenges

These are cases where the review voices recommend changing the stated plan order.

1. **Move recovery-lite before broad household invites.**
   - You said: invites are recommended before password recovery.
   - Review recommends: add recovery-lite before broad invites, or constrain invites to private alpha.
   - Why: invited users are the first external users likely to forget passwords or hit deep-link failures.
   - What context may be missing: if invites are only internal/manual for a short period, original order may be acceptable.
   - If review is wrong: copy-flow and invites ship a little later than necessary.

2. **Move credential boundary earlier than full Credential-Ownership.**
   - You said: Credential-Ownership is sequence item 5 after copy-flow, invites, switching, and recovery.
   - Review recommends: add a minimal credential gate before Auth privacy copy or broad rollout.
   - Why: current BYOK/platform credential routes are global/unauthenticated or disk-backed, so Auth can create a false privacy expectation.
   - What context may be missing: if credential UI is hidden in the Auth-Onboarding release, this can remain a documented guardrail instead of implementation work.
   - If review is wrong: some credential polish is done earlier than needed.

### Taste Decisions

1. **Recipe Copy vs Recovery as first follow-up.** Recommendation: keep Recipe Copy-Flow first for logged-in core UX, but make Recovery-lite a launch gate before invites. Both orders are viable if invites stay internal.
2. **Household switcher timing.** Recommendation: define the server contract now, defer full switcher UI until real multi-household use exists.
3. **Data API placement.** Recommendation: remove direct Recipes Data API from product roadmap ordering and treat it as an architecture decision gate.

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Keep Auth-Onboarding small | Mechanical | P3/P5 | Account/login/bootstrap remain the bottleneck. | Pull all follow-ups into Auth slice. |
| 2 | CEO | Add credential-boundary guardrail before privacy claims | User Challenge | P1/P2 | Global credential routes conflict with visible Auth privacy. | Leave Credential-Ownership fully late with no guard. |
| 3 | CEO | Recovery-lite before broad invites | User Challenge | P1/P6 | External invitees need self-serve recovery. | Invite broadly before reset path exists. |
| 4 | Design | Add visible ownership model | Mechanical | P1/P5 | Users need owner/scope signals for trust and actionability. | Keep ownership only in backend model. |
| 5 | Eng | Define active-household server contract now | Mechanical | P5 | Code already chooses an active household; plan should state it. | Defer all active-household contract work. |
| 6 | Eng | Keep Recipes Data API closed until explicit need | Mechanical | P3/P4 | Server API already carries ownership contract. | Open Data API as product follow-up by default. |
| 7 | DX | Add stable non-auth error registry | Mechanical | P1/P5 | Clients need codes beyond auth middleware. | Continue ad hoc `{ error: string }` route errors. |
| 8 | Eng | Add test matrix per follow-up | Mechanical | P1 | Prevents auth boundary regressions. | Rely only on existing route tests. |

### Revised Recommended Order

1. Recipe Copy-Flow fuer `privat -> Haushalt`, scoped as "private Recipe plannable machen".
2. Credential-boundary guardrail: hide/disable/guard global credential routes or mark them admin/local-only before Auth privacy copy.
3. Password recovery-lite and Supabase redirect/email runbook.
4. Haushaltseinladungen, initially narrow: one recipient joins one household and can plan/add one recipe.
5. Active-household contract now; full household switching UI once multiple households exist.
6. Credential-Ownership full model and rotation/rate limits.
7. Collections/Favoriten.
8. Account export/deletion policy and manual support path before non-internal beta.
9. Admin surface.
10. Direct Recipes Data API only after a concrete offline/sync/client-write need.

### Implementation Tasks

- [ ] **P1 (human: ~0.5 day / CC: ~45 min) - Credential boundary guardrail** - Decide whether `/api/v1/keys`, Cookidoo, Pinterest, and Facebook credential mutation routes are hidden, disabled, admin-only, or user-scoped before Auth privacy claims.
  - Files: `src/routes/keys.ts`, `src/routes/platforms.ts`, `mobile/app/(tabs)/settings.tsx`, `docs/auth-runbook-route-privacy.md`
- [ ] **P1 (human: ~0.5 day / CC: ~1 h) - Active household contract** - Document and test current default behavior: server picks deterministic active household; no switch/header yet; missing household returns `no_household`.
  - Files: `src/db-react.ts`, `src/auth.ts`, `test/unit/auth.test.ts`, `test/unit/planner-auth-routes.test.ts`
- [ ] **P1 (human: ~1 day / CC: ~2 h) - Recipe copy contract** - Specify copied/reset fields, duplicate behavior, source metadata, `createdBy`, `notes`, `rating`, `tried`, `pdf_created`, and Planner CTA.
  - Files: `src/db-react.ts`, `src/routes/recipes.ts`, `src/routes/planner.ts`, `mobile/app/(tabs)/planner.tsx`
- [ ] **P2 (human: ~1 day / CC: ~2 h) - Recovery-lite runbook** - Add Supabase Auth URL, mobile deep-link, web redirect, email template, expired-link and staging/prod smoke matrix before broad invites.
  - Files: `docs/auth-runbook-route-privacy.md`, Auth onboarding plan/docs
- [ ] **P2 (human: ~0.5 day / CC: ~1 h) - Error-code registry** - Extend structured `{ error: { code, message, cause, fix } }` beyond auth middleware for validation, credentials, jobs, recipe-not-household, upload, and rate limits.
  - Files: `src/auth.ts` or new API error helper, `src/routes/*.ts`, `test/e2e/contract-api.test.ts`
- [ ] **P2 (human: ~0.5 day / CC: ~45 min) - Server API vs Data API docs split** - Update docs so current Server API Recipe ownership is not confused with future Supabase Data API opening.
  - Files: `docs/auth-runbook-route-privacy.md`, `docs/supabase-data-api-readiness.md`
- [ ] **P3 (human: ~0.5 day / CC: ~30 min) - Performance checkpoint** - Before Collections/Household switching, decide whether ingredient search needs pagination or DB-side indexing.
  - Files: `src/db-react.ts`, future Collections plan

### Test Plan Artifact

Written separately to:

`/home/patrick/.gstack/projects/dacown87-rezepti/main-test-plan-20260607-auth-onboarding-deferred-followups.md`

### Review Scores

- CEO: 7/10 after revised sequencing; main concern is privacy/support sequencing.
- Design: 5/10; needs visible ownership and missing states.
- Eng: 6/10; architecture foundation exists, but active-household and credential contracts need tightening.
- DX: 5.4/10; strong docs base, but error-code, redirect, credential, and Data API contracts need sharper acceptance criteria.

### Final Recommendation

Approve the plan only with the revised order and guardrails above. The original plan is directionally right, but the current ordering underestimates two user-visible risks: external users need recovery before invites scale, and authenticated UI must not imply private credentials while credential routes remain global or unauthenticated.
