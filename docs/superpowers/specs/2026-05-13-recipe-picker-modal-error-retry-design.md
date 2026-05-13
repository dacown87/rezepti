# RecipePickerModal Error/Retry Design

## Kontext

Im mobilen Wochenplaner ist Phase 2 fast abgeschlossen. Der verbleibende Rest betrifft den `RecipePickerModal` in `mobile/app/(tabs)/planner.tsx`.

Aktuell unterscheidet der Modal bei `loadAllRecipes()` nicht zwischen:

- erfolgreichem Laden ohne Treffer
- fehlgeschlagenem Laden der Rezeptliste

Dadurch erscheint ein Netzwerk- oder API-Fehler als leerer Bestand mit `Keine Rezepte gefunden.`. Das verletzt das Phase-2-Ziel "sichtbare Error-States".

## Ziel

Der `RecipePickerModal` soll bei Ladefehlern einen sichtbaren, lokalen Rescue-State mit Retry anbieten.

Erfolgskriterien:

- Ein fehlgeschlagener Rezept-Load zeigt eine explizite Fehlermeldung im Modal.
- Der Nutzer kann den Fetch direkt im Modal erneut auslösen.
- Der Empty-State `Keine Rezepte gefunden.` erscheint nur noch nach erfolgreichem Laden ohne Ergebnisse.
- Die bestehende Planner-Fehlerbox fuer Wochenplan-, Add-, Remove- und Shopping-Fehler bleibt unveraendert.

## Empfohlener Ansatz

Der Modal bekommt einen eigenen `loadError`-State statt Fehler in den globalen `plannerError` hochzureichen.

Begruendung:

- Der Fehler entsteht lokal im Rezeptauswahl-Flow und sollte dort sichtbar bleiben.
- Der Nutzer muss den Screen-Kontext nicht verlassen oder interpretieren, warum eine leere Liste angezeigt wird.
- Der Ansatz ist mit der bestehenden Rescue-Strategie im Planner konsistent, ohne globale Fehlerzustaende aufzublasen.

## Verhalten

### Laden beim Oeffnen

Beim Oeffnen des Modals:

- `loading` wird auf `true` gesetzt
- `loadError` wird geloescht
- `loadAllRecipes()` wird gestartet

Bei Erfolg:

- `recipes` werden gesetzt
- `loadError` bleibt `null`
- `loading` wird beendet

Bei Fehler:

- `recipes` werden nicht als inhaltlicher Empty-State interpretiert
- `loadError` wird auf `Rezepte konnten nicht geladen werden.` gesetzt
- `loading` wird beendet

### UI-Zustaende

Der Modal hat danach genau drei sichtbare Zustaende:

1. `loading`
   - bestehender `ActivityIndicator`

2. `loadError !== null`
   - kompakte rote Fehlerbox im Content-Bereich
   - Fehlermeldung `Rezepte konnten nicht geladen werden.`
   - Button `Erneut versuchen`
   - Button `Schliessen`

3. erfolgreicher Load
   - `FlatList` wie bisher
   - `Keine Rezepte gefunden.` nur fuer echten Empty-State oder Suchfilter ohne Treffer

## Komponenten- und State-Schnitt

Betroffene Datei:

- `mobile/app/(tabs)/planner.tsx`

Geplante lokale States im `RecipePickerModal`:

- `recipes`
- `search`
- `loading`
- `loadError`

Geplanter Ablauf:

- Fetch-Logik in eine kleine lokale `loadRecipes`-Funktion ziehen
- Dieselbe Funktion sowohl im `useEffect` als auch im Retry-Button verwenden

Damit bleibt der Retry-Pfad exakt auf derselben Logik wie der Initial-Load.

## Fehlerbehandlung

Nicht Teil dieser Aenderung:

- globale Fehlerweitergabe an `plannerError`
- Alert-basierte Fehlerbehandlung
- Aenderungen an `loadAllRecipes()` selbst

Bewusstes Verhalten:

- Bei einem Fehler bleibt der Modal offen.
- Der Nutzer kann Retry ausloesen oder den Modal schliessen.
- Der Fehler wird beim naechsten Oeffnen des Modals neu initialisiert.

## Tests

Betroffene Testdatei:

- `mobile/test/planner-screen-fallbacks.test.tsx`

Neue Abdeckung:

- Wenn `loadAllRecipes()` im Picker fehlschlaegt, erscheint `Rezepte konnten nicht geladen werden.`
- `Keine Rezepte gefunden.` wird in diesem Fehlerfall nicht angezeigt
- `Erneut versuchen` startet einen zweiten Fetch
- Nach erfolgreichem Retry verschwindet die Fehlerbox und die Rezeptliste erscheint

Bestehende Tests fuer Planner-Fallbacks bleiben unveraendert und dienen als Regressionsschutz.

## Risiken

- Geringes Risiko fuer bestehende Planner-Logik, weil die Aenderung lokal auf den Modal begrenzt ist.
- Wichtig ist die saubere Trennung zwischen Fehler- und Empty-State, damit Suchfilter weiterhin korrekt funktionieren.

## Umsetzungsumfang

Klein und lokal:

- ein zusaetzlicher Modal-State
- ein lokaler Retry-Pfad
- ein UI-Fallback
- ein gezielter Testfall
