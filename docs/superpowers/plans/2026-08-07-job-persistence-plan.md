# Plan: Extraktions-Jobs persistieren

**Stand:** 2026-08-07 · **Status:** ENTWURF
**Ziel:** Jobs überleben einen Prozessneustart, und das Polling funktioniert
auch mit mehr als einer Server-Instanz.

---

## Der aktuelle Zustand war eine bewusste Entscheidung

`src/job-manager.ts` trägt sie im Dateikopf:

```ts
/**
 * Job Manager for tracking extraction jobs (in-memory)
 * Jobs are transient and don't need to survive server restarts.
 */
```

Vor der Supabase-Migration gab es echte Persistenz. Commit `857606f`
(„Phase 2 — SQLite durch Supabase ersetzen") hat sie entfernt:

> `job-manager.ts`: SQLite-Persistenz → in-memory Map (Jobs sind transient)

403 Zeilen wurden auf eine `Map` reduziert. Das war zu dem Zeitpunkt richtig:
Single-User, eine Instanz, lokale Datei. **Was sich seitdem geändert hat, ist
der Kontext** — Multi-User seit Juni 2026, öffentlich geplant, Redeploy bei
jedem Merge auf `main`. Dieser Plan revidiert die Annahme, nicht die damalige
Entscheidung.

---

## Was heute konkret kaputt ist

### 1. Redeploy mitten im Job → `404`, nicht „fehlgeschlagen"

Eine Extraktion dauert 30–90 Sekunden. In diesem Fenster ist ein Neustart —
Deploy nach Merge, OOM, Northflank-Restart — vollständiger Datenverlust für
den Job. Der nächste Poll trifft auf `src/routes/extraction.ts:138`:

```ts
const job = jobManager.getJob(jobId);
if (!job) {
  return c.json({ error: "Job not found" }, 404);
}
```

Der Nutzer sieht keinen fehlgeschlagenen Import, sondern einen Job, den es nie
gegeben hat. `completeJob` wird nie erreicht, also feuert auch die
Web-Push-Benachrichtigung nicht.

### 2. Horizontale Skalierung ist ausgeschlossen

Bei zwei Instanzen hinter einem Load Balancer legt `POST /extract/react` den
Job auf Instanz A an; `GET /extract/react/:jobId` landet je nach Routing auf
Instanz B, die ihn nicht kennt → `404` bei etwa jedem zweiten Poll.

Folgen:

- Die App ist auf **genau eine** Instanz festgenagelt
- Kein Rolling Deploy ohne Lücke — während der Umschaltung existieren
  entweder zwei Instanzen (Polling kaputt) oder null
- Lastspitzen nur vertikal abfangbar

### 3. `/extract/jobs` ist in einer Multi-User-App schlicht falsch

`src/routes/extraction.ts:205`:

```ts
const jobs = jobManager
  .getRecentJobs(limit)          // die global neuesten 50 Jobs
  .filter((job) => job.userId === auth.userId);
```

Erst global sortieren und kappen, **dann** auf den Aufrufer filtern. Bei
mehreren aktiven Nutzern bekommt jemand eine leere Liste, obwohl er eigene
Jobs hat — sie liegen einfach nicht unter den global neuesten 50. Mit einer
Tabelle wird daraus ein `WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`
und das Problem verschwindet.

### 4. `config.jobs` ist komplett tot

```
$ grep -rn "config.jobs" src --include=*.ts
(keine Treffer)
```

Alle drei Werte werden nirgends gelesen:

| Variable | Dokumentierte Wirkung | Tatsächliche Wirkung |
|---|---|---|
| `JOB_CLEANUP_DAYS` | alte Jobs verwerfen | **keine** — `cleanupOldJobs()` wird nie aufgerufen |
| `MAX_CONCURRENT_JOBS` | parallele Extraktionen begrenzen | **keine** — es gibt gar keine Begrenzung |
| `POLL_INTERVAL_MS` | Poll-Intervall | **keine** serverseitig |

Zwei davon sind eigenständige Probleme:

- **Kein Cleanup** → die `Map` wächst über die gesamte Prozesslaufzeit. Bisher
  unauffällig, weil häufig deployt wird — also ein Leck, das ausgerechnet
  durch Problem 1 kaschiert wird.
- **Kein Concurrency-Limit** → zehn gleichzeitige Importe starten zehn
  parallele yt-dlp-/Groq-Pipelines. Bei einer Instanz mit begrenztem RAM ist
  das der wahrscheinlichste Weg zu einem OOM — und der löst wiederum
  Problem 1 aus.

---

## Was der Fix *nicht* löst

Wichtig für die Erwartung: Persistenz rettet den **Job-Status**, nicht die
**laufende Arbeit**. Stirbt der Prozess während des Groq-Calls, ist der
Download weg. Der Gewinn ist:

- der Nutzer sieht „fehlgeschlagen, bitte erneut versuchen" statt `404`
- Polling funktioniert über Instanzgrenzen hinweg
- die Job-Liste stimmt

Echte Wiederaufnahme bräuchte eine Work-Queue mit Lease/Heartbeat und
idempotenten Pipeline-Schritten. Das ist eine deutlich größere Nummer und
**ausdrücklich nicht Teil dieses Plans** — siehe „Später, falls nötig".

---

## Design

### Tabelle

```sql
create table public.extraction_jobs (
  id                  text primary key,          -- bestehendes Format job_<ts>_<rand>
  url                 text not null,
  status              text not null,             -- pending | running | completed | failed
  progress            integer not null default 0,
  current_stage       text null,
  message             text null,
  result              jsonb null,
  error               text null,
  hint                text null,
  user_id             uuid null,
  active_household_id uuid null,
  user_agent          text null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  started_at          timestamptz null,
  completed_at        timestamptz null,
  constraint extraction_jobs_status_check
    check (status in ('pending','running','completed','failed'))
);

create index extraction_jobs_user_created_idx
  on public.extraction_jobs (user_id, created_at desc);
create index extraction_jobs_active_url_idx
  on public.extraction_jobs (url) where status in ('pending','running');
```

Plus, analog zu `20260619113000_harden_cookidoo_credentials_store.sql`:

```sql
alter table public.extraction_jobs enable row level security;
revoke all on table public.extraction_jobs from anon, authenticated;
```

Zwei bewusste Abweichungen von der bestehenden Struktur:

- **`result` als `jsonb`, nicht `text`.** Die JSON-als-`text`-Spalten bei
  `recipes` sind ein SQLite-Erbe (siehe `docs/CODEMAPS/DATABASE.md`). Eine
  neue Tabelle muss diesen Fehler nicht wiederholen.
- **`apiKeyHash` wird nicht persistiert.** Das Feld existiert heute auf dem
  In-Memory-Job. Es in die Datenbank zu schreiben, würde einen
  BYOK-Schlüssel-Hash dauerhaft ablegen — ohne dass ein Aufrufer ihn nach dem
  Job-Start noch liest. Prüfen und, wenn bestätigt, beim Umbau ganz fallen
  lassen.

### Write-Through statt Read-Through

Die `Map` bleibt als Prozess-Cache erhalten; jede Mutation schreibt zusätzlich
in die Tabelle. `getJob` liest aus der Map und fällt bei einem Miss auf die DB
zurück. So kostet der häufigste Pfad (Polling durch dieselbe Instanz, die den
Job hält) keine zusätzliche Query, und der Cross-Instanz-Fall funktioniert
trotzdem.

Schreibvolumen pro Job: `createJob`, `startJob`, ~5× `updateJob` (eine pro
Pipeline-Stage), `completeJob`/`failJob` — also **7–8 Writes**. Für Postgres
belanglos.

### Die eigentliche mechanische Arbeit: sync → async

Alle `JobManager`-Methoden sind heute **synchron**. Mit DB-Schreibzugriff
werden sie `async`, und jeder Aufrufer muss `await`en.

Gute Nachricht: **alle Produktivaufrufer liegen in einer einzigen Datei**,
`src/routes/extraction.ts`. Verteilung:

| Methode | Aufrufe |
|---|---|
| `updateJob` | 7 |
| `failJob` | 7 |
| `getJob` | 5 |
| `createJob` | 5 |
| `startJob` | 3 |
| `completeJob` | 3 |
| `getRecentJobs`, `jobToEvent`, `isUrlProcessing`, `getJobEventsSince` | je 1 |

Dazu die Tests: `test/unit/job-manager.test.ts`,
`test/unit/job-completion-push.test.ts`, `test/unit/photo-extraction.test.ts`.
`JobManager.createTestInstance` mit injizierbaren Dependencies existiert
bereits — dort kommt ein In-Memory-Fake-Store als vierte Dependency dazu,
damit die Unit-Tests ohne Datenbank laufen.

Die Fire-and-forget-Aufrufe im async-Pfad (`updateJob` innerhalb von
`onEvent`) dürfen den Pipeline-Lauf nicht blockieren oder abbrechen: ein
fehlgeschlagener Status-Write ist ein geloggter Fehler, kein Jobabbruch.

---

## Slices

### Slice 1 — Tabelle und Store

Migration, `src/schema.ts`, RLS, Zugriffsfunktionen in `db-react.ts`
(`insertJob`, `updateJobRow`, `loadJob`, `listJobsForUser`,
`findActiveJobByUrl`, `deleteJobsOlderThan`). Abdeckung in
`scripts/supabase/rls-smoke.ts`: Nutzer A sieht die Jobs von Nutzer B nicht.

Noch kein Verhaltenswechsel — nur die Infrastruktur.

### Slice 2 — JobManager auf Write-Through umbauen

Methoden `async`, `src/routes/extraction.ts` durchgängig `await`en,
Store-Dependency in `createTestInstance` ergänzen, bestehende Tests grün
halten. `getJob` mit DB-Fallback bei Cache-Miss.

Danach überlebt ein Job den Neustart, und Polling funktioniert
instanzübergreifend.

### Slice 3 — Die Folgeprobleme mitnehmen

Sie hängen alle am selben Umbau und sollten nicht als Restposten liegen
bleiben:

- `/extract/jobs` auf `listJobsForUser(userId, limit)` umstellen — behebt
  Problem 3
- `cleanupOldJobs` an `config.jobs.cleanupDays` hängen und tatsächlich
  aufrufen (Intervall beim Serverstart oder direkt als SQL-Delete beim
  Job-Anlegen)
- Concurrency-Limit aus `config.jobs.maxConcurrent` durchsetzen: bei
  Überschreitung `429` mit klarer deutscher Meldung statt eines elften
  parallelen yt-dlp-Prozesses
- `isUrlProcessing` gegen die Tabelle statt gegen die Map — sonst ist die
  Doppel-Import-Sperre instanzlokal und damit wirkungslos

### Slice 4 — Verwaiste Jobs beim Start aufräumen

Nach einem Neustart stehen Jobs mit Status `running` in der Tabelle, an denen
niemand mehr arbeitet. Beim Serverstart einmalig alle `pending`/`running`-Jobs
auf `failed` setzen mit `error: "Serverneustart während der Verarbeitung"` und
einem `hint`, der zum erneuten Versuch auffordert.

> **Achtung bei Slice 4 und mehreren Instanzen:** Der Start-Sweep würde die
> laufenden Jobs der *anderen* Instanz abschießen. Solange nur eine Instanz
> läuft, ist das unkritisch. Vor dem Scale-out muss der Sweep durch ein
> Heartbeat-Modell ersetzt werden (Job trägt `worker_id` + `last_heartbeat_at`,
> verwaist gilt ab „kein Heartbeat seit N Minuten"). **Das ist die eigentliche
> Voraussetzung für Skalierung** — Slice 1–3 machen das Polling
> instanzübergreifend korrekt, Slice 4 in seiner einfachen Form nicht.

### Slice 5 — Doku

`CLAUDE.md`, `docs/CODEMAPS/ARCHITECTURE.md` und `docs/CODEMAPS/BACKEND.md`
beschreiben den In-Memory-Zustand aktuell korrekt inklusive seiner Folgen. Das
muss mit dem Umbau angepasst werden — im selben PR, nicht später.

---

## Reihenfolge und Aufwand

```
Slice 1 (Tabelle + RLS)
   ▼
Slice 2 (Write-Through, sync → async)
   ▼
Slice 3 (Job-Liste, Cleanup, Concurrency, Doppel-Import-Sperre)
   ▼
Slice 4 (Start-Sweep)  ──► Heartbeat erst vor dem Scale-out
   ▼
Slice 5 (Doku)
```

| Slice | Umfang |
|---|---|
| 1 | ~2 h inkl. RLS-Smoke |
| 2 | ~3 h, die Hälfte davon Tests |
| 3 | ~2 h |
| 4 | ~1 h |
| 5 | ~30 min |

Insgesamt ein guter Tag. Risikoarm, weil der Aufrufkreis auf eine Datei
begrenzt ist und die Tests bereits eine injizierbare Instanz nutzen.

---

## Später, falls nötig

Echte Wiederaufnahme unterbrochener Extraktionen — Work-Queue mit
Lease/Heartbeat, idempotente Pipeline-Schritte, Retry mit Backoff. Das lohnt
sich erst, wenn Importe teuer genug sind, dass ein Neuversuch wehtut, oder
wenn mehrere Worker laufen sollen. Bis dahin ist „ehrlich scheitern und der
Nutzer drückt nochmal" die richtige Menge Komplexität.

---

## Verwandte Dokumente

- [Master-Plan](2026-08-07-connectors-and-job-persistence-master-plan.md)
- `docs/CODEMAPS/ARCHITECTURE.md` — Abschnitt „Jobs Live Only in Process Memory"
- `docs/CODEMAPS/BACKEND.md` — Job Manager
- Obsidian → `Projekte/RecipeDeck/Entscheidungen.md` — „Offene Punkte ohne ADR"
