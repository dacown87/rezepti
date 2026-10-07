# Grobplan: Workspace-Einladungen und Multi-Workspace-Wechsel (Paket W)

> **Status: GROBPLAN — muss vor der Umsetzung ausgearbeitet werden** (Datenmodell, RLS, UX, Akzeptanzkriterien, Tests). Kein Code, bevor der Detailplan steht und freigegeben ist.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → Auth Onboarding Follow-ups → *Spaeter* („Workspace-Einladungen", „Multi-Workspace-Wechsel"). Vorarbeit (Stichpunkte, Juni 2026): [auth-onboarding-deferred-followups-plan](2026-06-07-auth-onboarding-deferred-followups-plan.md) Folge-Slices 4 und 5; verwandt: [Multi-Household-Target-Picker](recipes-sharing-followups/2026-07-08-slice-2-multi-household-target-picker-plan.md).

## Ziel
Ein Nutzer kann andere in seinen Haushalt einladen und zwischen mehreren Haushalten wechseln. Heute hat jeder Nutzer genau einen Default-Haushalt (`user_default_households`), Mitgliedschaften (`household_memberships` mit `role`) existieren schon im Schema.

## Grober Umfang (zwei Slices, Reihenfolge: erst Einladungen, dann Wechsel)
1. **W1 Einladungen** — Einladungsmodell (E-Mail-gebunden wie Rezept-Einladungen, nur `token_hash` speichern), Versand ueber `src/mail.ts`/Brevo, Annahme-Flow inkl. Konto-Erstellung, Rollen (owner/member), Austritt/Entfernen.
2. **W2 Wechsel** — aktiven Haushalt in der UI waehlen und persistieren, Server-Kontrakt fuer nicht-Default-Haushalt (`activeHouseholdId` in `src/auth.ts`), Query-Cache und SW-Cache je Haushalt trennen, Planner/Shopping/Haushaltsrezepte nach aktivem Haushalt.

## Offene Fragen (fuer den Detailplan)
- Wiederverwendung der `recipe_share_invites`-Mechanik oder eigene Tabelle?
- Was passiert mit dem eigenen Default-Haushalt beim Beitritt (behalten, zusammenfuehren)?
- Konto-Loeschung: heute `409 household_has_other_members` — Uebergabe der Owner-Rolle noetig?
- Offline-Queue und per-User-Persistenz bei Haushaltswechsel.
- Datenschutztext (neue Verarbeitung: E-Mail Dritter).

## Abhaengigkeiten
Mailversand (Brevo, Tageslimit 300 auf Free); Account-Loeschung (`private.delete_user_account`, Deletion-Smoke); RLS-Smoke.
