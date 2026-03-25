# Cleanup Plan — Clean Start

**Branch:** `cleanup`
**Datum:** 2026-03-25

---

## Ziel

Repo bereinigen: toten Code, veraltete Doku, Legacy-Überbleibsel und doppelte Dateien entfernen. Saubere Ausgangsbasis für weiteres Feature-Development.

---

## Dateien löschen

### Sicherheitsrelevant
- [ ] `LoginData` — enthält Groq API Key + Northflank Token (ist gitignored, aber lokal vorhanden)

### Veraltete Dokumentation
- [ ] `AGENTS.md` — Veraltet: referenziert DeepSeek V3.2, falscher Branch `ph/Test`. Vollständig von `CLAUDE.md` abgedeckt.
- [ ] `REACT_API.md` — API-Dokumentation bereits vollständig in `CLAUDE.md` enthalten.
- [ ] `components.md` — Versions-Tracker für Pakete, hoher Wartungsaufwand, kein praktischer Nutzen.
- [ ] `DOCKER_DEPLOYMENT.md` — Referenziert Legacy-Profiles (`prod`, `react-prod`), teils veraltet. Relevante Infos sind in `CLAUDE.md` und `docker-compose.yml`.

### Einmalige Scripts
- [ ] `scripts/migrate-to-react-db.ts` — Einmalige Migration von Legacy-DB zu React-DB. Legacy-DB (`rezepti.db`) ist gelöscht, Script ist obsolet.
- [ ] `scripts/` Ordner — nach Löschen der einzigen Datei leeren Ordner ebenfalls entfernen

### Tote Tests
- [ ] `test/unit/key-manager.test.ts` — Importiert `key-manager.interface.ts` (bereits gelöscht). Bricht den Test-Run.
- [ ] `test/react-components/` (ganzer Ordner) — Duplicate-Tests identisch zu `frontend/src/components/*.test.tsx`, aber mit falschen relativen Imports. Nicht im vitest include-Pattern (`.tsx` nicht als Backend-Tests inkludiert).
- [ ] `test/utils/performance-test.ts` — Standalone-Script (kein echter Test), einziger Import in `test/fixtures/test-data.ts` als inaktive Referenz.
- [ ] `test/setup-react.ts` — Gehörte zu `vitest.react.config.ts` (bereits gelöscht). Verwaist.

### Implementierte Pläne (bereits umgesetzt)
- [ ] `docs/superpowers/plans/2026-03-18-cookidoo-integration.md` — Cookidoo-Fetcher implementiert in `src/fetchers/cookidoo.ts`.
- [ ] `docs/superpowers/plans/2026-03-19-docker-setup.md` — Docker-Setup abgeschlossen.
- [ ] `docs/superpowers/specs/2026-03-18-cookidoo-integration-design.md` — Design-Spec für implementiertes Feature.
- [ ] `docs/superpowers/specs/2026-03-19-docker-setup-design.md` — Design-Spec für implementiertes Feature.

---

## Dateien behalten

- `opencode.json` — Aktiv genutzte OpenCode-Konfiguration.
- `src/fetchers/CLAUDE.md` — Wertvolle Notizen zur Cookidoo OAuth-Integration.
- `docs/superpowers/plans/2026-03-24-ingredient-scaling.md` — Noch nicht implementiert.
- `docs/superpowers/plans/2026-03-24-recipe-display-improvements.md` — Noch nicht implementiert.
- `docs/superpowers/plans/2026-03-25-ui-improvements.md` — Noch nicht implementiert.
- `docs/superpowers/specs/2026-03-24-ingredient-scaling-design.md` — Noch nicht implementiert.

---

## Dateien aktualisieren

### `CLAUDE.md`
- [ ] "Active branch"-Zeile (Zeile 129) **komplett entfernen** — ist ein Anti-Pattern, veraltet sofort und führt AI-Assistenten zu falschen Commits
- [ ] Cleanup-Section (`## Cleanup (March 2026)`) erweitern oder als abgeschlossen markieren
- [ ] Verweise auf gelöschte Dateien entfernen (z.B. `test/unit/db-manager.test.ts` schon drin, weitere prüfen)

### `README.md`
- [ ] Verweis auf `DOCKER_DEPLOYMENT.md` entfernen (Zeile ~75: `Volle Dokumentation → Siehe DOCKER_DEPLOYMENT.md`)

### `test/fixtures/test-data.ts`
- [ ] `performanceTestData` Export (Zeile 326) entfernen — wird nach Löschen von `performance-test.ts` zu totem Code

### `package.json` (scripts)
- [ ] `docker:legacy` entfernen — Legacy-Profil (`prod`) für alte nicht-React Version
- [ ] `db:migrate` entfernen — Script gelöscht (`scripts/migrate-to-react-db.ts`)
- [ ] `test:performance` entfernen — Script gelöscht (`test/utils/performance-test.ts`)
- [ ] `docker:restore` entfernen — hartcodiertes Datum `20260322`, nie wiederverwendbar

---

## Reihenfolge der Umsetzung

1. `LoginData` löschen (Sicherheit zuerst)
2. Veraltete Doku löschen (AGENTS.md, REACT_API.md, components.md, DOCKER_DEPLOYMENT.md)
3. Tote Test-Dateien löschen (inkl. `performanceTestData` Export in test-data.ts)
4. Einmalige Scripts löschen + leeren `scripts/` Ordner entfernen
5. Implementierte Pläne/Specs löschen
6. `CLAUDE.md` aktualisieren (Active branch-Zeile entfernen, Cleanup-Section)
7. `README.md` aktualisieren (DOCKER_DEPLOYMENT.md Verweis entfernen)
8. `package.json` Scripts aufräumen (inkl. docker:restore entfernen)
9. Tests laufen lassen: `npm test -- --run --exclude="test/e2e/**"`
10. Commit

---

## Erwartetes Ergebnis

- ~15 Dateien/Ordner weniger
- Keine veralteten Branch-Referenzen
- Keine toten Test-Imports
- Bereinigte package.json Scripts
- Repo-Struktur klar und konsistent
