# Cleanup Plan — Clean Start

**Branch:** `cleanup`
**Datum:** 2026-03-25
**Status:** Archiviert am 2026-06-02

Dieser Plan ist nicht mehr als aktive TODO-Liste zu verwenden. Audit 2026-06-02:
Fast alle urspruenglich offenen Datei-/Script-Loeschpunkte sind bereits erledigt oder nicht mehr zutreffend. `AGENTS.md` existiert heute als aktuelle Projektanweisung mit gstack-/Codex-Instruktionen und ist kein Loeschziel mehr. `CLAUDE.md` enthaelt die Cleanup-Section bereits als abgeschlossen. Verbleibende Wartungsarbeit wird in `TODO.md` oder neueren Plaenen gefuehrt.

---

## Ziel

Repo bereinigen: toten Code, veraltete Doku, Legacy-Überbleibsel und doppelte Dateien entfernen. Saubere Ausgangsbasis für weiteres Feature-Development.

---

## Dateien löschen

### Sicherheitsrelevant
- Archiviert: `LoginData` — existiert im Audit 2026-06-02 nicht mehr.

### Veraltete Dokumentation
- Archiviert/nicht mehr zutreffend: `AGENTS.md` — existiert, ist aber heute die aktuelle Projektanweisung und kein Loeschziel.
- Archiviert: `REACT_API.md` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `components.md` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `DOCKER_DEPLOYMENT.md` — existiert im Audit 2026-06-02 nicht mehr.

### Einmalige Scripts
- Archiviert: `scripts/migrate-to-react-db.ts` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `scripts/` Ordner entfernen — nicht mehr als isolierter Loeschpunkt bewertet; aktuelle Scripts werden separat gepflegt.

### Tote Tests
- Archiviert: `test/unit/key-manager.test.ts` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `test/react-components/` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `test/utils/performance-test.ts` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `test/setup-react.ts` — existiert im Audit 2026-06-02 nicht mehr.

### Implementierte Pläne (bereits umgesetzt)
- Archiviert: `docs/superpowers/plans/2026-03-18-cookidoo-integration.md` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `docs/superpowers/plans/2026-03-19-docker-setup.md` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `docs/superpowers/specs/2026-03-18-cookidoo-integration-design.md` — existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `docs/superpowers/specs/2026-03-19-docker-setup-design.md` — existiert im Audit 2026-06-02 nicht mehr.

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
- Archiviert: "Active branch"-Zeile entfernen — im Audit 2026-06-02 nicht mehr gefunden.
- Archiviert: Cleanup-Section (`## Cleanup (March 2026)`) — in `CLAUDE.md` bereits als abgeschlossen markiert.
- Archiviert: Verweise auf geloeschte Dateien entfernen — keine aktive Arbeit aus diesem Plan.

### `README.md`
- Archiviert: Verweis auf `DOCKER_DEPLOYMENT.md` entfernen — im Audit 2026-06-02 nicht mehr gefunden.

### `test/fixtures/test-data.ts`
- Archiviert: `performanceTestData` Export entfernen — im Audit 2026-06-02 nicht mehr gefunden.

### `package.json` (scripts)
- Archiviert: `docker:legacy` entfernen — Script existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `db:migrate` entfernen — Script existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `test:performance` entfernen — Script existiert im Audit 2026-06-02 nicht mehr.
- Archiviert: `docker:restore` entfernen — Script existiert im Audit 2026-06-02 nicht mehr.

---

## Historische Reihenfolge der Umsetzung

Die folgende Liste ist nur noch historischer Kontext aus dem urspruenglichen Plan vom 2026-03-25.

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

## Historisch erwartetes Ergebnis

- ~15 Dateien/Ordner weniger
- Keine veralteten Branch-Referenzen
- Keine toten Test-Imports
- Bereinigte package.json Scripts
- Repo-Struktur klar und konsistent
