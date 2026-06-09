# Multi-Auth Hardening Plan

Datum: 2026-06-09
Status: Geplant

## Ziel

Der erste Multi-User- und Auth-Onboarding-Unterbau ist auf `main`, aber der
Web-Pfad und mehrere Ownership-Grenzen sind noch nicht belastbar genug, um
Multi-Auth als wirklich abgeschlossen zu betrachten.

Nach Abschluss dieses Follow-up-Tracks soll gelten:

- Web-Login, Signup, Session-Refresh und Account-/Workspace-Einstieg sind fuer
  normale Nutzung stabil genug.
- Die reale Web-Persistenz fuer Settings/Theme/PDF ist im Auth-Kontext manuell
  abgenommen.
- Es gibt eine explizite Inventur aller noch unklaren oder ungeschuetzten
  User-/Workspace-Grenzen.
- BYOK- und Plattform-Credentials haben eine dokumentierte Zwischenregel oder
  ein sauberes Ownership-Modell, das keine falschen Privacy-Erwartungen
  erzeugt.

## Warum jetzt

Der gelieferte Auth-Onboarding-Slice hat den Grundpfad fuer Signup, Login,
Bootstrap und geschuetzte Mobile-Zustaende geschlossen. Offen ist jetzt nicht
mehr "gibt es Auth?", sondern "ist Multi-Auth im Web und an den
Ownership-Grenzen wirklich belastbar?".

Die vier priorisierten TODOs dafuer sind:

- `TODO.md:21` Web-Auth-/Account-/Workspace-Einstieg stabilisieren
- `TODO.md:52` Web-Persistenz-Abnahme nach Multi-Auth-Stabilisierung
- `TODO.md:41` Weitere ungeschuetzte Ownership-Flaechen inventarisieren
- `TODO.md:40` BYOK- und Plattform-Credential-Ownership

## Nicht-Ziele

- Keine Haushaltseinladungen.
- Kein Multi-Workspace-Switcher.
- Kein OAuth oder Magic Link in diesem Track.
- Kein Recipe-Sharing- oder Collections-Slice.
- Keine direkte Supabase-Data-API-Oeffnung fuer `recipes`.

Diese Punkte bleiben im separaten Folgeplan:
[Auth Onboarding Deferred Follow-Ups Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-deferred-followups-plan.md).

## Arbeitsaufteilung

Dieser Track ist in drei Teilplaene geschnitten:

1. [Web Auth Stabilization and Persistence](/home/patrick/Projekte/rezepti/docs/superpowers/plans/multi-auth-hardening-phases/2026-06-09-web-auth-stabilization-and-web-persistence-plan.md)
2. [Ownership Surface Inventory](/home/patrick/Projekte/rezepti/docs/superpowers/plans/multi-auth-hardening-phases/2026-06-09-ownership-surface-inventory-plan.md)
3. [Credential Ownership Boundary](/home/patrick/Projekte/rezepti/docs/superpowers/plans/multi-auth-hardening-phases/2026-06-09-credential-ownership-plan.md)

## Reihenfolge

1. Web-Auth-/Account-/Workspace-Einstieg stabilisieren.
2. Web-Persistenz im realen Auth-Flow manuell abnehmen.
3. Ownership-Surface-Inventur gegen den gelieferten Stand fahren.
4. Daraus die konkrete Credential-Boundary-Regel ableiten und umsetzen.
5. TODOs, Runbooks und Privacy-Copy auf den neuen Stand ziehen.

## Gate-Logik

### Gate 1: Web Auth Ready

Vor Gate 1 muss klar sein:

- Web-Session bleibt ueber Reload und neuen Tab konsistent.
- Auth-Deep-Links oder Redirect-Rueckkehr fuer Confirmation/Reset sind fuer den
  Web-Pfad nachvollziehbar.
- Account-/Workspace-Einstieg ist im Web sichtbar und fuehrt nicht in
  Sackgassen.

### Gate 2: Web Persistence Accepted

Vor Gate 2 muss klar sein:

- Settings-/Theme-/PDF-Zustaende wurden im echten Web-Flow mit eingeloggtem
  User geprueft.
- Reload, neuer Tab und neue Browser-Session wurden manuell getestet.
- Ergebnisse sind als kurzer Abnahme-Report dokumentiert.

### Gate 3: Ownership Inventory Complete

Vor Gate 3 muss klar sein:

- Alle relevanten Routen, Tabellen, disk-backed Konfigurationen und
  Credential-Pfade sind kategorisiert.
- Jeder Fund ist als `user-scoped`, `workspace-scoped`, `global`,
  `admin-only`, `disabled` oder `unknown` markiert.
- Fuer `unknown` gibt es keine stillschweigende Duldung, sondern eine
  Folgeentscheidung.

### Gate 4: Credential Rule Landed

Vor Gate 4 muss klar sein:

- BYOK- und Plattform-Credentials haben pro Pfad eine explizite Sichtbarkeits-
  und Mutationsregel.
- UI- und Doku-Copy versprechen nicht mehr Privacy als der Code liefert.
- Tests decken die gewaehlte Boundary ab.

## Definition of Done

Der Track ist fertig, wenn:

- Web-Multi-Auth fuer normale Nutzung nicht mehr als Blocker in `TODO.md`
  auftaucht.
- Die Persistenz-Abnahme schriftlich vorliegt.
- Die Ownership-Inventur als Referenzdokument existiert.
- Credential-Boundaries technisch und dokumentarisch konsistent sind.

## Risiken

- Web-Probleme koennen aus Expo-Web, Supabase-Session-Persistenz oder
  Query-Cache-Kopplung gleichzeitig kommen. Ohne klare Trennung wird Debugging
  teuer.
- Ownership-Luecken koennen in Randpfaden liegen, die bisher nur lokal oder als
  Admin genutzt wurden.
- Credential-Privacy ist besonders riskant, weil falsche UI-Copy sofort
  Vertrauen zerstoert, selbst wenn noch kein direkter Leak vorliegt.

## Verifikation

- Lokale Root- und Mobile-Tests fuer Auth/Protected Screens.
- Gezielte Web-Manuallaeufe fuer Signup, Login, Logout, Reload, neuer Tab,
  neue Session.
- Route-/Policy-Tests fuer Ownership- und Credential-Grenzen.
- Doku-Check: README, Runbooks, TODO und Settings-Copy duerfen sich nicht
  widersprechen.

## Arbeitsregel

Diese Datei ist der Main-Plan. Fuer konkrete Umsetzung jeweils nur den
betroffenen Teilplan laden und abarbeiten.
