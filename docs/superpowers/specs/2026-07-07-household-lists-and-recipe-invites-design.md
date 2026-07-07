# Household Lists and Recipe Invites Design

Datum: 2026-07-07
Status: Design steht; nur Planung, keine Umsetzung in diesem Schritt

## Ziel

Rezepti unterscheidet kuenftig klar zwischen zwei Sharing-Arten:

- Geteilte Listen sind Haushaltslisten.
- Ein direkt an eine Person geschicktes Rezept wird beim Annehmen eine private
  Kopie fuer diese Person.

Damit bleiben private Rezepte privat, Haushalte bekommen eine gemeinsame
Listenoberflaeche, und es entstehen keine ueberraschenden gemeinsamen
Bearbeitungen an demselben Rezeptdatensatz.

## Produktentscheidungen

1. Jeder User kann private Rezepte haben.
2. Haushaltslisten sind die geteilten Listen fuer Haushalte.
3. Haushaltslisten enthalten nur Haushaltsrezepte desselben Haushalts.
4. Wenn ein privates Rezept in eine Haushaltsliste gelegt wird, erstellt der
   Server zuerst eine Haushaltskopie und fuegt diese Kopie in die Liste ein.
5. Die UI benennt diesen Schritt bewusst, z.B. mit
   `Als Haushaltskopie hinzufuegen`.
6. Direktes Teilen an eine Person laeuft ueber ein E-Mail-Invite.
7. Der Invite darf an eine E-Mail-Adresse gehen, auch wenn es dazu noch keinen
   Rezepti-Account gibt.
8. Beim Accept muss der eingeloggte oder neu registrierte User dieselbe E-Mail
   verwenden, an die der Invite adressiert ist.
9. Beim Accept entsteht eine private Rezeptkopie beim Empfaenger.
10. Sharing aendert nie den Owner des Originalrezepts.

## Empfohlener Ansatz

Empfohlen ist ein E-Mail-gebundener Invite-Flow plus automatische
Haushaltskopien fuer Haushaltslisten.

Warum:

- Er passt zum bestehenden Owner-Modell `user` oder `household`.
- Er vermeidet geteilte mutable Rezepte zwischen fremden Usern.
- Er erlaubt Teilen an noch nicht registrierte Personen.
- Er haelt Haushaltslisten konsistent, weil dort nur Haushaltsrezepte liegen.
- Er macht die UX ehrlich: Beim Wechsel von privat zu Haushalt wird eine Kopie
  erzeugt und als solche benannt.

## Verworfene Alternativen

### A. Nur an bestehende User teilen

Diese Variante waere technisch kleiner, aber produktseitig schlechter. Nutzer
muessten vorher wissen, ob die Zielperson bereits einen Account hat. Spontanes
Teilen an Familie oder Freunde waere unnoetig holprig.

### B. Freier Share-Link ohne E-Mail-Bindung

Diese Variante waere am bequemsten, aber unschaerfer fuer Datenschutz und
Missbrauch. Wer den Link bekommt, koennte ihn einloesen. Fuer private
Rezeptkopien ist ein E-Mail-gebundener Accept die bessere erste Version.

### C. Haushaltslisten duerfen private Rezepte direkt referenzieren

Diese Variante wuerde die Listenlogik kurzfristig vereinfachen, aber die
Ownership-Regeln aufweichen. Eine geteilte Haushaltsliste koennte dann auf ein
privates Rezept zeigen, dessen Owner andere Haushaltsmitglieder nicht besitzen.
Das erschwert Bearbeiten, Loeschen, RLS und spaetere Planner-/Shopping-Regeln.

## Datenmodell Richtung

Bestehende Tabellen:

- `recipes` mit `owner_type`, `owner_user_id`, `household_id`, `created_by` und
  `source_recipe_id`
- `recipe_collections`
- `recipe_collection_items`
- `households`
- `household_memberships`
- `user_default_households`

Neue Tabelle fuer direkte Rezept-Invites:

- `recipe_share_invites`

Empfohlene Felder:

- `id`
- `source_recipe_id`
- `sender_user_id`
- `recipient_email`
- `token_hash`
- `status`: `pending`, `accepted`, `revoked`, `expired`
- `accepted_by_user_id`
- `accepted_recipe_id`
- `expires_at`
- `created_at`
- `updated_at`
- `accepted_at`

Invarianten:

- `source_recipe_id` zeigt auf ein fuer den Sender sichtbares Rezept.
- `sender_user_id` ist der eingeloggte User, der den Invite erstellt.
- `recipient_email` wird normalisiert gespeichert.
- Der rohe Token wird nie gespeichert, nur ein Hash.
- `accepted_by_user_id` und `accepted_recipe_id` sind nur gesetzt, wenn
  `status = 'accepted'`.
- Ein akzeptierter Invite erzeugt genau eine private Rezeptkopie.
- Abgelaufene oder widerrufene Invites erzeugen keine Kopie.

## Haushaltslisten

Haushaltslisten bleiben `recipe_collections` mit `owner_type = 'household'`.

Regeln:

- Haushaltslisten duerfen nur von Haushaltsmitgliedern gelesen und veraendert
  werden.
- Haushaltslisten duerfen nur Rezepte referenzieren, deren `owner_type` ebenfalls
  `household` ist und deren `household_id` zur Liste passt.
- Wird ein privates Rezept zu einer Haushaltsliste hinzugefuegt, erzeugt der
  Server eine Haushaltskopie und fuegt diese Kopie ein.
- Die Kopie erhaelt `source_recipe_id` auf das private Original.
- Derselbe Source-Recipe-Wunsch soll fuer dieselbe Haushaltsliste idempotent
  sein: kein mehrfaches Kopieren und kein doppelter Listeneintrag fuer denselben
  Ursprung.
- Wenn bereits eine passende Haushaltskopie in der Liste liegt, liefert die API
  diese bestehende Beziehung zurueck.

Diese Regel soll serverseitig erzwungen werden. Die UI darf die Entscheidung
erklaeren, aber sie ist nicht die Sicherheitsgrenze.

## Person-zu-Person-Invites

Direktes Rezeptteilen an Personen ist kein gemeinsames Bearbeiten. Es ist ein
Kopierangebot.

Flow:

1. Sender oeffnet ein privates oder sichtbares Haushaltsrezept.
2. Sender gibt eine Ziel-E-Mail ein.
3. API erstellt einen Pending-Invite mit Token-Hash und Ablaufdatum.
4. Empfaenger oeffnet den Link.
5. App zeigt eine schlanke Vorschau: Rezepttitel, Sender und Invite-Status.
6. Falls der Empfaenger nicht eingeloggt ist, fuehrt die App zu Login oder
   Registrierung.
7. Beim Accept prueft der Server die eingeloggte E-Mail gegen
   `recipient_email`.
8. Bei Match erstellt der Server eine private Rezeptkopie fuer den Empfaenger.
9. Invite wird `accepted` und referenziert die neue Kopie.

Nicht erlaubt:

- Accept durch einen Account mit anderer E-Mail.
- Wiederholter Accept mit zweiter Kopie.
- Mutieren des Originalrezepts durch den Empfaenger.
- Sicht auf vollstaendige Rezeptdaten vor erfolgreichem Accept.

## API-Verhalten

Neue Endpoints:

- `POST /api/v1/recipes/:id/share-invites`
- `GET /api/v1/share-invites/:token`
- `POST /api/v1/share-invites/:token/accept`

`POST /api/v1/recipes/:id/share-invites`

- Auth erforderlich.
- Body: `{ "email": "person@example.com" }`.
- Sender muss das Rezept sehen duerfen.
- Rezept muss kopierbar sein.
- E-Mail wird normalisiert und validiert.
- API erzeugt Token, speichert `token_hash`, und gibt fuer den ersten Slice
  entweder einen Link zurueck oder stoesst den vorhandenen E-Mail-Versand an,
  falls im Projekt schon ein Versandweg vorhanden ist.

`GET /api/v1/share-invites/:token`

- Darf eine minimale Vorschau liefern.
- Liefert keine vollstaendigen Rezeptzutaten oder Anleitung.
- Liefert klare Zustaende fuer `pending`, `accepted`, `revoked` und
  abgelaufen.

`POST /api/v1/share-invites/:token/accept`

- Auth erforderlich.
- Eingeloggte E-Mail muss mit `recipient_email` uebereinstimmen.
- Token muss gueltig, pending und nicht abgelaufen sein.
- API erstellt private Rezeptkopie mit `owner_type = 'user'` und
  `owner_user_id = auth.user.id`.
- API setzt `source_recipe_id` auf das Original.
- API markiert Invite atomar als `accepted`.
- Wiederholter Accept liefert die bereits erzeugte Kopie oder einen stabilen
  Already-Accepted-Zustand, aber keine zweite Kopie.

Bestehender Endpoint:

- `POST /api/v1/recipe-collections/:id/items`

Erweiterung:

- Bei privatem Rezept plus Haushaltsliste wird automatisch eine Haushaltskopie
  erzeugt.
- Bei Haushaltsrezept plus Haushaltsliste muss `household_id` uebereinstimmen.
- Bei unzulaessiger Kombination liefert die API einen klaren 4xx-Fehler.

## Mobile App Verhalten

### Rezept an Person teilen

Die Rezeptdetailansicht bekommt oder erweitert eine Share-Aktion fuer
E-Mail-Invites.

UX:

- E-Mail eingeben.
- Absenden.
- Erfolgszustand mit Hinweis, dass die Person das Rezept als private Kopie
  annehmen kann.
- Wenn noch kein E-Mail-Versand implementiert ist, kann der erste technische
  Slice den Invite-Link anzeigen oder teilen. Die Spec bevorzugt aber einen
  spaeteren echten Mail-Versand.

### Invite annehmen

Beim Oeffnen eines Invite-Links:

- Pending und passende Session: `Annehmen`.
- Nicht eingeloggt: Login/Register, danach zurueck zum Invite.
- Falsche eingeloggte E-Mail: Hinweis, dass der Invite fuer eine andere Adresse
  bestimmt ist.
- Abgelaufen, widerrufen oder schon angenommen: eigener Zustand mit klarer
  Meldung.

### Privates Rezept in Haushaltsliste

Wenn der User ein privates Rezept zu einer Haushaltsliste hinzufuegt:

- Die UI zeigt bewusst `Als Haushaltskopie hinzufuegen`.
- Nach Erfolg zeigt die Liste die Haushaltskopie.
- Das private Original bleibt unveraendert.

## Berechtigungen und RLS

Server-Autorisierung bleibt die primaere Grenze fuer den ersten Slice. Die
spaetere Supabase-Migration muss trotzdem RLS fuer neue Tabellen einplanen.

Grundregeln:

- Sender darf nur Invites fuer Rezepte erstellen, die er sehen darf.
- Sender darf eigene Invites sehen und widerrufen, falls Widerruf im Slice
  umgesetzt wird.
- Empfaenger darf einen Invite nur akzeptieren, wenn die authentifizierte
  Account-E-Mail zur normalisierten `recipient_email` passt.
- Autorisierung darf nicht auf user-editierbaren Metadata Claims beruhen.
- Falls JWT Claims fuer E-Mail genutzt werden, muss die API beruecksichtigen,
  dass Claims nicht immer frisch sind. Fuer kritische Vergleiche bevorzugt der
  Server die verifizierte Auth-User-Quelle.
- Tokens werden nur gehasht gespeichert.
- Fremde private Rezepte duerfen ueber Invite-Vorschauen nicht geleakt werden.

RLS-Richtung fuer `recipe_share_invites`:

- Sender kann eigene Invite-Zeilen lesen.
- Empfaenger kann einen Pending-Invite ueber serverseitigen Token-Flow
  akzeptieren.
- Direkter Tabellenzugriff aus Public Clients soll keine fremden Invites
  offenlegen.

## Fehlerfaelle

- Rezept nicht sichtbar: `404`, um Existenz nicht zu leaken.
- Sender nicht berechtigt: `403` oder `404` je nach bestehender API-Konvention.
- Ungueltige E-Mail: `400`.
- Invite abgelaufen: eigener Fehlercode oder Status.
- Invite revoked: eigener Fehlercode oder Status.
- Invite schon akzeptiert: stabiler Already-Accepted-Zustand.
- Falsche eingeloggte E-Mail beim Accept: `403` mit klarer App-Meldung.
- Haushaltsliste nicht sichtbar: `404`.
- User ist kein Haushaltsmitglied: `403` oder `404` gemaess bestehender
  Collection-Konvention.
- Rezept bereits in Haushaltsliste: keine Duplikate.

## Testpflichten fuer den spaeteren Implementierungsslice

Server/API:

- User kann Invite fuer eigenes privates Rezept erstellen.
- User kann Invite fuer sichtbares Haushaltsrezept erstellen.
- Fremdes privates Rezept kann nicht eingeladen werden.
- Accept mit passender E-Mail erzeugt private Kopie.
- Accept mit falscher E-Mail erzeugt keine Kopie.
- Wiederholter Accept erzeugt keine zweite Kopie.
- Abgelaufener Invite erzeugt keine Kopie.
- Token wird nicht im Klartext gespeichert.
- Invite-Vorschau leakt keine vollstaendigen Rezeptdaten.
- Privates Rezept in Haushaltsliste erzeugt Haushaltskopie.
- Haushaltsliste referenziert keine privaten Rezepte direkt.
- Doppelt hinzufuegen bleibt idempotent.

Mobile:

- Share-Invite-Form validiert E-Mail und zeigt API-Fehler verstaendlich.
- Invite-Link fuehrt ausgeloggte Nutzer ueber Auth zurueck zum Accept.
- Falsche Account-E-Mail zeigt den richtigen Zustand.
- Haushaltslisten-Aktion fuer private Rezepte verwendet den bewussten
  Kopie-Text.

Migration/RLS:

- Neue Tabelle hat RLS aktiviert oder ist nicht direkt aus exponierten Clients
  erreichbar.
- Policies oder Serverpfade decken Sender- und Empfaengerzugriff ab.
- Constraints verhindern inkonsistente Accepted-Zustaende.
- Lokale Migration wird vor Commit mit den Supabase-Advisors geprueft, wenn die
  Umsetzung beginnt.

## Nicht-Ziele

- Keine gemeinsamen mutable Rezepte zwischen zwei privaten Usern.
- Kein oeffentlicher Rezeptkatalog.
- Kein freier, nicht gebundener Share-Link im ersten Slice.
- Kein direktes Referenzieren privater Rezepte aus Haushaltslisten.
- Kein komplexes Rollenmodell pro Liste.
- Kein vollstaendiger Mail-Template-/Campaign-Ausbau, falls noch kein
  E-Mail-Versand im Projekt existiert.
- Keine QA-Ausfuehrung in diesem Designschritt.

