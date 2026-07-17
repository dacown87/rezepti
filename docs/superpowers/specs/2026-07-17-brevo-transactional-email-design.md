# Brevo Transactional Email Design

Stand: 2026-07-17  
Status: abgestimmt, bereit fuer Implementierungsplanung

## Ziel

RecipeDeck versendet produktive transaktionale E-Mails ausschliesslich ueber
Brevo und die verifizierte Domain `recipedeck.app`.

Dies umfasst zwei klar getrennte Versandwege:

1. Rezept-Einladungen aus der RecipeDeck-API.
2. Account-Bestaetigungen und Passwort-Resets aus Supabase Auth.

Der kostenlose Brevo-Tarif ist ausreichend fuer den aktuellen Produktumfang.

## Entscheidungen

- Provider: Brevo.
- Produktname und sichtbarer Sendername: `RecipeDeck`.
- Versanddomain: `recipedeck.app`.
- Invite-Absender: `RecipeDeck <einladungen@recipedeck.app>`.
- Auth-Absender: `RecipeDeck <auth@recipedeck.app>`.
- Invite-Versand: Brevo Transactional Email REST API.
- Supabase Auth: Brevo SMTP.
- Kein Newsletter-, Marketing- oder allgemeines Mail-System ist Teil dieses
  Slices.

## Architektur

`src/mail.ts` bleibt die einzige Provider-Grenze fuer Recipe-Invite-Mails.
Die bisherige direkte Resend-Anbindung wird durch Brevos transaktionalen
REST-Endpunkt `POST /v3/smtp/email` ersetzt. Der Aufrufer und der vorhandene
Antwortvertrag bleiben stabil:

```ts
{
  status: "sent" | "skipped" | "failed",
  provider: "disabled" | "brevo",
  errorCode?: "mail_not_configured" | "provider_rejected" | "provider_unavailable"
}
```

Die API erstellt einen Recipe-Invite immer vor dem Versandversuch. Dadurch ist
der Invite auch bei einem Providerfehler nutzbar und der manuelle Share-Link
bleibt der Fallback.

Supabase versendet seine Auth-Nachrichten unabhaengig davon per Brevo SMTP.
Die vorhandene GitHub-Actions-Workflow-Konfiguration bleibt der einzige Weg,
um SMTP-Zugangsdaten in die Supabase-Auth-Konfiguration zu schreiben.

## Konfiguration und Geheimnisse

Alle Werte sind serverseitig oder als GitHub-Secrets gespeichert; sie duerfen
nicht in Mobile-, Web- oder Expo-public-Variablen landen.

RecipeDeck-Runtime-Secrets:

- `RECIPE_INVITE_EMAIL_PROVIDER=brevo`
- `BREVO_API_KEY`
- `RECIPE_INVITE_EMAIL_FROM=RecipeDeck <einladungen@recipedeck.app>`
- optional `RECIPE_INVITE_EMAIL_REPLY_TO`

GitHub-Secrets fuer den bestehenden Auth-Config-Workflow:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SENDER_NAME=RecipeDeck`
- `SMTP_ADMIN_EMAIL=auth@recipedeck.app`

Brevo muss vor dem produktiven Versand `recipedeck.app` per DNS verifiziert
haben (SPF und DKIM; DMARC wird empfohlen).

## Fehlerverhalten und Datenschutz

- Ohne Provider-Konfiguration: `skipped` mit `mail_not_configured`.
- Bei Brevo-4xx-Antwort: `failed` mit `provider_rejected`.
- Bei Netzwerkfehlern oder Brevo-5xx: `failed` mit `provider_unavailable`.
- Die UI zeigt keine Rohfehler oder Providerantworten.
- Server-Logs enthalten keine API-Keys, Invite-Tokens, Passwoerter oder
  vollstaendigen Empfaengeradressen.
- Brevo erhaelt nur Empfaengeradresse, Absender, Rezeptname und Invite-Link.

## Tests und Abnahme

- Unit-Tests mocken den Brevo-Endpunkt und pruefen Erfolg, fehlende
  Konfiguration, abgelehnte Anfrage und nicht erreichbaren Provider.
- Bestehende Route- und Mobile-Tests verwenden den aktualisierten
  `delivery.provider`-Vertrag.
- Die `.env.example` und das Mail-Runbook dokumentieren Brevo statt Resend.
- Nach DNS-Verifikation wird in Staging eine kontrollierte Invite-Mail an eine
  vom Betreiber festgelegte Testadresse gesendet.
- Supabase Signup-Bestaetigung und Passwort-Reset werden mit einem separaten
  Testkonto geprueft.

## Nicht im Scope

- Provider-Retries, Warteschlange oder persistierter Delivery-Status.
- Ein sichtbarer "erneut senden"-Endpunkt.
- Marketing-E-Mails, Newsletter oder Contact-Management.
- Aenderungen an Invite-Bindung, Annahme-Logik oder Datenbankschema.
