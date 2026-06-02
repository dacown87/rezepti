# Product / QA Rest Decisions Plan

Datum: 2026-06-02
Status: Draft, recommended decisions

## Ausgangslage

`docs/TEST_STATUS.md` enthielt eine alte Liste bekannter Test-Luecken fuer Einkauf, Dictionary, Zutaten-Suche und PDF. Der Abgleich am 2026-06-02 hat gezeigt:

- Einkaufsliste-API, Dictionary-Match-Endpoint, Zutaten-Suche OR/AND und PDF-Helper sind bereits durch Unit- oder Mobile-Workflow-Tests abgedeckt.
- Uebrig sind keine reinen Test-Luecken mehr, sondern drei Produkt-/QA-Entscheidungen:
  - dedizierte Dictionary-UI ja/nein,
  - Semantik fuer Kurzbegriff-Suche wie `ei -> Ei/Eier`,
  - optionaler PDF-End-to-End-Rendercheck.

Dieser Plan entscheidet diese drei Punkte, damit sie nicht weiter als unklare offene Test-Luecken gefuehrt werden.

## Ziele

- Restpunkte aus `docs/TEST_STATUS.md` in konkrete Produkt-/QA-Entscheidungen ueberfuehren.
- Keine neue Feature-Arbeit in den Multi-User-Haupttrack ziehen.
- Klare Trigger definieren, wann ein Restpunkt wieder aktiv wird.
- Nur kleine Tests oder Doku-Aenderungen vorsehen, wenn sie unmittelbar Wert liefern.

## Nicht-Ziele

- Keine sofortige Dictionary-Verwaltungs-UI bauen.
- Keine neue Data-API-Freigabe fuer `ingredient_dictionary`.
- Keine globale Aenderung der Zutaten-Suchlogik ohne explizite Semantikentscheidung.
- Kein dauerhaftes PDF-E2E-Gate in CI einfuehren.

## Entscheidung 1: Dictionary-UI

### Empfehlung

Vorerst keine dedizierte Dictionary-UI bauen.

### Begruendung

`ingredient_dictionary` ist aktuell systemnah und backend-only:

- Die bestehenden Supabase-/Multi-User-Plaene halten `ingredient_dictionary` bewusst ohne direkte Client-Freigabe.
- Der erste Multi-User-Slice soll Auth, RLS und owner-sichere Nutzerdaten stabilisieren, nicht Systemtabellen fuer Client-Bearbeitung oeffnen.
- Eine Dictionary-UI waere erst wertvoll, wenn echte Nutzer falsche Kanonisierungen korrigieren muessen oder Synonyme sichtbar verwalten wollen.

### Trigger fuer spaeter

Dictionary-UI wieder aufnehmen, wenn mindestens einer dieser Faelle eintritt:

- wiederkehrende Nutzerprobleme durch falsche Synonyme/Kanonisierung,
- Wunsch nach manueller Pflege von Aliasen,
- Ingredient-Dictionary soll bewusst als read/write Client-Fall freigegeben werden,
- Multi-User-Modell fuer globale vs. nutzereigene Dictionary-Eintraege ist entschieden.

### Dann notwendige Vorarbeit

- Product-Modell entscheiden:
  - globales readonly Dictionary,
  - globale Admin-Pflege,
  - nutzereigene Alias-Ergaenzungen,
  - oder Mischmodell.
- RLS-/Grant-Modell neu planen.
- UI nur auf Basis eines konkreten Workflows bauen, z. B. "Alias korrigieren" statt generischer Tabellenverwaltung.

## Entscheidung 2: Kurzbegriff-Suche `ei -> Ei/Eier`

### Empfehlung

Kurzbegriffe nicht blind fuzzy oder per globalem Substring erweitern.

### Begruendung

Sehr kurze Suchbegriffe haben hohes False-Positive-Risiko:

- `ei` kann in vielen Woertern vorkommen, die nichts mit Ei/Eiern zu tun haben.
- Fuzzy-Matching auf zwei Zeichen ist kaum aussagekraeftig.
- Die aktuelle Zutaten-Suche hat bereits OR/AND/Threshold-Vertragstests; der offene Punkt ist nur die gewuenschte Semantik fuer Kurzbegriffe.

### Vorgeschlagene Semantik

Wenn dieser Fall umgesetzt wird:

- Kurze Begriffe mit weniger als drei Zeichen nur als exakter normalisierter Token-Match behandeln.
- Alias-/Dictionary-Matches duerfen kurze Begriffe erweitern, wenn explizit hinterlegt, z. B. `ei -> Ei`, `eier -> Ei`.
- Keine freie Substring-Suche fuer Kurzbegriffe in beliebigen Zutatenstrings.
- Keine Levenshtein-/Fuzzy-Ausweitung fuer Suchbegriffe mit weniger als drei Zeichen.

### Minimaler Umsetzungsslice

Nur wenn die Semantik akzeptiert wird:

1. Regressionstest fuer `ei` gegen Rezepte mit `Ei`/`Eier`.
2. Negativtest gegen Zutaten, die `ei` nur als Teil eines anderen Wortes enthalten und nicht als Ei gemeint sind.
3. Falls bestehende Logik die Semantik schon erfuellt: nur Test ergaenzen.
4. Falls nicht: Matching-Logik gezielt fuer Short-Terms haerten.

### Akzeptanz

- `ei` findet Rezepte mit Zutaten-Token `Ei` oder Dictionary-Alias `Eier`.
- `ei` erzeugt keine breiten Substring-Treffer.
- Bestehende OR/AND-/Threshold-Tests bleiben unveraendert gruen.

## Entscheidung 3: PDF-End-to-End-Rendercheck

### Empfehlung

Kein dauerhaftes Pflicht-Gate. PDF-E2E nur als optionaler QA-Smoke bei PDF-Aenderungen oder gemeldeten Regressionen.

### Begruendung

Der Kern ist bereits getestet:

- QR-Ziel und QR-Optionen sind in `test/unit/pdf-export-helpers.test.ts` abgedeckt.
- fehlende `source_url` ist ueber Helper-Verhalten abgedeckt.
- Umlaute/Sonderzeichen und HTML-Escaping sind abgedeckt.
- Ein echter Browser-/Native-Print-Rendercheck ist langsamer und potenziell fragiler als die bestehenden Unit-Tests.

### Trigger fuer PDF-Smoke

PDF-E2E-Smoke nur ausfuehren oder erweitern, wenn einer dieser Pfade geaendert wird:

- `mobile/utils/pdf-export.web.ts`,
- `mobile/utils/pdf-export.native.ts`,
- `mobile/utils/pdf-export-helpers.ts`,
- QR-Code-/Recipe-Link-Logik,
- Expo Print/Sharing/FileSystem/SAF-Pfade,
- gemeldete PDF-Regression aus manueller QA oder Produktion.

### Optionaler QA-Smoke

Wenn ein PDF-Smoke gebraucht wird:

- Web: PDF-Aktion mit Testrezept ausloesen und pruefen, dass kein Runtime-Fehler entsteht.
- Native: manuelle oder gezielt instrumentierte Pruefung fuer Print/Share/Download-Pfad.
- Inhaltlich nur grobe Signale pruefen, nicht Pixel- oder PDF-Binary-Snapshots.

### Akzeptanz

- Unit-Tests bleiben das Pflicht-Gate.
- E2E-PDF-Smoke wird dokumentiert als optionales QA-Verfahren, nicht als Dauer-CI-Gate.
- Bei PDF-Codeaenderungen wird im PR bewusst entschieden, ob der Smoke noetig ist.

## TODO-Status

Nach diesem Plan kann der zentrale TODO-Punkt "Produkt-/QA-Reste aus `docs/TEST_STATUS.md` entscheiden" als entschieden markiert werden, mit diesen Folgeeintraegen:

- Dictionary-UI bleibt im Produkt-Backlog, aber nicht aktiv.
- Kurzbegriff-Suche braucht erst Semantikfreigabe; empfohlene Semantik steht oben.
- PDF-E2E bleibt optionaler Trigger-Smoke, kein Pflicht-Gate.

## Verifikation fuer diesen Plan

Keine Code-Verifikation noetig. Relevanter Check ist dokumentarisch:

- `docs/TEST_STATUS.md` verweist nicht mehr auf veraltete offene Testluecken.
- `TODO.md` verlinkt diesen Plan und trennt aktive Arbeit von Backlog/Triggern.
