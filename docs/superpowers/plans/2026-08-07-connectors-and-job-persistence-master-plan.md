# Master-Plan: Connectors und Job-Robustheit

**Stand:** 2026-08-07, überarbeitet nach `/plan-eng-review` · **Status:** ENTWURF

Klammer über zwei Arbeitsstränge, die beim Doku-Abgleich am 2026-08-07 als
belegte Baustellen aufgefallen sind.

> **Was dieses Dokument nicht ist.** Es ersetzt weder `TODO.md` (die operative
> Arbeitsliste) noch den Obsidian-Phasenplan. Es klammert genau zwei Stränge und
> endet, wenn beide erledigt sind. Der kritische Pfad des Projekts bleibt der
> Brevo-Mailversand aus `TODO.md`.

## Die beiden Teilpläne

| Plan | Inhalt |
|---|---|
| [Pinterest/Facebook Connectors](2026-08-07-pinterest-facebook-per-user-connectors-plan.md) | Globale Disk-Credentials entfernen, ehrliches Scheitern, optional Per-User-Credentials |
| [Job-Robustheit](2026-08-07-job-persistence-plan.md) | Sichtbare Fehler, Concurrency-Limit, optional Persistenz |

## Warum zusammen betrachtet

Technisch unabhängig, gemeinsamer Ursprung: die Multi-User-Umstellung im Juni
2026 hat beide Bereiche mit Annahmen aus der Single-User-Zeit zurückgelassen.

- Die Connectors lasen **einen globalen Credential-Satz** von Disk. `a6614e7`
  hat die *Routen* auf `501` gesetzt — die *Fetcher* lesen die Dateien bis
  heute.
- Die Jobs liegen in einer **prozesslokalen Map**, weil `857606f` sie
  ausdrücklich als „transient" eingestuft hat.

Beide sind nicht kaputtgegangen, sondern nicht mitgezogen worden.

## Was die Engineering-Review geändert hat

Die erste Planfassung stellte in beiden Strängen die teure Infrastruktur nach
vorne. Die Prüfung gegen den Code hat das umgedreht:

1. **Die Sicherheitslücke lag hinter zwei offenen Entscheidungen.** Die
   globalen Disk-Credentials in `pinterest.ts` und `facebook.ts` sind ~15 Zeilen
   Löschung, blockiert durch nichts, und `data/facebook-cookies.txt` ist nicht
   einmal gitignored. Das ist jetzt Slice 0.
2. **Der Nutzer sieht keinen 404, sondern einen Endlos-Spinner.**
   `extract.tsx:195` verwirft jeden non-ok-Poll. Die Annahme der ersten Fassung
   war falsch.
3. **Fehlertexte werden nie angezeigt.** `extract.tsx:234` liest
   `status.result?.error`, der Server schreibt top-level `error`, und das
   Client-Interface kennt das Feld nicht. Betrifft **jeden** fehlgeschlagenen
   Import, nicht nur den Neustart-Fall. Zwei Zeilen.
4. **RLS scopet hier gar nichts.** Der Server verbindet als Rolle `postgres`
   und umgeht RLS. Das Cookidoo-Muster ist ein Deny-all für die
   PostgREST-Data-API — richtig, aber kein Per-User-Scoping. Beide Pläne hatten
   ein Akzeptanzkriterium, das vakuum bestanden hätte.
5. **Der Start-Sweep war falsch herum.** Bei einem Rolling Deploy hätte die
   neue Instanz die lebenden Jobs der alten abgeschossen. Ein
   SIGTERM-Handler löst dasselbe Problem korrekt und ohne Heartbeat.

## Reihenfolge

```
SOFORT, blockiert durch nichts, ~1 Tag zusammen
├── Connectors  Slice 0    globale Disk-Credentials entfernen (Vorsorge)
├── Connectors  Slice 0a   Pinterest scheitert ehrlich
├── Connectors  Slice 0b   yt-dlp aktualisieren + Health-Check
├── Connectors  Slice 0c   ADR schreiben, Roadmap nachziehen
├── Jobs        Slice 1    Client: Fehlertext + Poll-Abbruch
├── Jobs        Slice 2    Concurrency-Limit + Cleanup scharfschalten
└── Jobs        Slice 3    Cancel stoppt die Pipeline wirklich

ENTSCHIEDEN, unabhängig von Pinterest, ~4 h
└── Connectors  Slice E    Credentials verschlüsselt at rest, inkl. Cookidoo

DANACH, wenn der Schmerz bleibt
└── Jobs        Slice 4-6  Tabelle, Write-Through, SIGTERM

NUR nach bestandener Messung
└── Connectors  Slice 1-4  Credential-Tabelle, Routen, Fetcher, UI
```

Die sofortigen Slices sind zusammen etwa ein Tag und decken den Großteil des
Nutzens beider Stränge ab. Das war in der ersten Fassung nicht sichtbar.

## Offene Entscheidungen

**A — Pinterest: lohnt der Credential-Stack überhaupt?**
Vorgelagert eine Messung von zehn Minuten: Gibt `GET /v5/pins/{id}` mit einem
echten Token auch **fremde** öffentliche Pins heraus? Braucht einen
Pinterest-Developer-Account. Fällt das durch, ist der Aufbau wertlos — ein Pin
verlinkt fast immer auf eine Rezeptseite, die der Web-Fetcher schon kann.

**B — Facebook-Cookies: ENTSCHIEDEN am 2026-08-07 — verschlüsselt at rest.**
Cookidoo wandert im selben Zug mit; kein Klartext-Credential bleibt in der
Datenbank zurück. Details: Slice E im Connector-Plan.

## Belege

Gemessen am 2026-08-07, nicht aus dem Code abgeleitet.

| Befund | Beleg |
|---|---|
| Pinterest liefert anonym keine Pin-Daten | 2 Pins, je ~1,08 MB App-Shell, keine `og:`-Tags, `__PWS_DATA__` ohne Pin-Inhalt, yt-dlp `403` |
| Der Fetcher importiert JavaScript als Rezept | `s.pinimg.com/…/accessibility-*.mjs`, 6000 Zeichen minifiziertes JS als `textContent`; Guard an 3 Stellen dupliziert |
| Globale Credentials sind im Fetcher noch aktiv | `pinterest.ts:12-16,28-41,312-315`, `facebook.ts:12-15,88`; `docker-compose` mountet `./data` |
| Auf Production aber **nicht scharf** | `northflank exec` → `/app/data: No such file or directory`, keine der beiden Dateien vorhanden |
| Cookie-Datei nicht gitignored | `.gitignore:5-11` deckt sie nicht ab |
| Lokales yt-dlp zwei Jahre alt | `2024.04.09` vs. `2026.7.4`; Dockerfile baut mit `--upgrade` |
| Client verwirft 404 | `extract.tsx:195` `if (!res.ok) return;`, keine Poll-Obergrenze |
| Fehlertexte unsichtbar | `extract.tsx:234` liest `result?.error`, `job-manager.ts:136` schreibt top-level |
| `config.jobs` tot | `grep -rn "config.jobs" src` → nichts; kein Cleanup, kein Concurrency-Limit |
| Cancel wird rückgängig gemacht | `extraction.ts:182` setzt nur `failJob`, `:476` ruft `completeJob` |
| `/extract/jobs` ohne Konsumenten | `grep -rn "extract/jobs" mobile/` → nichts |
| Server umgeht RLS | `DATABASE_URL` als Rolle `postgres` (`.env.example:41`) |

## Was danach besser ist

- Kein Nutzer importiert mehr mit den Credentials eines anderen
- Kein Import speichert stillschweigend Unsinn
- Fehlgeschlagene Importe zeigen ihren tatsächlichen Grund
- Kein Endlos-Spinner nach einem Redeploy
- Es gibt eine Obergrenze für parallele Extraktionen — die wahrscheinlichste
  OOM-Ursache
- Ein Abbruch bleibt ein Abbruch
- Pinterest und Facebook sind entweder funktionsfähig oder dokumentiert
  eingestellt, statt als Halbzustand weiterzulaufen

## Nach Abschluss

Beide Teilpläne bleiben als Archiv liegen. Die Ergebnisse gehören dorthin, wo
sie gelesen werden: `CLAUDE.md`, `docs/CODEMAPS/`, und als ADR in
`Projekte/RecipeDeck/Entscheidungen.md`. Die dortigen „Offene Punkte ohne
ADR"-Einträge werden dann zu echten Entscheidungen.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | AUTH FAILED | refresh token revoked |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES RESOLVED | 14 issues, 3 critical gaps, scope reduced |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE VOICE:** Codex nicht verfügbar (Auth abgelaufen), unabhängiger
  Claude-Subagent gelaufen — 11 zusätzliche Befunde, alle sieben
  folgenschwersten gegen den Code verifiziert.
- **CROSS-MODEL:** keine Spannung — die zweite Meinung war durchgehend
  schärfer als die erste Fassung, kein Widerspruch zu klären.
- **UNRESOLVED:** 1 (Entscheidung A, Pinterest-Messung) — extern blockiert,
  braucht einen Pinterest-Business-Account plus registrierte App. Entscheidung
  B wurde am 2026-08-07 getroffen: verschlüsselt at rest, Cookidoo inklusive.
- **VERDICT:** ENG CLEARED — Scope reduziert, Reihenfolge korrigiert, bereit
  zur Umsetzung ab Slice 0.
