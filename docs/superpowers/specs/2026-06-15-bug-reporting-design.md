# Bug Reporting Design

Stand: 2026-06-15
Status: Grobe Produktskizze

## Ziel

Rezepti soll einen nutzerfreundlichen Bug-Report-Flow bekommen, der fuer den Nutzer wenig Reibung hat, aber im Hintergrund genug technische Diagnosedaten sammelt, damit Fehler spaeter im Admin-Bereich effizient triagiert und behoben werden koennen.

Zusatzwunsch:

- globaler Bug-Button auf jeder Seite
- spezieller Bug-Report-Button direkt unter Import-Fehlermeldungen
- kleiner Nutzerbereich in Settings, in dem eigene Meldungen und ihr Status sichtbar sind
- Admin-Uebersicht mit Statuspflege und Diagnoseansicht

## Empfohlener Ansatz

Empfohlen ist ein zweistufiger Flow:

1. Ein allgemeiner Bug-Button ist global verfuegbar.
2. Bei fehlgeschlagenem Rezeptimport erscheint zusaetzlich direkt im Fehlerblock ein vorausgefuellter Report-Einstieg mit Kaefer-Icon.

Damit bleibt der Einstieg fuer normale Bugs konsistent, waehrend Importfehler mit deutlich mehr Spezialkontext gemeldet werden koennen.

## UX-Skizze

### 1. Globaler Bug-Button

- Dezent, aber auf jeder Seite erreichbar.
- Nicht aggressiv, eher als kleine Floating Action oder feste Secondary-Aktion.
- Klick oeffnet ein Modal.

### 2. Importfehler-Button

- Sichtbar direkt unter einer Rezeptimport-Fehlermeldung.
- Visuell klar als "Problem melden" mit Kaefer-Icon oder aehnlichem Hinweis.
- Klick oeffnet dasselbe Modal, aber bereits mit Importkontext vorausgefuellt.

### 3. Report-Modal

Das Modal soll bewusst klein bleiben:

- Titel: `Problem melden`
- kurzes Freitextfeld: `Was ist schiefgelaufen?`
- optionaler Hinweis: technische Daten werden automatisch mitgesendet
- bestaetigende Success-Message nach dem Absenden

Keine langen Formulare. Der Hauptwert kommt aus dem automatischen Kontext-Snapshot.

### 4. Nutzeransicht in Settings

Ein kleiner Bereich `Meine Meldungen` in den Einstellungen:

- Liste der eigenen Reports
- kurzer Titel oder Auszug
- Status sichtbar
- Zeitstempel sichtbar

Ziel ist nicht ein volles Support-Portal, sondern einfache Transparenz:

- `eingegangen`
- `in Arbeit`
- `geloest`
- optional spaeter `geschlossen`

## Automatisch zu erfassende Diagnosedaten

### Allgemein

- `user_id`
- ggf. aktiver Workspace/Haushalt
- aktuelle Route / aktueller Screen
- Timestamp
- App- oder Build-Version
- Browser, OS, Viewport
- letzte relevante Client-Fehler
- letzte relevante API-Fehler
- ggf. Request-ID / Correlation-ID, falls verfuegbar

### Zusatz bei Importfehlern

- Import-Typ
- Quell-URL oder Plattform
- Job-ID
- Job-Status
- Fehlerphase
- Fehlercode
- Fehlermeldung
- relevante Serverantwort, falls sicher loggbar

## Datenmodell-Skizze

Neue Tabelle `bug_reports`.

Kernfelder:

- `id`
- `report_type` — z. B. `general`, `import_failure`
- `status` — z. B. `new`, `triaging`, `in_progress`, `resolved`, `closed`
- `title` oder kurzer zusammengefasster Betreff
- `description`
- `user_id`
- `household_id` oder aehnlicher Ownership-Kontext falls relevant
- `route`
- `source_area` — z. B. `global_button`, `import_error`
- `metadata_json` fuer technische Diagnosedaten
- `created_at`
- `updated_at`
- optional `resolved_at`
- optional `admin_notes`

Empfehlung:

- sichtbare, filterbare Kurzfelder fuer Admin-Listen nicht nur in JSON verstecken
- technische Rohdaten in JSON ablegen, damit das Schema fuer den ersten Slice flexibel bleibt

## Admin-Bereich

Der Admin-Bereich braucht mindestens:

- Listenansicht aller Reports
- Filter nach Status, Typ und Datum
- Detailansicht mit kompletter Diagnose
- Statuswechsel direkt im UI

Erste sinnvolle Spalten in der Liste:

- Status
- Typ
- Nutzer
- Kurzbeschreibung
- Route oder Quelle
- erstellt am

## Scope fuer einen ersten Slice

In Scope:

- globale Bug-Entry-Aktion
- Importfehler-Button mit vorausgefuelltem Kontext
- Modal fuer Report-Erstellung
- DB-Tabelle fuer Reports
- Admin-Liste mit Statuspflege
- kleiner Settings-Bereich fuer den Nutzer

Nicht im ersten Slice:

- Chat oder Rueckfragen im Report
- Datei- oder Screenshot-Upload
- E-Mail-Benachrichtigungen
- komplexes Ticketing
- oeffentliche oder teamweite Kollaboration an Reports

## Offene Produktfragen fuer spaeter

- Soll ein Admin dem Nutzer eine sichtbare Rueckmeldung hinterlassen koennen?
- Brauchen Reports Prioritaet oder Severity?
- Sollen Screenshots spaeter unter Zustimmung hochgeladen werden?
- Sollen wiederkehrende Importfehler automatisch gruppiert werden?

## Empfehlung fuer die Umsetzungspaare

Die grobe Reihenfolge sollte sein:

1. Datenmodell + Admin-Liste
2. globaler Bug-Button + Modal
3. spezieller Importfehler-Report mit Zusatzkontext
4. Nutzeransicht `Meine Meldungen`

Damit ist frueh ein funktionierender Backoffice-Pfad vorhanden, bevor mehrere UI-Einstiege Reports erzeugen.
