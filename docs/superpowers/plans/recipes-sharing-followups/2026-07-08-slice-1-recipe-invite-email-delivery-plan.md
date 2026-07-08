# Slice 1: Recipe-Invite Email Delivery Plan

Stand: 2026-07-08
Status: geplant
Masterplan:
[2026-07-08-recipes-sharing-followups-master-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-07-08-recipes-sharing-followups-master-plan.md)

## Ziel

Recipe-Invites sollen nicht nur einen Link erzeugen, sondern eine echte E-Mail
an die normalisierte Zieladresse senden. Der bestehende Invite-Vertrag bleibt:
Der Empfaenger akzeptiert den Invite mit derselben E-Mail-Adresse und bekommt
eine private Rezeptkopie.

## Nicht-Ziele

- kein Newsletter- oder Marketing-Mail-System
- kein freier Share-Link ohne E-Mail-Bindung
- kein Household-Invite-Flow
- kein Offline-Queueing fuer Invite-Erstellung
- keine HTML-Template-Plattform mit Admin-Editor

## Produktvertrag

- Sender gibt eine Ziel-E-Mail ein.
- API erstellt wie bisher einen Pending-Invite.
- Wenn Mailversand konfiguriert ist, sendet die API eine E-Mail mit
  Invite-Link.
- Wenn Mailversand nicht konfiguriert ist, bleibt der Link-Rueckgabe-Fallback
  fuer lokale Entwicklung und Tests erhalten.
- Mobile zeigt den Versandstatus:
  - `sent`: Mail wurde angenommen
  - `skipped`: Versand nicht konfiguriert, Link kann manuell geteilt werden
  - `failed`: Invite existiert, Versand fehlgeschlagen
- Ein fehlgeschlagener Mailversand darf nicht still als Erfolg dargestellt
  werden.

## Architektur

### Provider-Schicht

Neuer kleiner Service, z.B. `src/email.ts` oder `src/mail.ts`:

- liest Provider-Konfiguration aus Environment
- exportiert `sendRecipeInviteEmail(input)`
- normalisiert Provider-Fehler in stabile interne Codes
- hat einen Noop-/Disabled-Modus fuer Tests und lokale Entwicklung

Empfohlene Provider-Entscheidung:

- Wenn bereits ein Mail-Provider in Secrets existiert, diesen verwenden.
- Wenn keiner existiert, Resend oder ein SMTP-kompatibler Provider als kleinste
  Integration planen.
- Kein Provider-Key im Client oder in Mobile.

### API-Anpassung

Betroffene Route:

- `POST /api/v1/recipes/:id/share-invites`

Antwortmodell erweitern:

```json
{
  "invite": {},
  "shareUrl": "https://...",
  "delivery": {
    "status": "sent | skipped | failed",
    "provider": "disabled | resend | smtp",
    "errorCode": "mail_not_configured | provider_rejected | provider_unavailable"
  }
}
```

Regeln:

- Invite-Erstellung bleibt die transaktional wichtigste Operation.
- Mailversand passiert nach erfolgreicher Invite-Erstellung.
- Provider-Fehler loeschen den Invite nicht automatisch.
- Fuer spaetere Retry-Faehigkeit kann `delivery_status` auf
  `recipe_share_invites` ergaenzt werden, ist aber nur Pflicht, wenn ein
  Retry-Endpunkt im Slice gebaut wird.

### Optionales Datenmodell

Kleinste Variante ohne Retry:

- kein Schema-Change
- Versandstatus nur in API-Antwort und Logs

Robustere Variante:

- `recipe_share_invites.delivery_status text`
- `recipe_share_invites.delivery_provider text null`
- `recipe_share_invites.delivery_last_error text null`
- `recipe_share_invites.delivered_at timestamptz null`

Empfehlung:

- Schema-Change nur dann machen, wenn wir einen sichtbaren
  "erneut senden"-Pfad oder Admin-Diagnose im selben Slice bauen. Sonst
  zunaechst API-Antwort plus Server-Logs.

## Mobile

Betroffene Stellen:

- Recipe-Detail-Share-UI
- Invite-API-Client
- bestehende Tests fuer Share-Invite

UX:

- Bei `sent`: Erfolgstext "Einladung gesendet".
- Bei `skipped`: Link sichtbar/teilbar lassen.
- Bei `failed`: Fehler anzeigen und Link als manuelle Alternative anbieten,
  falls das Invite erstellt wurde.
- Keine langen Provider-Fehler in der UI.

## Tests

Server:

- Invite-Erstellung ruft Mail-Service mit normalisierter Zieladresse auf.
- Disabled-Konfiguration liefert `delivery.status = skipped`.
- Provider-Erfolg liefert `delivery.status = sent`.
- Provider-Fehler liefert `delivery.status = failed`, ohne den Invite zu
  verlieren.
- Kein Roh-Token wird persistiert.

Mobile:

- API-Client parst `delivery`.
- UI zeigt sent/skipped/failed unterscheidbar.
- Fehlerfall bietet keinen falschen Erfolg.

Staging:

- Test mit dedizierter Staging-Empfaengeradresse oder Provider-Testmodus.
- Kein Production-Smoke an echte fremde Empfaenger.

## Umsetzungsschritte

1. Provider-Entscheidung anhand vorhandener Secrets/Env treffen.
2. Mail-Service mit Disabled-Modus bauen.
3. Invite-Route nach erfolgreicher Erstellung an Mail-Service anbinden.
4. Mobile-Types und UI-Status nachziehen.
5. Unit-Tests fuer sent/skipped/failed.
6. Staging mit Testempfaenger verifizieren.
7. Production-Rollout mit kontrolliertem Smoke.

## Risiken

- Provider-Secrets fehlen in Staging/Production.
- Provider akzeptiert Mail, stellt aber nicht zu; Smoke muss mindestens API- und
  Provider-Annahme pruefen.
- Retry ohne Idempotenz koennte mehrere Mails senden. Deshalb im ersten Slice
  keinen automatischen Retry ohne expliziten Vertrag.
