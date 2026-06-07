# Auth Onboarding Phase 2 Design Review Plan

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

## /autoplan Phase 2: Design Review

Status: Complete.
Design scope: yes.

### Design Scope Assessment

Design completeness before review: 5/10. The plan names the right states, but the
original phases still use placeholders like "Login-Hinweis", "sichtbarer
Account-Einstieg" and "pruefen". For the accepted workspace premise, that is not
specific enough.

Existing UI patterns:

- Tab navigation exists in [mobile/app/(tabs)/_layout.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/_layout.tsx:39).
- The Account card exists, but is embedded in dense Settings content at
  [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx:629).
- API error envelopes are preserved by [mobile/utils/api.ts](/home/patrick/Projekte/rezepti/mobile/utils/api.ts:30).
- Planner has a known false-empty trap at
  [mobile/app/(tabs)/planner.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/planner.tsx:35).

### Design Dual Voices

#### CLAUDE SUBAGENT (Design - independent review)

The designer found seven issues: account entry is buried in Settings; protected
screen states are codes, not user journeys; signup confirmation and partial account
states are underdesigned; planner has a hidden empty-state trap; the plan does not
decide whether Account is a card or a focused screen; success state is too thin; and
copy specificity is uneven.

#### CODEX SAYS (Design - UX challenge)

Codex found the plan architecturally solid but UX-underdetermined. It recommended
promoting the CEO critique into the executable phases: workspace-first hierarchy,
full account/workspace state machine, explicit web account entry, accessibility
requirements, concrete copy/CTA decisions, no visible role labels,
and shared guarded-screen handling.

#### Design Litmus Scorecard

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Information hierarchy serves user | No | No | CONFIRMED |
| Loading/empty/error/success/partial states covered | Partial | Partial | CONFIRMED |
| User journey coherent | Partial | Partial | CONFIRMED |
| Specific UI decisions present | No | No | CONFIRMED |
| Responsive/web strategy intentional | No | No | CONFIRMED |
| Accessibility specified | Not enough | No | CONFIRMED |
| Implementation ambiguity low | No | No | CONFIRMED |

Consensus: 7/7 confirmed design concerns, 0 disagreements.

### Pass 1: Information Hierarchy - 6/10

The first thing a new or signed-out user should see is not "Auth" or "Haushalt",
but the benefit: "Deine Rezepte, Einkaufsliste und Planung werden in deinem
Workspace gespeichert." Account status comes second, technical workspace status third,
and privacy/deferred capabilities fourth.

Decision: Add a dedicated Account & Workspace route/screen. Use `/account` or the
closest Expo Router equivalent, link it from web/tab navigation and guarded states,
and keep Settings as a secondary link only.

### Pass 2: State Coverage - 6/10

Required account/workspace state contract:

| State | Title | Body | Primary CTA | Secondary CTA |
|---|---|---|---|---|
| Signed out | `Anmelden oder Account erstellen` | `Speichere deine Rezepte, Einkaufsliste und Planung in deinem Workspace.` | `Anmelden` | `Account erstellen` |
| Submitting | `Account wird geprueft` | `Wir melden dich an und richten deinen Workspace ein.` | disabled busy button | none |
| Confirmation required | `E-Mail bestaetigen` | `Bestaetige deine Adresse und melde dich danach an, damit dein Workspace eingerichtet wird.` | `E-Mail erneut senden` | `Erneut anmelden` |
| Confirmation resend sent | `E-Mail erneut gesendet` | `Pruefe dein Postfach. Falls die Adresse existiert, senden wir dir eine neue Bestaetigung.` | `Erneut anmelden` | none |
| Password reset | `Passwort zuruecksetzen` | `Gib deine E-Mail ein. Falls ein Account existiert, senden wir dir einen Link.` | `Link senden` | `Zurueck zur Anmeldung` |
| Bootstrap running | `Workspace wird eingerichtet` | `Profil und Starter-Workspace werden vorbereitet.` | disabled busy button | none |
| Ready | `Workspace bereit` | `Angemeldet als <email>. Deine Rezepte, Einkaufsliste und Planung sind gespeichert.` | `Rezepte ansehen` | `Abmelden` |
| Bootstrap failed | `Workspace konnte nicht eingerichtet werden` | show server `message/cause/fix` when safe | `Erneut versuchen` | `Abmelden` |
| Session expired | `Session abgelaufen` | `Melde dich erneut an, damit deine Daten geschuetzt bleiben.` | `Erneut anmelden` | none |

Partial states must be explicit: account exists but no session means confirmation
state; profile exists but household/membership failed means bootstrap failed with
retry; stale session with existing visible data should preserve data where possible
and show a session banner/CTA instead of replacing everything with empty state.

Mobile signup contract:

```ts
type SignUpWithPasswordResult =
  | { status: "session_ready"; session: Session }
  | { status: "confirmation_required"; email: string }
  | { status: "signup_failed"; error: Error };
```

Only `session_ready` calls `bootstrapAccount()`.

`confirmation_required` supports resend with loading, neutral success, error, and
rate-limit states. Password reset uses the same neutral success posture. Confirmation
and reset redirects use configured Expo/Supabase deep links for local and staging.

### Pass 3: User Journey - 6/10

Target emotional arc:

```text
Blocked screen or Settings
  -> clear reason to sign in
  -> account created or login accepted
  -> workspace setup visible
  -> ready state confirms saved personal workspace
  -> user returns to original intent or sees "Rezepte ansehen" / "Erstes Rezept hinzufügen"
```

If auth started from a guarded screen/action, preserve a return intent and navigate
back after successful bootstrap. If no return intent exists, Account & Workspace shows
primary next actions such as `Rezepte ansehen`, `Planner oeffnen`, `Einkaufsliste
oeffnen`, or `Erstes Rezept hinzufuegen`.

### Pass 4: Specificity - 7/10

Concrete UI decisions:

- Use `Account & Workspace` for the surface title.
- Use workspace language in UI; keep household wording in server/data docs.
- Do not show role labels in this slice. Show user-facing account/workspace status
  instead: `Workspace bereit`, `Starter-Workspace`, or setup/error state.
- Replace generic alerts for auth failures with inline errors. Alerts may remain for
  destructive/confirmation flows, not normal form validation.
- Every guarded auth/setup state gets a direct account CTA.

### Pass 5: Responsive/Web Strategy - 6/10

Phase 5 must stop saying "falls noetig." Decision: web needs a visible account entry.
Required implementation: stable `/account` route/screen or closest Expo Router
equivalent, linked from web/tab navigation, Settings, and guarded states. Do not use
Settings as the primary account surface for this slice.

Mobile and web must both be checked at narrow and desktop widths.

### Pass 6: Accessibility - 5/10

Add acceptance criteria:

- Account mode toggle is keyboard reachable and screen-reader named.
- Inputs have labels, not only placeholders.
- Inline errors are associated with their fields where practical.
- Busy buttons are disabled and communicate loading without relying on color.
- Confirmation/setup-failed messages use accessible status/error text.
- Touch targets meet mobile expectations.
- Error/success/warning contrast is checked in light and dark themes.

### Pass 7: Visual / Copy Consistency - 6/10

Copy matrix:

| Code / situation | User copy | Action |
|---|---|---|
| `auth_missing` | `Melde dich an, um deine Rezepte, Einkaufsliste und Planung zu sehen.` | `Anmelden` |
| `token_expired` | `Deine Session ist abgelaufen.` | `Erneut anmelden` |
| `no_household` | `Dein Workspace ist noch nicht eingerichtet.` | `Workspace einrichten` / retry bootstrap |
| bootstrap 500/network | `Workspace konnte nicht eingerichtet werden.` | `Erneut versuchen` |
| real empty recipes | `Noch keine Rezepte gespeichert.` | `Erstes Rezept hinzufuegen` |
| real empty shopping | `Deine Einkaufsliste ist leer.` | `Artikel hinzufuegen` |

This prevents "auth problem" and "empty product state" from sharing the same visual
language.

### Design Implementation Tasks

- [ ] **DES-T1 (P1, human: ~2h / CC: ~20min) — Account route** — Add a dedicated Account & Workspace route/screen for mobile and web.
  - Surfaced by: Design dual voices, Pass 1 and Pass 5.
  - Files: `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/settings.tsx`, new `mobile/app/account.tsx` or closest Expo Router equivalent.
  - Verify: signed-out user can find auth from web/mobile navigation and guarded-state CTAs without hunting through technical settings; Settings links to Account & Workspace.
- [ ] **DES-T2 (P1, human: ~2h / CC: ~20min) — Workspace status model** — Implement the account/workspace state table with inline copy and CTAs.
  - Surfaced by: Pass 2 and Pass 3.
  - Files: Account & Workspace route/screen, `mobile/app/(tabs)/settings.tsx` link, `mobile/utils/auth.ts`.
  - Verify: tests cover signed out, confirmation required, bootstrap running, ready, failed, expired.
- [ ] **DES-T3 (P1, human: ~2h / CC: ~20min) — Guarded screen contract** — Create shared auth/setup UI mapping for protected screens.
  - Surfaced by: Pass 7 and known planner false-empty trap.
  - Files: `mobile/utils/api.ts`, `mobile/app/(tabs)/planner.tsx`, recipe/shopping screens.
  - Verify: 401/403 never render as real empty data.
- [ ] **DES-T4 (P1, human: ~1h / CC: ~10min) — Accessibility acceptance** — Add accessible labels/status/error behavior to auth controls.
  - Surfaced by: Pass 6.
  - Files: `mobile/app/(tabs)/settings.tsx`, account route if added.
  - Verify: labels, field-associated errors, busy/disabled buttons, focus/status behavior, and touch targets pass mobile unit tests or manual web keyboard/screen-reader smoke.

Phase 2 complete. Codex: 7 concerns. Claude subagent: 7 issues. Consensus:
7/7 confirmed, 0 disagreements.
