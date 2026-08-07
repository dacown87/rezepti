# Plan: Extraktions-Jobs — Robustheit und Persistenz

**Stand:** 2026-08-07, überarbeitet nach `/plan-eng-review` · **Status:** ENTWURF

> **Was sich in der Review geändert hat.** Die erste Fassung stellte die
> Job-Tabelle in den Mittelpunkt. Die Prüfung gegen den Client hat gezeigt: die
> beiden wertvollsten Fixes brauchen keine Tabelle, und der schlimmste
> Nutzereffekt ist ein anderer als angenommen. Die Reihenfolge ist umgedreht.

---

## Der aktuelle Zustand war eine bewusste Entscheidung

`src/job-manager.ts` trägt sie im Dateikopf:

```ts
/**
 * Job Manager for tracking extraction jobs (in-memory)
 * Jobs are transient and don't need to survive server restarts.
 */
```

`857606f` („SQLite durch Supabase ersetzen") hat 403 Zeilen Persistenz auf eine
`Map` reduziert. Für Single-User auf einer Instanz war das richtig. Was sich
geändert hat, ist der Kontext — nicht die damalige Entscheidung.

---

## Korrektur: der Nutzer sieht keinen 404

Die erste Planfassung behauptete, ein Redeploy mitten im Job zeige dem Nutzer
einen `404`. Der Client verwirft ihn:

```ts
// mobile/app/(tabs)/extract.tsx:195
if (!res.ok) return; // transient error, keep polling
```

Es gibt keine Obergrenze für Poll-Versuche; das Intervall wird nur bei
`completed` oder `failed` gestoppt. **Das reale Symptom ist ein Spinner, der
auf dem letzten Fortschrittswert stehen bleibt und nie endet.**

Zweiter, schwerwiegenderer Fund im selben Codepfad:

```ts
// mobile/app/(tabs)/extract.tsx:234
const failureMessage = status.result?.error || status.message || 'Extraktion fehlgeschlagen';
```

`failJob` schreibt den Fehler **top-level** (`job-manager.ts:136`), und
`jobToEvent` gibt ihn top-level zurück (`job-manager.ts:176`). Das
`JobStatus`-Interface des Clients (`extract.tsx:56-71`) kennt aber gar kein
top-level `error` — nur `hint`, das korrekt gelesen wird. `result` ist auf
**jedem** `failJob`-Pfad `undefined`.

Konsequenz: **Kein einziger Fehlertext aus `failJob` wird jemals angezeigt.**
Der Nutzer sieht stattdessen `status.message`, also die letzte Stage-Meldung
(„Inhalte werden abgerufen (facebook)…"). Das betrifft jeden fehlgeschlagenen
Import, nicht nur den Neustart-Fall.

Beides zusammen heißt: **die teuerste Arbeit (Tabelle) liefert weniger
Nutzerwert als zwei Zeilen im Client.**

---

## Die Probleme, nach tatsächlichem Wert sortiert

| # | Problem | Beleg | Aufwand |
|---|---|---|---|
| 1 | Fehlertexte werden nie angezeigt | `extract.tsx:234` liest `result?.error`, Server schreibt top-level | ~2 Zeilen |
| 2 | Endlos-Spinner nach Neustart | `extract.tsx:195` verwirft jeden non-ok | ~10 Zeilen |
| 3 | Kein Concurrency-Limit | `grep -rn "config.jobs" src` → nichts | ~15 Zeilen |
| 4 | Kein Cleanup, Map wächst unbegrenzt | `cleanupOldJobs` wird nie aufgerufen | ~5 Zeilen |
| 5 | Cancel stoppt die Pipeline nicht | `extraction.ts:182` setzt nur `failJob`, `completeJob` bei `:476` macht es rückgängig | ~20 Zeilen |
| 6 | Jobs überleben keinen Neustart | `getJob` → Map-Miss | Tabelle, ~1 Tag |
| 7 | Kein horizontales Skalieren | Polling trifft die falsche Instanz | Tabelle + SIGTERM |

Probleme 3 und 4 sind zusätzlich die **Ursache** von Problem 6: unbegrenzte
parallele Extraktionen mit je einem vollständigen Base64-Foto im Speicher
(`extraction.ts:264`) sind der wahrscheinlichste Weg zu einem OOM — und ein OOM
ist ein Neustart.

---

## Was der Fix *nicht* löst

Persistenz rettet den **Job-Status**, nicht die **laufende Arbeit**. Stirbt der
Prozess während des Groq-Calls, ist der Download weg.

Verschärfend, und in der ersten Fassung übersehen: `photoDataStore` und
`textDataStore` (`extraction.ts:16-18`) sind zwei **weitere** prozesslokale
Maps, ebenfalls per `jobId` verschlüsselt. Ein persistierter Foto- oder
Textjob ist nach einem Neustart **grundsätzlich nicht fortsetzbar** — die
Eingabedaten sind weg. Für diese Jobtypen kann Persistenz nur eines liefern:
ein ehrliches `failed` statt eines Endlos-Spinners.

Beide Maps werden korrekt in `finally` geleert (`:326`, `:419`) — kein Leck,
aber während der Laufzeit hält jeder aktive Fotojob sein volles Base64 im RAM.
Siehe Problem 3.

---

## Slices

### Slice 1 — Client: ehrliches Scheitern (sofort, ~15 Zeilen)

Größter Nutzergewinn pro Zeile im ganzen Plan.

- `JobStatus`-Interface um top-level `error?: string` erweitern
- `const failureMessage = status.error || status.result?.error || status.message || …`
- Poll-Schleife: 404 auf einen Job, der schon einmal geantwortet hat, ist
  **terminal** — Intervall stoppen, Meldung „Import unterbrochen (vermutlich
  Serverneustart). Bitte erneut versuchen."
- Zusätzlich eine harte Obergrenze (z. B. 300 Polls ≈ 5 min), damit kein
  Spinner ewig läuft
- Tests in `mobile/test/`: 404-nach-Erfolg beendet das Polling; `error`
  top-level wird gerendert; Timeout greift

### Slice 2 — Server: die zwei toten Config-Werte scharfschalten (~20 Zeilen)

- Semaphore um `processJobInBackground` / `processPhotoJobInBackground` /
  `processTextJobInBackground` aus `config.jobs.maxConcurrent`. Bei
  Überschreitung `429` mit deutschem Klartext, **nicht** eine elfte parallele
  Pipeline
- `setInterval(() => jobManager.cleanupOldJobs(config.jobs.cleanupDays), …)`
  beim Serverstart, Intervall stündlich
- Tests: Limit greift; Cleanup entfernt alte und behält junge Jobs

Damit sind `MAX_CONCURRENT_JOBS` und `JOB_CLEANUP_DAYS` erstmals wirksam.

### Slice 3 — Cancel reparieren (~20 Zeilen)

`DELETE /extract/react/:jobId` setzt heute nur `failJob`; die Pipeline läuft
weiter und `completeJob` (`extraction.ts:476`) macht die Stornierung
rückgängig. Ein `AbortController` pro Job, im `jobManager` gehalten, in
`onEvent` geprüft. Test: Cancel während `fetching` → Job bleibt `failed`.

> Wichtig **vor** Slice 4: sonst wird die Wiederauferstehung in die Datenbank
> geschrieben.

### Slice 4 — Tabelle und Write-Through (~1 Tag)

Erst hier, und nur wenn Slice 1–3 den Schmerz nicht schon ausreichend gelöst
haben.

```sql
create table public.extraction_jobs (
  id                  text primary key,
  url                 text not null,
  status              text not null,
  progress            integer not null default 0,
  current_stage       text null,
  message             text null,
  result              jsonb null,          -- SLIM, siehe unten
  error               text null,
  hint                text null,
  user_id             uuid null references auth.users(id) on delete cascade,
  active_household_id uuid null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  started_at          timestamptz null,
  completed_at        timestamptz null,
  constraint extraction_jobs_status_check
    check (status in ('pending','running','completed','failed'))
);

create index extraction_jobs_user_created_idx
  on public.extraction_jobs (user_id, created_at desc);

alter table public.extraction_jobs enable row level security;
revoke all on table public.extraction_jobs from anon, authenticated;
```

Vier Entscheidungen, die aus der Review stammen:

**`result` wird beschnitten.** `completeJob` bekommt heute
`{ success, recipeId, recipe: recipeData, imageSuggestions }`, und
`recipeData.imageUrl` darf ein Data-URL bis 500 KB sein
(`extraction.ts:307-309`). Das vollständige Objekt zu persistieren hieße bis zu
500 KB Base64 pro Fotojob in der Tabelle — verdoppelt zu `recipes.image_url`.
Gespeichert wird nur `{ success, recipeId, imageSuggestions, qualityWarnings,
nutritionEstimated, error }`. Das `recipe`-Objekt bleibt im Speicher-Cache für
die laufende Polling-Session.

> Nebenbefund: `jobToEvent` schickt `result` bei **jedem Poll** an den Client —
> heute also potenziell 500 KB Base64 pro Sekunde. Das ist ein bestehender
> Bug, unabhängig von diesem Plan, und sollte in Slice 1 mit erledigt werden.

**Keine Fire-and-forget-Writes.** Die erste Fassung widersprach sich hier
selbst. `emit()` in `pipeline.ts:47-49` **awaitet** `onEvent` bereits, also ist
ein awaiteter Single-Row-Update pro Stage kostenlos. Unawaitete parallele
Updates könnten out-of-order landen und `completeJob` überschreiben. Also:
durchgängig `await`.

**Kein Map-Cache.** Die erste Fassung wollte einen Write-Through-Cache „für den
heißen Pfad". Der heiße Pfad ist ein Primary-Key-Lookup pro Sekunde pro aktivem
Job. Der Cache kauft nichts und erzeugt Kohärenzfragen. Die Map entfällt.

**`apiKeyHash` entfällt ganz.** Nichts in `src/` oder `mobile/` liest das Feld;
es wird aktuell sogar an den Client serialisiert (`extraction.ts:210`). Weder
persistieren noch behalten.

Aufrufer: **alle in `src/routes/extraction.ts`.** Methoden werden `async`,
`createTestInstance` bekommt einen In-Memory-Fake-Store als Dependency.

### Slice 5 — SIGTERM statt Start-Sweep

Die erste Fassung wollte beim **Start** alle `running`-Jobs auf `failed`
setzen. Das ist falsch herum: bei einem Rolling Deploy laufen kurz zwei
Instanzen, und die neue würde die lebenden Jobs der alten abschießen — genau
das Ereignis, für das der Sweep gedacht war.

Richtig: `process.on('SIGTERM')` in `src/index.ts` (existiert heute nicht), die
**eigenen** in-flight Jobs auf `failed` setzen mit
`error: "Serverneustart während der Verarbeitung"`, dann beenden. Korrekt unter
Rolling Deploys, kein `worker_id`, kein Heartbeat.

Ein Heartbeat-Modell (`worker_id` + `last_heartbeat_at`) braucht es erst, wenn
Instanzen **hart** sterben (OOM, SIGKILL). Bis dahin bleibt ein Job dann
`running` in der Tabelle — sichtbar, aber nicht falsch.

### Slice 6 — Doku

`CLAUDE.md`, `docs/CODEMAPS/ARCHITECTURE.md`, `docs/CODEMAPS/BACKEND.md` im
selben PR.

---

## Ausdrücklich gestrichen

**`/extract/jobs` reparieren.** Die erste Fassung führte als Problem #3, dass
der Endpunkt die global neuesten 50 Jobs holt und *danach* filtert. Das stimmt
— aber `grep -rn "extract/jobs" mobile/` findet **keinen einzigen Konsumenten**.
Der Endpunkt wird von nichts aufgerufen. Entweder löschen oder liegen lassen;
er ist kein Headline-Outcome.

**„Nutzer A sieht die Jobs von Nutzer B nicht" als RLS-Smoke-Kriterium.** Der
Server verbindet über `DATABASE_URL` als Rolle `postgres` (`.env.example:41`)
und **umgeht RLS**. `enable row level security` + `revoke all … from anon,
authenticated` ohne Policies ist ein **Deny-all für die PostgREST-Data-API**,
kein Per-User-Scoping. Ein rls-smoke-Test „A sieht B nicht" würde vakuum
bestehen, weil beide nichts sehen.

Die Grenze, die hier tatsächlich zählt, ist `authorizeJobAccess`
(`extraction.ts:42-53`). Sie gehört durch einen **Server-Contract-Test mit zwei
echten Tokens** abgesichert, nicht durch rls-smoke. Der Deny-all bleibt
trotzdem richtig und wird gesetzt — nur mit korrekter Begründung.

---

## Testabdeckung

```
CODE PATHS                                        USER FLOWS
[+] mobile/app/(tabs)/extract.tsx                 [+] Import mit Serverneustart
  ├── Poll-Schleife                                 ├── [GAP] Redeploy → terminale Meldung
  │   ├── [GAP] 404 nach Erfolg → terminal          └── [GAP] Poll-Timeout nach 5 min
  │   ├── [GAP] 404 vor erstem Erfolg → weiter
  │   └── [GAP] Poll-Obergrenze erreicht          [+] Fehleranzeige
  └── Fehleranzeige                                 ├── [GAP] failJob-Text sichtbar
      └── [GAP] status.error top-level              └── [★★ TESTED] hint — extract-bug-reporting

[+] src/routes/extraction.ts                      [+] Lastspitze
  ├── Semaphore                                     └── [GAP] 11. Import → 429 mit Klartext
  │   ├── [GAP] unter Limit → läuft
  │   └── [GAP] über Limit → 429
  └── Cancel
      └── [GAP] Cancel während fetching → failed bleibt failed

[+] src/job-manager.ts
  ├── [★★★ TESTED] createJob/complete/fail — job-manager.test.ts
  ├── [★★★ TESTED] Push bei completeJob — job-completion-push.test.ts
  ├── [GAP] cleanupOldJobs per Intervall
  └── [GAP] Write-Through: await-Reihenfolge, completeJob nicht überschrieben

[+] Auth-Grenze
  └── [GAP] [→E2E] Nutzer B pollt Job von Nutzer A → 403/404 (zwei echte Tokens)

COVERAGE: 3/16 Pfade   |  GAPS: 13 (1 E2E)
```

**Regression-Regel:** Der Fehlertext-Bug (`result?.error`) ist eine
Regression — bestehendes Verhalten, das nie funktioniert hat und niemandem
auffiel. Der Test dafür ist **kritisch** und nicht verhandelbar.

## Failure Modes

| Codepfad | Realistischer Fehler | Test? | Error-Handling? | Nutzer sieht? |
|---|---|---|---|---|
| Poll nach Redeploy | 404 | GAP | nein — `return` | **nichts, Endlos-Spinner** ⚠️ kritisch |
| `failJob` | jeder Importfehler | GAP | ja, serverseitig | **falschen Text** ⚠️ kritisch |
| Parallele Fotoimporte | OOM | GAP | nein | Neustart, alle Jobs weg ⚠️ kritisch |
| Cancel | Wiederauferstehung | GAP | nein | „fertig" nach Abbruch |
| DB-Write in `updateJob` | Postgres-Timeout | GAP | geplant: loggen | nichts (korrekt) |

Drei kritische Lücken: kein Test, kein Error-Handling, stiller Fehler.

## Parallelisierung

| Lane | Slices | Module |
|---|---|---|
| A | 1 | `mobile/app/(tabs)/extract.tsx`, `mobile/test/` |
| B | 2, 3 | `src/routes/extraction.ts`, `src/job-manager.ts`, `src/index.ts` |
| C | 4, 5 | dieselben Module wie B → **muss nach B** |

Lane A und B sind unabhängig und laufen parallel. Lane C wartet auf B
(Konflikt in `extraction.ts` und `job-manager.ts`).

## Aufwand

| Slice | Umfang | Nutzen |
|---|---|---|
| 1 | ~1 h | hoch — behebt zwei sichtbare Bugs |
| 2 | ~1 h | hoch — verhindert die OOM-Ursache |
| 3 | ~1 h | mittel |
| 4 | ~5 h | mittel — nötig fürs Skalieren |
| 5 | ~1 h | mittel |
| 6 | ~30 min | — |

**Slice 1–3 zusammen: ~3 Stunden für den Großteil des Nutzens.**

## Verwandte Dokumente

- [Master-Plan](2026-08-07-connectors-and-job-persistence-master-plan.md)
- `docs/CODEMAPS/ARCHITECTURE.md` — „Jobs Live Only in Process Memory"
