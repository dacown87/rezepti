# Bug Reporting Full-Scope Implementation Plan

Stand: 2026-06-16
Status: geplant
Design-Basis: [2026-06-15-bug-reporting-design.md](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-06-15-bug-reporting-design.md)

## Ziel

Rezepti bekommt einen vollstaendigen Bug-Reporting-Slice mit:

- globalem Einstieg `Problem melden`
- speziellem Importfehler-Report mit vorausgefuelltem Kontext
- serverseitiger `bug_reports`-Quelle der Wahrheit
- Admin-Uebersicht mit Diagnoseansicht und Statuspflege
- Nutzerbereich `Meine Meldungen` in Settings

Der Slice ist bewusst kein Support- oder Ticket-System. Er soll Reports
strukturiert einsammeln, triagierbar machen und dem meldenden Nutzer eine
kleine Transparenz ueber den Status geben.

## Warum ein eigener Slice

Die bisherige Lage ist:

- es gibt in [TODO.md](/home/patrick/Projekte/rezepti/TODO.md) nur einen offenen
  Backlog-Punkt
- es existiert eine Produktskizze in
  [2026-06-15-bug-reporting-design.md](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-06-15-bug-reporting-design.md)
- es gibt noch kein serverseitiges Datenmodell, keine API und keinen
  konsistenten UI-Einstieg

Dieser Plan zieht den Punkt auf eine repo-konkrete Umsetzung herunter.

## Bestehende Integrationspunkte

Die Umsetzung soll explizit an bestehende Muster anschliessen:

- API-Routen leben in `src/routes/*.ts` und werden in
  [src/api-react.ts](/home/patrick/Projekte/rezepti/src/api-react.ts)
  zusammengefuehrt.
- Auth-Gates laufen ueber `requireUserAuth()` und `getUserAuth()` wie in
  [src/routes/platforms.ts](/home/patrick/Projekte/rezepti/src/routes/platforms.ts)
  und [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts).
- Admin-Gates folgen dem bestehenden Muster in
  [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts).
- Settings-UI lebt bereits zentral in
  [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx).
- Importfehler werden heute in
  [mobile/app/(tabs)/extract.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/extract.tsx)
  behandelt.
- Ein globaler Einstieg laesst sich am saubersten im Tab-Layout unterbringen:
  [mobile/app/(tabs)/_layout.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/_layout.tsx).

## Scope

### In Scope

1. Neue Tabelle `bug_reports` inklusive Drizzle-Schema und Migration.
2. Nutzer-API fuer Report-Erstellung und eigene Report-Liste.
3. Admin-API fuer Liste, Detailansicht und Statuspflege.
4. Globaler UI-Einstieg `Problem melden`.
5. Importfehler-spezifischer Einstieg mit erweitertem Kontext.
6. `Meine Meldungen` in Settings.
7. Admin-Bereich in Settings fuer Report-Triage.
8. Metadaten-Sanitizing gegen versehentliches Speichern sensibler Felder.
9. Unit-/Contract-/UI-Tests fuer Auth, Ownership, Statusfluss und Kontext.

### Nicht in Scope

1. Chat-/Kommentarverlauf zwischen Admin und Nutzer.
2. Datei- oder Screenshot-Uploads.
3. E-Mail- oder Push-Benachrichtigungen bei Statuswechsel.
4. Prioritaets-/Severity-System.
5. Deduplizierung oder automatische Buerndelung aehnlicher Reports.
6. Vollwertiges Admin-CMS fuer weitere Support-Prozesse.

## Architekturentscheidung

Empfohlen ist ein backend-first Vollslice.

Konkret:

1. Erst serverseitige Datenstruktur, API-Grenzen und Statusmodell festziehen.
2. Danach die drei UI-Einstiege auf denselben Report-Create-Flow aufsetzen:
   - globaler Button
   - Importfehler-Button
   - Settings-Read-Views
3. Admin-Ansicht und Nutzeransicht greifen auf dieselbe serverseitige
   Wahrheit zu.

Warum dieser Weg:

- Die eigentliche Produktlogik liegt im Report-Modell und im Diagnosekontext,
  nicht im Button.
- Der Importfehler-Pfad soll keinen Sonder-Storage bauen, sondern nur
  angereicherten Kontext an denselben Create-Endpoint schicken.
- Das minimiert Nacharbeit, falls sich Felder, Statuswerte oder Ownership-Regeln
  spaeter aendern.

## Datenmodell

### Neue Tabelle `bug_reports`

Vorgeschlagene Felder:

- `id uuid primary key`
- `report_type text not null`
- `status text not null`
- `description text not null`
- `user_id uuid not null`
- `household_id uuid null`
- `route text null`
- `source_area text not null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `admin_notes text null`
- `resolved_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Erlaubte Werte

- `report_type`: `general`, `import_failure`
- `status`: `new`, `triaging`, `in_progress`, `resolved`, `closed`
- `source_area`: `global_button`, `import_error`

### Constraints und Indizes

- Check-Constraint fuer erlaubte `report_type`-Werte
- Check-Constraint fuer erlaubte `status`-Werte
- Check-Constraint fuer erlaubte `source_area`-Werte
- Index auf `user_id`
- Index auf `status`
- Index auf `report_type`
- kombinierter Index auf `created_at desc` fuer Admin-Listen
- optional kombinierter Index auf `user_id, created_at desc` fuer
  `Meine Meldungen`

### RLS und Grants

`bug_reports` liegt im exposed `public`-Schema und braucht deshalb im ersten
Commit explizit dieselbe Haertung wie die restlichen nutzerspezifischen Tabellen.

Pflichtumfang fuer die Migration:

- `alter table public.bug_reports enable row level security`
- Grant-Matrix bewusst klein halten:
  - `authenticated`: nur die benoetigten Table-Rechte
  - kein offener Zugriff fuer `anon`
- Select-Policy fuer normale Nutzer:
  - nur eigene Reports (`user_id = auth.uid()`)
- Insert-Policy fuer normale Nutzer:
  - nur eigene Reports; `user_id` muss dem JWT-User entsprechen
- Select-Policy fuer Admins:
  - alle Reports lesbar
- Update-Policy fuer Admins:
  - nur Admins duerfen `status` und `admin_notes` aendern
- keine Delete-Policy fuer diesen Slice

Wichtig:

- Fuer `UPDATE` ist in Supabase/Postgres zusaetzlich eine passende `SELECT`-Policy
  noetig, sonst laufen Updates still ins Leere.
- Die Admin-Berechtigung darf nicht aus user-editable JWT-Metadaten kommen,
  sondern muss an das bestehende serverseitige `app_role`-/Profilmodell
  andocken.

### Bewusste Vereinfachung

Im ersten Slice gibt es kein separates `title`-Pflichtfeld.

Grund:

- das Report-Modal soll minimal bleiben
- Listen koennen einen gekuerzten `description`-Auszug rendern
- das vermeidet doppelte Nutzerarbeit

## Ownership- und Sichtbarkeitsregeln

### Nutzer

- duerfen Reports nur im eigenen Namen erstellen
- duerfen nur eigene Reports lesen
- duerfen eigene Reports nach Erstellung nicht editieren oder loeschen

### Admins

- duerfen alle Reports lesen
- duerfen `status` und `admin_notes` aendern
- duerfen keine Ownership eines Reports umhaengen

### Household-Kontext

- `household_id` wird beim Erstellen aus dem aktiven Auth-Kontext mitgespeichert,
  wenn vorhanden
- der Household-Kontext dient Diagnose und Triage, nicht einer separaten
  Berechtigungslogik

### Abuse- und Spam-Schutz

Der Slice ist kein anonymer Briefkasten. Weil Reports serverseitig persistiert
werden, braucht der erste Wurf eine kleine Missbrauchsbremse:

- nur fuer angemeldete Nutzer (`requireUserAuth()`)
- serverseitige Laengenlimits fuer `description` und String-Metadaten
- einfacher Per-User-Rate-Limit-Guard fuer Report-Erstellung
  - z. B. kleines Sliding/Fixed Window in DB oder vorhandenes Runtime-Muster
- bei Limit-Treffern klare `429`-Antwort mit user-lesbarer Fehlermeldung

Das ist kein Vollschutz, aber verhindert den trivialen Spam-Pfad schon im
ersten Slice.

## Diagnosekontext und Sanitizing

### Allgemeiner Kontext

Jeder Report darf automatisch folgende Metadaten erhalten, soweit verfuegbar:

- `appVersion`
- `route`
- `platform`
- `osVersion`
- `viewport`
- `timestamp`
- `userAgent`
- `lastClientError`
- `lastApiError`
- `activeHouseholdId`

### Zusatz fuer `import_failure`

- `importMode` (`url`, `text`, `photo`)
- `sourceType` bzw. Klassifikation falls bekannt
- `sourceUrl` nur wenn sicher loggbar
- `jobId`
- `jobStatus`
- `currentStage`
- `errorMessage`
- `errorHint`
- `qualityWarnings`

### Failure-Snapshot fuer Importfehler

Der Import-Report darf sich nicht darauf verlassen, dass der aktuelle
Screen-State zum Klickzeitpunkt noch vollstaendig ist. Der Extract-Screen hat
mehrere Reset-/Transition-Pfade; darum braucht der Client einen expliziten
letzten Fehler-Snapshot.

Empfohlene Client-Struktur:

- `lastFailureSnapshot`
  - `mode`
  - `submittedUrl` oder Text-/Foto-Hinweis
  - `jobId | null`
  - `jobStatus`
  - `currentStage`
  - `errorMessage`
  - `errorHint`
  - `qualityWarnings`
  - `timestamp`

Regel:

- Snapshot bei jedem terminalen Fehler aktualisieren
- `reset()` loescht ihn bewusst
- Bug-Report nutzt bevorzugt den Snapshot statt losem Live-State

### Harte Ausschluesse

Diese Daten duerfen nicht gespeichert werden:

- Bearer-Tokens
- Cookies
- komplette Request-Header
- BYOK-/Groq-Keys
- Cookidoo-Passwoerter
- rohe Auth-Session-Objekte
- andere Secrets aus SecureStore oder AsyncStorage

### Sanitizing-Regel

Es gibt serverseitig einen kleinen Sanitizer statt blindes Durchreichen von
Client-JSON.

Regel:

- nur bekannte Top-Level-Metadaten uebernehmen
- Strings defensiv begrenzen
- unbekannte oder offensichtlich sensitive Schluessel verwerfen

## API-Schnittstellen

Empfohlene Route-Datei:

- neu: `src/routes/bug-reports.ts`

Ein eigener Router ist sauberer als eine Beimischung in bestehende
Platforms-/Extraction-Routen.

### Nutzer: Report erstellen

`POST /api/v1/bug-reports`

Request:

```json
{
  "reportType": "general",
  "sourceArea": "global_button",
  "description": "Beim Speichern haengt der Screen.",
  "route": "/settings",
  "metadata": {
    "appVersion": "1.0.0"
  }
}
```

Regeln:

- `requireUserAuth()`
- `description` Pflichtfeld
- `reportType` und `sourceArea` validieren
- serverseitig Household-/User-Kontext anreichern
- `status` initial immer `new`
- serverseitige Sanitizing-Allowlist fuer `metadata`
- Request-Laengenlimit + kleiner Per-User-Rate-Limit-Guard

### Anonyme / Pre-Auth-Flaechen

Der Produktwunsch ist ein global sichtbarer Einstieg. Gleichzeitig ist die
serverseitige Quelle der Wahrheit absichtlich auth-pflichtig.

Deshalb muss der UX-Vertrag explizit in den Plan:

- auf authentifizierten Screens: Bug-Modal direkt verfuegbar
- auf Pre-Auth-/anon-Flaechen:
  - entweder Button ausblenden
  - oder denselben Einstieg als Sign-in-CTA verwenden
- kein Flow, der fuer anonyme Nutzer scheinbar submitten kann und erst am
  Endpoint auf `401` faellt

Response:

```json
{
  "id": "uuid",
  "status": "new",
  "success": true
}
```

### Nutzer: Eigene Reports

`GET /api/v1/bug-reports/me`

Response:

- paginierte oder limitierte Liste der eigenen Reports
- ausreichend fuer `Meine Meldungen`

Minimalfelder:

- `id`
- `reportType`
- `status`
- `description`
- `route`
- `createdAt`
- `updatedAt`

### Admin: Liste

`GET /api/v1/admin/bug-reports`

Query-Filter:

- `status`
- `reportType`
- `sourceArea`
- `limit`
- `cursor` oder `offset`

Admin-Liste soll auf sichtbare Felder optimiert sein, nicht auf JSON-Ausgrabung.

### Admin: Detail

`GET /api/v1/admin/bug-reports/:id`

Response:

- volle Kernfelder
- `metadata_json`
- `admin_notes`

### Admin: Status/Notiz aktualisieren

`PATCH /api/v1/admin/bug-reports/:id`

Request:

```json
{
  "status": "triaging",
  "adminNotes": "Konnte lokal reproduziert werden."
}
```

Regeln:

- nur fuer Admins
- `status` gegen erlaubte Werte validieren
- `resolved_at` setzen, wenn Status nach `resolved` wechselt
- `resolved_at` leeren oder unveraendert lassen nach expliziter Produktregel

Empfehlung:

- `resolved_at` nur setzen, wenn Status `resolved` oder `closed` wird
- bei Rueckwechsel auf `triaging` oder `in_progress` wieder leeren

## DB- und Route-Helfer

Empfohlene neue Helfer in `src/db-react.ts`:

- `createBugReport(input, auth)`
- `listMyBugReports(userId, limit, cursor?)`
- `listBugReportsForAdmin(filters)`
- `getBugReportByIdForAdmin(id)`
- `updateBugReportAdminFields(id, patch)`

Zusatz:

- kleine Helper fuer Statusvalidierung und Sanitizing

## Frontend-/Mobile-Aufteilung

### Phase A: Gemeinsamer Client-Flow

Neue Hilfsdatei:

- `mobile/utils/bug-reporting.ts`

Aufgaben:

- `createBugReport(payload)`
- `fetchMyBugReports()`
- `fetchAdminBugReports()`
- `fetchAdminBugReportDetail(id)`
- `updateAdminBugReport(id, patch)`

Der Client-Helfer soll denselben `apiFetch`-/`assertApiOk`-Stil wie bestehende
Settings-Utilities verwenden.

### Phase B: Globaler Bug-Button

Empfohlener Einhaengepunkt:

- shared App-Shell auf Root-Ebene, primaer
  [mobile/app/_layout.tsx](/home/patrick/Projekte/rezepti/mobile/app/_layout.tsx)
- `mobile/app/(tabs)/_layout.tsx` nur, wenn der Einstieg bewusst auf Tab-Screens
  begrenzt waere

Empfohlene Umsetzung:

- ein kleiner, global sichtbarer Secondary-Button oder Trigger aus einer
  shared Overlay-/Shell-Komponente
- Oeffnen eines gemeinsamen `BugReportModal`

Begruendung:

- das Repo hat neben den Tab-Screens bereits eigene Root-Stack-Flows fuer
  `account` und `admin/*`
- ein Trigger im Tab-Layout waere daher nur auf einem Teil der App sichtbar und
  nicht wirklich global
- Root-Level vermeidet doppelte Implementierung fuer Tabs, Admin-Hub und
  weitere Vollbild-Screens

Neue Komponente:

- `mobile/components/BugReportModal.tsx`

Modal-Inhalt:

- Titel `Problem melden`
- ein Freitextfeld `Was ist schiefgelaufen?`
- kurzer Hinweis, dass technische Daten automatisch mitgesendet werden
- `Senden` / `Abbrechen`

### Phase C: Importfehler-Einstieg

Integrationspunkt:

- [mobile/app/(tabs)/extract.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/extract.tsx)

Bei sichtbarem Fehlerblock:

- zusaetzlicher Button `Problem melden`
- derselbe `BugReportModal`, aber mit:
  - `reportType = 'import_failure'`
  - `sourceArea = 'import_error'`
  - vorausgefuellem Freitext optional leer oder mit kurzer Default-Formulierung
  - angereichertem Importkontext aus aktuellem Screen-State

Wichtig:

- der Button darf den bestehenden Fehler- oder Retry-Pfad nicht ersetzen
- der Report-Flow ist additiv, nicht blockierend

### Phase D: `Meine Meldungen`

Integrationspunkt:

- [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx)

Neue Section:

- `Meine Meldungen`

Inhalt:

- Ladezustand
- leere Liste mit kleinem Empty-State
- Liste der eigenen Reports mit:
  - Status-Badge
  - kurzer `description`-Auszug
  - Route/Quelle optional klein
  - Zeitstempel

Im ersten Slice nur Read-only. Keine Nutzerantworten, keine Bearbeitung.

### Phase E: Admin-Uebersicht

Empfohlener Ort fuer Slice 1:

- dedizierter Admin-Screen
  [mobile/app/admin/bug-reports.tsx](/home/patrick/Projekte/rezepti/mobile/app/admin/bug-reports.tsx)
- verlinkt aus dem bestehenden
  [mobile/app/admin/index.tsx](/home/patrick/Projekte/rezepti/mobile/app/admin/index.tsx)

Warum dort:

- der Screen-Stack und die Route existieren bereits als Andockstelle
- der Admin-Hub ist schon live und klar vom normalen Settings-Bereich getrennt
- `settings.tsx` bleibt fuer Nutzer-/Selbstservice lesbar und waechst nicht in
  ein zweites Admin-CMS hinein

Empfohlene Unterteilung:

1. Listenansicht mit Filtern
2. Detailbereich fuer selektierten Report
3. Status-Aenderung und `adminNotes`

Wenn der Screen zu schwer wird:

- Extraktion in `mobile/components/settings/AdminBugReportsSection.tsx`
- `Meine Meldungen` optional in eigene `MyBugReportsSection.tsx`

Fuer den Admin-Screen ist ein eigener `mobile/components/admin/`-Bereich sogar
sauberer als Settings-Komponenten-Reuse.

## UI- und Textregeln

### Globaler Einstieg

- dezent, nicht alarmistisch
- Label immer `Problem melden`
- kein roter Alarm-Stil als Default

### Importfehler

- klar sichtbar direkt unter der Fehlermeldung
- darf die primaere Aktion `erneut versuchen` nicht ueberlagern

### Nutzerstatus

Empfohlene Labels:

- `Eingegangen`
- `In Pruefung`
- `In Arbeit`
- `Geloest`
- `Geschlossen`

Intern koennen die API-Werte englisch bleiben, die UI rendert deutsche Labels.

## Fehlerverhalten

### Report erstellen

- bei Erfolg klare Success-Message
- bei Fehler klare Fehlermeldung, aber kein Screen-Absturz
- wenn Teile des Diagnosekontexts fehlen, trotzdem Report speichern

### Admin-Ansicht

- `metadata_json` defensiv rendern
- unbekannte Felder duerfen angezeigt oder ignoriert werden, aber nie die
  Seite brechen

### Netzwerk-/Serverausfall

- `Meine Meldungen` und Admin-Liste zeigen leeren Fehlerzustand mit Retry
- keine aggressive Retry-Loop

## Umsetzung in Phasen

### Phase 1: Datenmodell + DB-API

Dateien:

- neu: `supabase/migrations/<timestamp>_bug_reports.sql`
- anpassen: `src/schema.ts`
- anpassen: `src/db-react.ts`

Abnahme:

- Migration laeuft lokal
- Drizzle-Schema passt
- DB-Helfer fuer Create/List/Get/Update vorhanden
- RLS + Policies + Grants sind Teil derselben Migration und verifiziert

### Phase 2: Server-Routen + Validierung

Dateien:

- neu: `src/routes/bug-reports.ts`
- anpassen: `src/api-react.ts`
- optional neu: Helper in `src/bug-reports.ts` oder aehnlich fuer
  Sanitizing/Validation

Abnahme:

- Nutzer kann Report erstellen
- Nutzer kann eigene Reports lesen
- Admin kann alle Reports lesen und Status aendern
- Non-Admin bekommt `403 admin_required` auf Admin-Routen

### Phase 3: Gemeinsamer Client-Flow + Modal

Dateien:

- neu: `mobile/utils/bug-reporting.ts`
- neu: `mobile/components/BugReportModal.tsx`
- anpassen: `mobile/app/_layout.tsx`
- optional anpassen: `mobile/app/(tabs)/_layout.tsx` nur fuer tab-spezifische
  Platzierung/Finetuning

Abnahme:

- globaler Einstieg oeffnet Modal
- Einstieg ist auch ausserhalb des Tab-Layouts verfuegbar oder bewusst als
  Sign-in-CTA geregelt
- erfolgreicher Submit erzeugt Report
- Fehler- und Success-Zustaende sichtbar

### Phase 4: Importfehler-Integration

Dateien:

- anpassen: `mobile/app/(tabs)/extract.tsx`

Abnahme:

- bei Importfehler erscheint `Problem melden`
- Importkontext wird als `import_failure` mitgesendet
- Report-Flow stoert Retry/Reset nicht

### Phase 5: Settings-Ansichten

Dateien:

- anpassen: `mobile/app/(tabs)/settings.tsx`
- anpassen: `mobile/app/admin/bug-reports.tsx`
- empfohlen neu:
  - `mobile/components/settings/MyBugReportsSection.tsx`
  - `mobile/components/admin/AdminBugReportsScreen.tsx` oder aehnliche
    Extraktion fuer Listen-/Detaillogik

Abnahme:

- `Meine Meldungen` rendert eigene Reports
- Admin sieht Admin-Uebersicht auf `/admin/bug-reports`
- Statuswechsel aktualisiert Liste/Detailansicht

### Phase 6: Doku und TODO

Dateien:

- anpassen: `TODO.md`
- anpassen: `docs/TEST_STATUS.md`
- optional Runbook-Notiz in passender Doku

Abnahme:

- offener TODO-Punkt auf neuen Stand gezogen
- Teststatus und offene Follow-ups dokumentiert

## Tests

### Backend

Neue oder erweiterte Tests:

- `test/unit/bug-reports-routes.test.ts`

Abdecken:

- `POST /api/v1/bug-reports` ohne Auth -> `401`
- `POST /api/v1/bug-reports` mit Auth -> `200/201`
- Validierungsfehler bei leerer `description`
- Validierungsfehler bei unbekanntem `reportType`
- `GET /api/v1/bug-reports/me` zeigt nur eigene Reports
- `GET /api/v1/admin/bug-reports` fuer Non-Admin -> `403 admin_required`
- `PATCH /api/v1/admin/bug-reports/:id` fuer Admin -> Status update funktioniert
- `resolved_at`-Semantik stimmt
- Sanitizer verwirft sensible Felder
- RLS-Contract: normaler Nutzer sieht via DB/API nie fremde Reports
- Rate-Limit/Abuse-Guard liefert bei Trigger saubere `429`

### Mobile/UI

Neue oder erweiterte Tests:

- `mobile/test/bug-reporting-modal.test.tsx`
- `mobile/test/settings-bug-reports.test.tsx`
- `mobile/test/extract-bug-reporting.test.tsx`

Abdecken:

- globaler Button oeffnet Modal
- Modal submittet Nutzereingabe
- Importfehler-Button schickt `import_failure`
- `Meine Meldungen` rendert Status und Beschreibung
- Admin-Screen ist nur fuer Admin sichtbar
- Statusupdate in Admin-UI triggert Refresh
- globaler Einstieg ist auf Root-Level-Screens sichtbar oder liefert fuer anon
  bewusst einen Sign-in-CTA

### Sicherheits-/Regressionschecks

- kein Secret landet in `metadata_json`
- Importfehler-Report kann auch ohne `jobId` oder ohne `lastApiError` erstellt
  werden
- Admin-Ansicht bricht nicht bei unbekanntem JSON

## Offene Detailentscheidung

### Admin-Oberflaeche in Settings vs. eigener Screen

Fuer diesen Slice wird empfohlen:

- den bestehenden Admin-Screen `/admin/bug-reports` als Zielpfad nutzen

Begruendung:

- der Routing-Aufwand ist praktisch schon investiert, weil die Route als
  Platzhalter existiert
- der normale Settings-Screen bleibt Nutzerflaeche; Admin-Triage bleibt im
  Operator-Bereich
- der Slice ersetzt damit einen bestehenden Platzhalter statt eine zweite
  Admin-Flaeche aufzubauen

Exit-Kriterium fuer Split:

- wenn die Admin-Flows wachsen, Detail/Filter/Notizen in eigene
  `mobile/components/admin/*`-Bausteine extrahieren, den Screenpfad aber
  beibehalten

## Risiken und Gegenmassnahmen

### Risiko 1: `settings.tsx` wird zu gross

Gegenmassnahme:

- Admin- und Nutzer-Section frueh in eigene Komponenten ziehen

### Risiko 2: Metadaten wachsen unkontrolliert

Gegenmassnahme:

- serverseitige Allowlist statt freies JSON-Passthrough

### Risiko 3: Importfehler-Pfad verliert Fokus

Gegenmassnahme:

- Bug-Report strikt additiv halten
- primare Fehler- und Retry-UI nicht umbauen
- Fehlerkontext als `lastFailureSnapshot` explizit sichern statt ihn implizit
  aus losem Screen-State zu rekonstruieren

### Risiko 4: Admin-Liste wird spaeter mehr als ein Mini-Slice

Gegenmassnahme:

- sichtbare Listenfelder jetzt sauber modellieren
- komplexere Features bewusst deferen

## Abnahmekriterien

Der Slice gilt als abgeschlossen, wenn:

1. Nutzer ueber globalen Button einen allgemeinen Report absenden koennen.
2. Nutzer bei Importfehlern einen angereicherten `import_failure`-Report
   absenden koennen.
3. `bug_reports` serverseitig persistiert und auth-sicher ausgelesen wird.
4. `Meine Meldungen` in Settings nur eigene Reports zeigt.
5. Admins alle Reports sehen, Details oeffnen und Status pflegen koennen.
6. Sensitive Felder nicht in den gespeicherten Metadaten landen.
7. Backend- und Mobile-Tests fuer Gates, Statusfluss und Kontext gruen sind.

## Empfohlene Reihenfolge fuer die Implementierung

1. Migration + `src/schema.ts`
2. `src/db-react.ts` Helfer
3. `src/routes/bug-reports.ts` + `src/api-react.ts`
4. `mobile/utils/bug-reporting.ts`
5. `mobile/components/BugReportModal.tsx`
6. globaler Einstieg in `mobile/app/(tabs)/_layout.tsx`
7. Importfehler-Integration in `mobile/app/(tabs)/extract.tsx`
8. `Meine Meldungen` in `mobile/app/(tabs)/settings.tsx`
9. Admin-Section in `mobile/app/(tabs)/settings.tsx`
10. Tests + TODO/Doku-Nachzug
