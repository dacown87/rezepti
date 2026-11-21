# GEMINI.md (Antigravity-Regeln für RecipeDeck)

Maßgebliche Projekt- und Arbeitsregeln stehen in `AGENTS.md` und `CLAUDE.md` — beide vor jeder Aufgabe beachten, Inhalte dort nicht duplizieren. Operative Arbeitsliste: `TODO.md`. Projektgedächtnis (nur lesen, Datumsstände gegen Code prüfen): `docs/agent-memory/MEMORY.md`. Vor Debugging: `docs/PROJECT_LEARNINGS.md` und `docs/debugging-lessons.md`.

## Feste Projektregeln

- **Sprache:** Mit dem Nutzer immer auf Deutsch antworten; Code, Identifier und Commit-Präfixe auf Englisch.
- **Niemals eigenständig mergen:** Branch, Commit, Push und PR sind erlaubt; Merge nur nach ausdrücklicher Freigabe.
- **Verifikation belegen:** Vor dem Push das Script ausführen, das CI ausführt (siehe `.github/workflows/ci.yml`), nicht nur Teilschritte. Verifikationsläufe nie pipen (`cmd > run.log 2>&1; echo "EXIT=$?"`). Wenn etwas lokal nicht lief, offen benennen.
- **Produkt- und Betriebsgrenzen:** Nicht kommerziell (AGPL-3.0, keine Monetarisierung); Supabase bleibt Free-Plan; keine Geheimnisse in Repo, Commits, PRs oder Logs.
- **Datenbank & Sicherheit:**
  - Production-Migrationen ausschließlich über den Workflow *Apply Supabase Migrations*.
  - Jede Query auf `recipes` geht durch `recipeVisibilityForAuth(auth)`.
  - Jede neue User-ID-Spalte in `private.delete_user_account` und `COVERED_USER_COLUMNS` (`scripts/supabase/account-deletion-smoke.ts`) eintragen.
  - Sicherheitsrelevante Antworten (z. B. `/api/v1/share-invites/:token`) nicht verbreitern.
- **Erzwungene Duplikate & Build-Artefakte:** `ingredient-category-domain.ts` und Bug-Report-Enums immer gleichzeitig in `src/` und `mobile/` ändern (Drift-Tests). `public/` ist Build-Artefakt und wird nicht committet (`git status` darf keine `public/_expo/`-Einträge zeigen).

## Parallelarbeit mit Claude Code

- **Eigener Worktree & Branch:** Vor jeder Code-Änderung vom Haupt-Checkout aus anlegen (`git worktree add ../rezepti-antigravity -b feat/<thema>`). Nie im Haupt-Checkout arbeiten.
- **Worktree-Setup:** Einmalig `npm ci` (bei Frontend-Arbeit zusätzlich `npm --prefix mobile ci`); `.env` aus dem Haupt-Checkout kopieren, ohne ihren Inhalt auszugeben.
- **Ports & Docker:** Dev-Server mit `PORT=3100 npm run dev` starten; kein `docker compose up`, solange Claude läuft.
- **Git-Hygiene:** Vor `git add`, `stash`, `checkout`, `reset` immer frisch `git status` prüfen, nur gezielt einzelne Pfade stagen, fremde Commits nicht wegrebasen.
- **Thementrennung & Doku:** Arbeitsbereich vorab mit dem Nutzer abstimmen und nichts anfassen, woran Claude gerade arbeitet. Neue Learnings nach `docs/PROJECT_LEARNINGS.md` oder `docs/debugging-lessons.md` schreiben (nicht nach `docs/agent-memory/`).
