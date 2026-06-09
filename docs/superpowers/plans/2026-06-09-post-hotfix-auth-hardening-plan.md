# Post-Hotfix Auth Hardening Follow-Up Plan

Datum: 2026-06-09
Status: Geplant

## Ausgangslage

Der akute Credential-Auth-Hotfix ist bereits separat abgearbeitet und im
[Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md)
als umgesetzt dokumentiert. Offen bleibt jetzt der Folge-Track, der den
verbleibenden Auth-/Ownership-Unterbau fuer normale Web-Nutzung, klare
Besitzgrenzen und belastbare Account-Verwaltung schliesst.

Dieser Plan trennt deshalb bewusst:

- den bereits erledigten P0-Hotfix,
- die noch offenen Produkt- und Systemgrenzen,
- und die spaeteren groesseren Collaboration-Themen.

## Ziel

Nach Abschluss dieses Folge-Tracks soll gelten:

- Web-Login, Signup, Session-Restore und Account-/Workspace-Einstieg sind fuer
  normale Nutzung stabil und nachvollziehbar.
- Alle relevanten produktiven Ownership-Flaechen sind inventarisiert und als
  `user-scoped`, `workspace-scoped`, `global`, `admin-only`, `disabled` oder
  `unknown` klassifiziert.
- BYOK- und Plattform-Credentials haben eine explizite, technisch erzwungene
  Boundary-Regel ohne falsche Privacy-Copy.
- Account-Loeschung, Recovery-Fehlerpfade und Support-/Audit-Grenzen sind
  geplant und fuer die naechste externe Nutzung vorbereitet.

## Bezug auf TODO

Dieser Folgeplan deckt die offenen Punkte aus [TODO.md](/home/patrick/Projekte/rezepti/TODO.md) ab:

- `TODO.md:20` Web-Auth-/Account-/Workspace-Einstieg stabilisieren
- `TODO.md:46` BYOK- und Plattform-Credential-Ownership
- `TODO.md:47` Weitere ungeschuetzte Ownership-Flaechen inventarisieren
- `TODO.md:48` Account-Loeschung und Recovery-Haertung

## Nicht-Ziele

- Keine Haushaltseinladungen.
- Kein Multi-Workspace-Switcher.
- Kein OAuth- oder Magic-Link-Ausbau als neuer Auth-Modus.
- Kein Recipe-Sharing-/Collections-Slice.
- Keine PWA-Implementierung in diesem Track.

Diese Themen bleiben in separaten Folgeplaenen oder TODO-Punkten.

## Arbeitsaufteilung

Der Folge-Track ist in vier Teilplaene geschnitten:

1. [Web Auth Entry Stabilization](/home/patrick/Projekte/rezepti/docs/superpowers/plans/post-hotfix-auth-hardening-phases/2026-06-09-web-auth-entry-stabilization-plan.md)
2. [Ownership Surface Inventory](/home/patrick/Projekte/rezepti/docs/superpowers/plans/post-hotfix-auth-hardening-phases/2026-06-09-ownership-surface-inventory-followup-plan.md)
3. [Credential Boundary Finalization](/home/patrick/Projekte/rezepti/docs/superpowers/plans/post-hotfix-auth-hardening-phases/2026-06-09-credential-boundary-finalization-plan.md)
4. [Account Deletion and Recovery Hardening](/home/patrick/Projekte/rezepti/docs/superpowers/plans/post-hotfix-auth-hardening-phases/2026-06-09-account-deletion-and-recovery-hardening-plan.md)

## Reihenfolge

1. Web-Auth-/Account-/Workspace-Einstieg im echten Web-Flow stabilisieren.
2. Ownership-Flaechen gegen den aktuellen Code- und Datenstand inventarisieren.
3. Credential-Boundaries anhand der Inventur final festziehen.
4. Account-Loeschung und Recovery-Hardening so spezifizieren, dass externe
   Nutzer nicht an impliziten Support-Annahmen haengen.
5. TODO, Runbooks und produktnahe Copy auf den neuen Stand ziehen.

## Gate-Logik

### Gate 1: Web Entry Ready

Vor Gate 1 muss klar sein:

- Login, Signup, Logout und Session-Restore laufen im Browser ohne Sackgassen.
- Protected Screens zeigen keine irrefuehrenden Signed-out- oder Alt-Cache-
  Zustaende.
- Redirect-/Deep-Link-Rueckkehr fuer Confirmation und Reset ist im Web
  nachvollziehbar.

### Gate 2: Ownership Map Complete

Vor Gate 2 muss klar sein:

- Alle relevanten API-Routen, Tabellen, lokalen Stores und disk-backed Pfade
  sind klassifiziert.
- Jeder `unknown`-Fund hat eine Folgeaktion statt stillschweigender Duldung.
- P0/P1/P2-Risiken sind explizit priorisiert.

### Gate 3: Credential Boundaries Landed

Vor Gate 3 muss klar sein:

- Jeder Credential-Typ hat eine explizite Boundary-Regel.
- UI, Doku und Route-Verhalten versprechen dieselbe Grenze.
- Tests belegen `unauth denied`, Cross-User-Denial und Disabled-/Admin-Regeln.

### Gate 4: Recovery and Deletion Ready for Next Slice

Vor Gate 4 muss klar sein:

- Recovery-Fehlerpfade, Redirect-Matrix und Support-Fallbacks sind dokumentiert.
- Account-Loeschung und Datenfolgen fuer Profile, Memberships, Workspaces und
  Artefakte sind entschieden oder als explizite Restentscheidung markiert.
- Der naechste Umsetzungsslice kann ohne neue Grundsatzfragen starten.

## Definition of Done

Der Folge-Track ist fertig, wenn:

- der Web-Auth-Einstieg nicht mehr als offener Stabilitaetsblocker in `TODO.md`
  steht,
- eine Ownership-Referenzdoku fuer produktive Flaechen existiert,
- Credential-Boundaries technisch und kommunikativ konsistent sind,
- und Account-Loeschung/Recovery-Hardening nicht mehr nur als vage TODOs,
  sondern als umsetzbarer Folgeplan vorliegen.

## Risiken

- Web-Probleme koennen weiter aus Supabase-Session, Expo-Web-Navigation und
  Query-Cache-Kopplung gleichzeitig kommen.
- Ownership-Luecken liegen oft nicht in den Kernrouten, sondern in alten
  Admin-, CLI- oder lokalen Persistenzpfaden.
- Credential-Grenzen koennen wieder unscharf werden, wenn neue Connectoren ohne
  dieselbe Boundary-Disziplin dazukommen.
- Account-Loeschung ohne klare Household- und Artefakt-Regeln kann spaeter
  Datenverlust oder Support-Schulden erzeugen.

## Verifikation

- Root-/Mobile-Tests fuer Auth- und Protected-Screen-Verhalten.
- Gezielte Web-Smokes fuer Login, Signup, Logout, Reload, neuer Tab und neue
  Session.
- Route-/Policy-Tests fuer Ownership- und Credential-Grenzen.
- Doku-Check fuer TODO, Runbooks, Settings-Copy und Account-Copy.

## Arbeitsregel

Diese Datei ist der neue Main-Plan fuer die offenen Auth-/Ownership-Themen nach
dem Credential-Hotfix. Fuer konkrete Umsetzung jeweils nur den betroffenen
Teilplan laden und abarbeiten.
