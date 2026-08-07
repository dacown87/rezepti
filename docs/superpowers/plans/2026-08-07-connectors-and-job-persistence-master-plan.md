# Master-Plan: Connectors und Job-Persistenz

**Stand:** 2026-08-07 (v1.0.196) · **Status:** ENTWURF

Klammer über zwei Arbeitsstränge, die beim Doku-Abgleich am 2026-08-07 als
belegte Baustellen aufgefallen sind. Beide waren vorher nirgends geplant — sie
standen nur als „faktisch tot" bzw. „offener Punkt" in der Bestandsaufnahme.

> **Was dieses Dokument nicht ist.** Es ersetzt weder `TODO.md` (die operative
> Arbeitsliste) noch den Obsidian-Phasenplan (Strategie und Historie). Es
> klammert genau zwei Stränge und endet, wenn beide erledigt sind. Der
> kritische Pfad des Projekts bleibt der Brevo-Mailversand aus `TODO.md`.

## Die beiden Teilpläne

| Plan | Inhalt |
|---|---|
| [Pinterest/Facebook Per-User-Connectors](2026-08-07-pinterest-facebook-per-user-connectors-plan.md) | Eigene Credentials pro Nutzer, Fetcher auf den Auth-Kontext umstellen, Import wieder funktionsfähig |
| [Job-Persistenz](2026-08-07-job-persistence-plan.md) | Extraktions-Jobs überleben Neustarts, Polling funktioniert instanzübergreifend |

## Warum zusammen betrachtet

Technisch sind sie unabhängig und können parallel laufen. Zusammen betrachtet
werden sie, weil sie **denselben Ursprung** haben: die Umstellung auf
Multi-User im Juni 2026 hat beide Bereiche mit Annahmen aus der
Single-User-Zeit zurückgelassen.

- Die Connectors legten **einen globalen Credential-Satz** auf Disk ab. In
  einer Mehrbenutzer-App hätte jeder mit dem Account eines anderen importiert,
  deshalb wurden sie in `a6614e7` korrekt abgeschaltet — aber nie umgebaut.
- Die Jobs liegen in einer **prozesslokalen Map**, weil `857606f` sie
  ausdrücklich als „transient" eingestuft hat. Das stimmte für einen Nutzer und
  eine Instanz.

Beide sind also nicht kaputtgegangen, sondern nicht mitgezogen worden.

## Gemeinsames Muster

Beide Stränge lösen ihr Problem auf demselben Weg, den Cookidoo am 2026-06-15
schon gegangen ist:

```
globaler Zustand (Datei / Prozessspeicher)
        ↓
scoped Postgres-Zeile mit RLS
        ↓
Resolver mit Auth-Kontext, user > household
```

Wer einen der beiden Stränge umsetzt, sollte sich vorher
`supabase/migrations/20260615170413_cookidoo_credentials_scoped.sql`, die
Härtung in `20260619113000_harden_cookidoo_credentials_store.sql` und
`src/fetchers/CLAUDE.md` ansehen. Das Muster ist erprobt und muss nicht neu
erfunden werden — insbesondere das `revoke all … from anon, authenticated`
gehört zu jeder neuen Tabelle dazu.

## Reihenfolge

```
SOFORT, blockiert durch nichts
├── Connectors Slice 0    Pinterest scheitert ehrlich statt JS zu importieren
├── Connectors Slice 0b   yt-dlp aktualisieren, Health-Check erweitern
└── Job-Persistenz        Slice 1 bis 5 komplett

BLOCKIERT durch zwei Entscheidungen
└── Connectors Slice 1–5  Credential-Tabelle, Routen, Fetcher, UI
```

Die Job-Persistenz ist vollständig unblockiert und in sich abgeschlossen — sie
ist der bessere Startpunkt, wenn ein Tag Zeit ist. Bei den Connectors sind nur
die beiden kleinen Slices sofort machbar; der Rest wartet.

## Offene Entscheidungen

Beide liegen beim Betreiber, nicht bei der Umsetzung. Details und Optionen im
Connector-Plan.

**A — Pinterest: welches Credential-Modell?**
Vorgelagert eine Messung von zehn Minuten: Gibt `GET /v5/pins/{id}` mit einem
echten Token auch **fremde** öffentliche Pins heraus, oder nur eigene? Fällt
das durch, ist der ganze Credential-Aufbau für den eigentlichen Anwendungsfall
wertlos. Braucht einen Pinterest-Developer-Account.

**B — Facebook: dürfen Session-Cookies serverseitig liegen?**
Sie sind account-übernahme-tauglich, und `cookidoo_credentials.password` liegt
heute im Klartext. Empfehlung: verschlüsselt at rest, und Cookidoo im selben
Zug mitnehmen.

## Belege

Alles unten wurde am 2026-08-07 gemessen, nicht aus dem Code abgeleitet. Die
Details stehen in den Teilplänen.

| Befund | Beleg |
|---|---|
| Pinterest liefert anonym keine Pin-Daten mehr | 2 Pins, je ~1,08 MB App-Shell, keine `og:`-Tags, `__PWS_DATA__` ohne Pin-Inhalt, yt-dlp `403` |
| Der Pinterest-Fetcher importiert JavaScript als Rezept | `findOriginalUrl` → `s.pinimg.com/webapp/.../accessibility-*.mjs`, 6000 Zeichen minifiziertes JS als `textContent` |
| Lokales yt-dlp ist zwei Jahre alt | installiert `2024.04.09`, aktuell `2026.7.4`; Dockerfile baut mit `--upgrade`, Production weicht also ab |
| Job-Verlust bei Redeploy | `getJob` → Map-Miss → `404 Job not found` in `routes/extraction.ts:138` |
| `/extract/jobs` ist multi-user-falsch | global neueste 50 holen, **dann** auf den Aufrufer filtern |
| `config.jobs` ist tot | `grep -rn "config.jobs" src` → keine Treffer; kein Cleanup, **kein Concurrency-Limit** |

## Was danach besser ist

- Pinterest und Facebook importieren wieder — oder sind bewusst und
  dokumentiert eingestellt, statt als Halbzustand weiterzulaufen
- Kein Import speichert mehr stillschweigend Unsinn
- Ein Redeploy mitten in einer Extraktion erzeugt eine verständliche
  Fehlermeldung statt `404`
- Die Job-Liste zeigt jedem Nutzer seine eigenen Jobs
- Es gibt eine Obergrenze für parallele Extraktionen
- Der letzte harte Blocker für mehr als eine Server-Instanz ist ein
  Heartbeat-Modell — und der ist dann benannt statt unbekannt

## Nach Abschluss

Dieses Dokument und die beiden Teilpläne nach `docs/superpowers/plans/`
belassen (Archiv), die Ergebnisse aber dorthin schreiben, wo sie gelesen
werden: `CLAUDE.md`, `docs/CODEMAPS/`, und als ADR in
`Projekte/RecipeDeck/Entscheidungen.md`. Die dortigen „Offene Punkte ohne
ADR"-Einträge zu Pinterest/Facebook und zur Job-Persistenz werden dann zu
echten Entscheidungen.
