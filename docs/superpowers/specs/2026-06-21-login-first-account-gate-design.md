# Login-First Account Gate Design

Stand: 2026-06-21
Status: Design steht; nur Planung, keine Umsetzung in diesem Schritt

## Ziel

Rezepti soll fuer ausgeloggte Nutzer app-weit auf einen klaren Einstieg reduziert werden:

- Nicht eingeloggte Nutzer sehen nur noch die `Account`-Seite.
- Alle anderen App-Seiten sind geschuetzt und leiten ohne Session auf `Account` um.
- Der bisherige verstreute Login-Hinweis auf einzelnen Unterseiten entfaellt.
- Der Debug-/Bug-Report-Button sitzt nicht mehr ueber der unteren Navigation, sondern in der Kopfzeile.

Der erste Schnitt ist absichtlich klein:

- kein neuer Marketing- oder Landing-Page-Ausbau
- kein neuer separater Auth-Screen
- keine inhaltliche Neugestaltung des bestehenden `Account`-Screens ueber das Notwendige hinaus

## Produkt-Guardrails fuer diesen Slice

Dieser Slice ist nicht nur ein Routing-Refactor, sondern ein Produkt-Funnel-Eingriff.
Deshalb gelten vor der spaeteren Umsetzung diese Guardrails:

- Der Erfolg wird nicht nur technisch, sondern auch produktseitig bewertet.
- `Account` darf nur dann die einzige oeffentliche Hauptroute bleiben, wenn der Einstieg fuer ausgeloggte Nutzer klar und nicht irrefuehrend ist.
- `returnTo` ist kein Nice-to-have, sondern Muss-Kriterium fuer geschuetzte Deep Links.
- Der Rollout soll hinter einem Feature-Flag erfolgen, damit ein Rueckbau moeglich bleibt.

Zu beobachtende Kennzahlen fuer den Rollout:

- Besuch `Account` -> erfolgreiche Anmeldung
- erfolgreiche Anmeldung -> erste nutzbare Zielroute
- Deep-Link-Aufruf -> erfolgreicher Ruecksprung auf Zielroute
- Abbruchrate auf `/account` fuer neue Web/PWA-Nutzer

Rollback-Schwelle fuer den spaeteren Rollout:

- deutlich schlechtere Login-Conversion oder
- haeufige Deep-Link-Abbrueche oder
- vermehrte Redirect-/Back-Loop-Bugs nach Aktivierung des Flags

## Produktentscheidung

Fuer den ersten Slice bleibt der bestehende `Account`-Screen die einzige sichtbare Einstiegsseite fuer Nutzer ohne Session.

Das bedeutet:

- Wer nicht eingeloggt ist, kann weder Rezeptliste noch Planer, Einkauf oder Settings normal sehen.
- Der bisherige `Account`-Button im Header wird unnoetig und kann entfernt werden.
- Die kleinen Hinweisfenster auf Unterseiten, die heute bei fehlender Anmeldung erscheinen, werden nicht mehr als primaerer UX-Pfad gebraucht.

Ein spaeterer Schritt kann die `Account`-Seite zu einer staerkeren Landing-Page ausbauen. Dieser Ausbau ist hier explizit nicht Teil des Scopes.

Diese Produktentscheidung wird fuer den ersten Slice nur unter folgenden Einschraenkungen freigegeben:

- Der ausgeloggte Shell-Zustand wird in diesem Dokument explizit festgelegt.
- Die `Account`-Seite bekommt fuer diesen Slice klar definierte Varianten fuer ausgeloggte und eingeloggte Nutzer.
- Ein spaeterer Ausbau zur staerkeren Landing-Page bleibt moeglich, ist aber nicht Voraussetzung fuer diesen ersten technischen Schnitt.

## Empfohlener Ansatz

Empfohlen ist ein zentraler Login-First-Guard auf Routing-Ebene statt verteilter Hinweise in einzelnen Screens.

Begruendung:

- Die Anforderung gilt ueberall, also sollte die Schutzlogik ebenfalls zentral liegen.
- Einzelne Hinweisfenster in `index`, `planner`, `shopping` oder `settings` fuehren sonst zu doppelter Verantwortung zwischen Routing und Screen-UI.
- Eine zentrale Guard-Loesung reduziert Folgefehler zwischen Mobile und Web/PWA.

## Scope fuer den ersten Slice

In Scope:

- Feature-Flag fuer den Login-First-Guard
- zentrale Session-Pruefung fuer alle App-Routen ausser `Account`
- Redirect nicht eingeloggter Nutzer auf `/account`
- Beibehaltung des bestehenden `Account`-Screens als einziger oeffentlicher Einstieg
- explizite Definition des ausgeloggten App-Shell-Verhaltens
- explizite Definition der `Account`-Varianten fuer ausgeloggte und eingeloggte Nutzer
- verpflichtende `returnTo`-Regeln fuer geschuetzte Deep Links und Auth-Callbacks
- Entfernen des `Account`-Buttons aus dem oberen Header
- Verschieben des globalen Debug-/Bug-Buttons von der unteren Overlay-Position in die Kopfzeile
- Entfernen oder Rueckbau der kleinen Auth-Hinweisfenster auf geschuetzten Screens
- Rueckbau des prominenten Account-Hinweisblocks in Settings
- Erweiterung der Tests auf Root-Guard, Back-Loop-Vermeidung und Deep-Link-Resume

Nicht in Scope:

- inhaltlicher Relaunch der `Account`-Seite ueber die hier benoetigten Zustands- und CTA-Klarstellungen hinaus
- neue Marketing-Texte, Benefits oder Hero-Elemente
- Umbau des Auth-Backends oder des Supabase-Flows
- Rollen-/Rechtekonzepte innerhalb eingeloggter Bereiche
- groessere Neugestaltung des Debug-/Bug-Report-Flows ausser seiner neuen Position und Sichtbarkeitsregeln

## Alternativen, die bewusst verworfen werden

### A. Soft Gate nur an intent-starken Stellen

Beispiele:

- Browse offen lassen
- Planner/Shopping erst bei Mutation sperren
- Save/Share/Auth erst bei commitment erzwingen

Warum fuer diesen Slice verworfen:

- hoehere Produkt-Flexibilitaet, aber mehr verstreute Guard-Logik
- fuehrt im aktuellen Code leichter zu inkonsistentem Verhalten zwischen Tabs, Detailseiten und Web/PWA
- ist ein valider spaeterer Produktpfad, aber nicht der hier freigegebene erste Schnitt

### B. Neuer dedizierter Auth-Screen getrennt von `Account`

Warum verworfen:

- waere klarer fuer die IA, vergroessert aber Scope, Dateiumfang und UI-Arbeit
- der aktuelle Slice soll den existierenden Screen bewusst weiterverwenden

### C. Oeffentliche Demo-/Browse-Seite zusaetzlich zu `/account`

Warum verworfen:

- produktstrategisch interessant, aber bewusst nicht Teil dieses kleinen ersten Slices
- wuerde zusaetzliche Inhalts- und UX-Entscheidungen erzwingen, die hier noch nicht getroffen werden

## Betroffene Bereiche

### 1. Zentrale Navigation und Guard

Wahrscheinlichster primaerer Eingriffspunkt:

- `mobile/app/_layout.tsx`

Hier liegt bereits globale Session-Wiederherstellung, Auth-Beobachtung und der bisherige globale Debug-/Bug-Button. Dieser Ort eignet sich fuer:

- einen zentralen Guard fuer geschuetzte Routen
- das Freischalten der `Account`-Route als einzige oeffentliche Seite
- die neue globale Header-Aktion fuer Debug/Bug-Reporting

### 2. Tab-Header

Betroffener Ort:

- `mobile/app/(tabs)/_layout.tsx`

Der dortige `Account`-CTA im Header wird entfernt, weil `Account` nicht mehr als freiwilliger Nebeneinstieg behandelt wird.

### 3. Account-Screen

Betroffener Ort:

- `mobile/app/account.tsx`

Der Screen bleibt funktional erhalten und dient kuenftig als einziger sichtbarer Einstieg fuer Nutzer ohne Session. Fuer diesen Slice wird nur geplant, wie er sich in den Login-First-Flow einfuegt; kein groesserer UI-Ausbau.

Wichtig fuer die spaetere Umsetzung:

- `Account` ist nicht ein einheitlicher Screen-Zustand, sondern mindestens zwei klar erkennbare Varianten
- ausgeloggte Variante: Auth-Einstieg mit klarem Primaer-CTA
- eingeloggte Variante: Profil-/Workspace-Verwaltung

### 5. Weitere zu schuetzende Routen

Der Guard wird nicht als Liste einzelner "bekannter" Schutzfaelle verstanden, sondern deny-by-default fuer alle nicht explizit freigegebenen App-Routen.

Explizit mitzudenken:

- `mobile/app/(tabs)/extract.tsx`
- `mobile/app/(tabs)/scanner.tsx`
- `mobile/app/admin/index.tsx`
- weitere Admin-Unterseiten
- Rezept-Detailseiten

Oeffentlich freigegeben fuer diesen Slice:

- `/account`
- Auth-Callback-Zustaende innerhalb von `/account`
- `+not-found`

### 4. Verstreute Auth-Hinweise

Betroffene Orte:

- `mobile/components/ProtectedAccessNotice.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/planner.tsx`
- `mobile/app/(tabs)/shopping.tsx`
- `mobile/app/(tabs)/settings.tsx`

Die heutige Darstellung kleiner Login-/Access-Hinweise innerhalb geschuetzter Screens ist mit einem harten Login-First-Gate nicht mehr der normale Nutzerpfad. Diese Flaechen muessen beim Implementierungsschritt entfernt, reduziert oder nur noch als Fallback fuer Sonderfehler genutzt werden.

## Vorgeschlagene Verhaltensregeln

### Ausgeloggte Nutzer

- duerfen nur `Account` sehen
- werden beim direkten Aufruf anderer App-Routen auf `Account` geleitet
- sehen keine kleinen In-Screen-Login-Karten mehr als Ersatz fuer fehlendes Routing
- sehen keine aktive geschuetzte Tab-Shell
- landen auf einer ausgeloggten `Account`-Variante mit klarer Auth-Prioritaet
- duerfen ueber den Redirect kein kaputtes Back-Verhalten erleben

### Eingeloggte Nutzer

- duerfen alle bisherigen App-Routen normal nutzen
- koennen `Account` weiterhin direkt als Profil-/Auth-Seite oeffnen, aber nicht mehr ueber den bisherigen Header-CTA
- behalten einen expliziten, spaeter sichtbar definierten Navigationspfad zu `Account`

### Passwort-Recovery und Auth-Links

Der bestehende Redirect-Flow fuer:

- `update-password`
- `confirmationSuccess`
- `authError`

soll erhalten bleiben. Der zentrale Guard darf diese Pfade nicht versehentlich blockieren oder in einen Redirect-Loop schicken.

## Festgelegte Shell-Entscheidung

Fuer diesen Slice wird die offene Produktfrage nicht vertagt, sondern festgelegt:

- Ausgeloggte Nutzer sehen keine normale geschuetzte Tab-Navigation.
- Der ausgeloggte Zustand nutzt einen fokussierten Public Shell rund um `/account`.
- Geschuetzte Routen duerfen bei fehlender Session nicht kurz sichtbar werden.
- Redirects auf `/account` verwenden `replace`, nicht `push`, damit keine Back-Loops entstehen.
- Wenn `/account` durch den Guard geoeffnet wurde, darf der sichtbare Zurueck-CTA nicht stumpf `router.back()` ausloesen.

## Account-Varianten fuer diesen Slice

### Variante A: ausgeloggt

Zweck:

- Anmeldung, Signup, Passwort-Reset, Auth-Fehler, Recovery

Pflichtverhalten:

- ein klarer Primaerpfad fuer Anmeldung oder Account-Erstellung
- klar sichtbare Sekundaerpfade fuer Reset und Recovery
- bei vorhandenem `returnTo` sichtbarer Hinweis, dass nach erfolgreicher Auth auf das Ziel zurueckgeleitet wird

### Variante B: eingeloggt

Zweck:

- Profil-/Workspace-Status
- Bootstrap-Status
- Logout

Pflichtverhalten:

- kein irrefuehrender Auth-Einstieg als Hauptinhalt
- klar getrennt vom ausgeloggten Einstieg

## Auth- und Redirect-Zustandsmatrix

| Zustand | Trigger | Sichtbare UI | Redirect-Regel |
|---|---|---|---|
| `unknown` | App startet, Session noch ungeklaert | stabiles Full-Screen-Interstitial | kein Redirect |
| `signed_out` | Session fehlt sicher | ausgeloggte `Account`-Variante | alle geschuetzten Routen per `replace` nach `/account` |
| `signed_in` | Session vorhanden | normale Zielroute oder eingeloggte `Account`-Variante | kein Redirect zu `/account`, ausser User oeffnet sie selbst |
| `password_recovery` | Recovery-Link | `Account` im `update-password`-Modus | oeffentlich erlaubt |
| `confirmation_success` | bestaetigte E-Mail | `Account` mit Success-Hinweis | oeffentlich erlaubt, danach `returnTo` bevorzugen |
| `auth_error` | Link kaputt/abgelaufen | `Account` mit Fehlerzustand | oeffentlich erlaubt |
| `bootstrap_loading` | Session da, Workspace wird vorbereitet | `Account` eingeloggte Variante mit Ladezustand | kein Wegschieben auf andere Fehler-UI |
| `bootstrap_failed` | Workspace-Setup fehlgeschlagen | `Account` eingeloggte Variante mit Retry | kein generischer Route-Redirect |

## Verbindliche `returnTo`-Regeln

- Jeder Guard-Redirect von einer geschuetzten Route nach `/account` setzt ein sicheres internes `returnTo`.
- `returnTo` wird nach erfolgreichem Login bevorzugt verwendet.
- `returnTo` wird auch bei Signup-Confirmation und Passwort-Recovery beibehalten, sofern das Ziel sicher intern ist.
- Fehlt ein gueltiges `returnTo`, ist der Default-Ruecksprung `/(tabs)`.
- Ungueltige oder externe Ziele werden verworfen.
- Logout aus einer geschuetzten Route fuehrt nicht auf die alte geschuetzte Route zurueck, sondern in den sicheren ausgeloggten Einstieg.

## Routing- und Edge-Case-Risiken

### Redirect-Loops

Hoechstes Risiko ist ein Loop zwischen Session-Restore, `Account`-Redirects und bereits vorhandenem Auth-Observer. Die spaetere Umsetzung muss klar zwischen diesen Faellen unterscheiden:

- Session ist noch unbekannt und wird gerade restauriert
- Session fehlt sicher
- Session ist vorhanden
- Nutzer ist bereits auf `/account`

Zusaetzliche Festlegung:

- Der Guard darf nicht auf einem simplen Boolean basieren, sondern auf einem gemeinsam genutzten Tri-State: `unknown`, `signed_out`, `signed_in`.

### Web/PWA-Hydration

Da die Anforderung auch fuer Web/PWA gilt, muss der Guard so gesetzt werden, dass:

- kein kurzes Aufblitzen geschuetzter Seiten vor dem Redirect sichtbar wird
- Session-Restore und Client-Hydration nicht gegeneinander arbeiten
- Fokus und Screenreader-Zustand nach Redirect konsistent bleiben

### Deep Links

Direktaufrufe wie:

- `/(tabs)/planner`
- `/(tabs)/shopping`
- Rezept-Detailseiten

muessen fuer ausgeloggte Nutzer sauber auf `Account` umgelenkt werden, mit verbindlichem Rueckkehrziel fuer spaeteres Fortsetzen.

### Debug-/Bug-Report-Aktion

Die Verschiebung in den Header loest das Ueberlappungsproblem unten, wirft aber eine Produktfrage auf:

Festlegung fuer diesen Slice:

- fuer eingeloggte Nutzer sichtbar und aktiv
- fuer ausgeloggte Nutzer nicht als aktive Header-Aktion im Public Shell
- fuer nicht-Tab-Routen wird das Verhalten explizit je Shell definiert statt implizit geerbt

### Accessibility

Die spaetere Umsetzung muss fuer Web/PWA explizit mitdenken:

- Focus-Management nach Redirect auf `/account`
- Screenreader-kompatible Statusansage fuer Lade- und Fehlerzustaende
- kein Keyboard-Fokus auf gesperrten Shell-Elementen im ausgeloggten Zustand

## Erfolgskriterien fuer den spaeteren Rollout

Technisch:

- kein geschuetzter Screen sichtbar, solange Auth ungeklaert oder sicher fehlend ist
- keine Redirect- oder Back-Loops
- Auth-Callback-Flows bleiben intakt

Produktseitig:

- Login-Conversion bricht nicht spuerbar ein
- Deep-Link-Resume funktioniert zuverlaessig
- keine auffaellige Zunahme von Abbruechen auf `/account`

## Testplan fuer die spaetere Umsetzung

### Routing

- ausgeloggter Nutzer startet auf Web/PWA und wird von jeder geschuetzten Route nach `/account` geleitet
- ausgeloggter Nutzer startet in der nativen App und sieht ebenfalls nur `/account`
- eingeloggter Nutzer bleibt auf der angeforderten Route
- `/account` bleibt ohne Loop erreichbar
- Redirects verwenden `replace`, nicht `push`
- deny-by-default deckt auch `extract`, `scanner`, Admin und Detailrouten ab

### Auth-Sonderfaelle

- Passwort-Recovery-Link oeffnet weiter den `update-password`-Modus
- bestaetigte E-Mail fuehrt weiter in den vorgesehenen Success-Flow
- bestehende `returnTo`-Parameter bleiben intakt
- ungueltiges `returnTo` faellt sicher auf `/(tabs)` zurueck
- Logout aus geschuetzten Bereichen erzeugt keinen Ruecksprung in geschuetzte Screens

### UI

- kein `Account`-Button mehr im oberen Header der Tabs
- Debug-/Bug-Report-Button liegt in der Kopfzeile und verdeckt keine unteren Menueknopfe
- keine kleinen Login-Hinweise mehr in Rezeptliste, Planer, Einkauf und Settings fuer den Standardfall "nicht eingeloggt"
- ausgeloggte Nutzer sehen keinen irrefuehrenden aktiven Tab-Shell-Zustand
- `Account` unterscheidet sichtbar zwischen ausgeloggter und eingeloggter Variante

### Regressionen

- Session-Restore-Interstitial funktioniert weiter
- Bug-Report-Modal laesst sich fuer eingeloggte Nutzer weiter oeffnen
- geschuetzte Daten-Screens crashen nicht, wenn sie frueh umgeleitet werden
- Back-CTA auf `/account` erzeugt nach Guard-Redirect keinen Loop
- Fokus landet auf Web/PWA nach Redirect stabil auf dem `Account`-Inhalt

## Umsetzungsempfehlung

Die spaetere Umsetzung sollte in dieser Reihenfolge erfolgen:

1. Tri-State-Auth-Quelle fuer Root-Guard festlegen und gegen Session-Restore absichern.
2. Oeffentliche Route-Inventur explizit festlegen: `/account` plus Auth-Callback-Zustaende.
3. deny-by-default-Guard in `mobile/app/_layout.tsx` ausarbeiten.
4. ausgeloggten Public Shell und sicheres History-Verhalten fuer `/account` umsetzen.
5. Header-CTA `Account` in `mobile/app/(tabs)/_layout.tsx` entfernen und Ersatzpfad fuer eingeloggte Nutzer festlegen.
6. Globalen Debug-/Bug-Report-Button pro Shell sauber neu positionieren.
7. Verstreute `ProtectedAccessNotice`-Flaechen und den Account-Hinweis in Settings zurueckbauen.
8. Root-Guard-, Deep-Link- und Back-Loop-Tests erweitern.

## Offene Punkte fuer spaeter

- Soll `Account` spaeter visuell als echte Landing-Page ausgebaut werden?
- Soll zusaetzlich zu `/account` spaeter eine oeffentliche Demo-/Browse-Flaeche entstehen?
- Soll das Produkt langfristig value-first statt strikt login-first werden?

## Ergebnis dieses Planungsschritts

Dieses Dokument beschreibt nur den freigegebenen ersten Slice:

- Login-First ueberall
- `Account` als einzige sichtbare Route fuer Nutzer ohne Session
- fokussierter Public Shell statt aktiver geschuetzter Tab-Shell
- verpflichtendes `returnTo` und sichere Redirect-Regeln
- Debug in die Kopfzeile mit klaren Sichtbarkeitsregeln
- verteilte Login-Hinweise entfernen

Es wurde in diesem Schritt bewusst keine Implementierung vorgenommen.
