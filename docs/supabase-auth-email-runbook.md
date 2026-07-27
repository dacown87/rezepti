# Supabase Auth — E-Mail & Redirect Runbook

Behebt zwei Symptome, die beim Account-Erstellen auftraten:

1. **Bestätigungslink landet auf `http://localhost:3000/#access_token=…`** statt auf der Web-App.
2. **Generische E-Mail** („powered by Supabase", Absender `noreply@mail.app.supabase.io`) ohne RecipeDeck-Bezug.

Beides wird automatisiert über die Supabase **Management API** gesetzt — Workflow
[.github/workflows/supabase-auth-config.yml](../.github/workflows/supabase-auth-config.yml).
Projekt-Ref: `zdiqtnljdxuhinqzgcnd`. Produktions-URL: `https://p01--rezepti-app--2s7hvlwm5zc5.code.run`

---

## 0. Automatisiert via CI (empfohlen)

Der Workflow `Sync Supabase Auth Config` patcht `site_url`, `uri_allow_list` und die
E-Mail-Templates per `PATCH /v1/projects/{ref}/config/auth`.

**Einmalig:** GitHub → Settings → Secrets and variables → Actions → New repository secret
- `SUPABASE_ACCESS_TOKEN` — Personal Access Token (Supabase Dashboard → Account → **Access Tokens**)

**Optional (eigener Absender statt `noreply@mail.app.supabase.io`):**
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME`, `SMTP_ADMIN_EMAIL`.
Sind diese gesetzt, aktiviert der Workflow Custom SMTP; sonst bleibt der Supabase-Default.

Fuer Brevo lauten die Werte: `SMTP_HOST=smtp-relay.brevo.com`,
`SMTP_PORT=587`, `SMTP_USER=<Brevo SMTP Login>`, `SMTP_PASS=<Brevo SMTP Key>`,
`SMTP_SENDER_NAME=RecipeDeck` und `SMTP_ADMIN_EMAIL=auth@recipedeck.app`.
Der SMTP Key ist ein separater Brevo-Schluessel; der Invite-API-Key gehoert
nicht in `SMTP_PASS`.

**Auslösen:** GitHub → Actions → *Sync Supabase Auth Config* → **Run workflow**.
Läuft außerdem automatisch bei jedem Push auf `main`, der `supabase/templates/**` ändert.

Die folgenden Abschnitte beschreiben die manuelle Dashboard-Alternative.

---

## 1. Redirect-Problem (localhost) — DRINGEND

**Ursache:** Die **Site URL** steht noch auf dem Default `http://localhost:3000`. Der im Code gesetzte
`emailRedirectTo` (`https://…/account`, siehe [mobile/utils/auth.ts](../mobile/utils/auth.ts)) ist **nicht in der
Redirect-Allowlist** — Supabase verwirft ihn und fällt auf die Site URL (= localhost) zurück.

**Fix:** Dashboard → **Authentication → URL Configuration**

| Feld | Wert |
|------|------|
| **Site URL** | `https://p01--rezepti-app--2s7hvlwm5zc5.code.run` |
| **Redirect URLs** (Allowlist, je eine Zeile) | `https://p01--rezepti-app--2s7hvlwm5zc5.code.run/**` |
| | `recipedeck://**` (native App / Expo-Scheme) |
| | `http://localhost:3000/**` (nur falls lokale Dev-Logins gebraucht werden) |
| | `http://localhost:8081/**` (Expo-Web-Dev, optional) |

Nach dem Speichern: neuen Account anlegen → der Link führt jetzt auf
`https://…/account#access_token=…`. Die Web-App liest den Hash in
`syncAuthSessionFromUrl` aus und setzt die Session.

---

## 2. E-Mail-Branding

### 2a. Templates (Inhalt + Optik)

Dashboard → **Authentication → Emails** → jeweiliges Template öffnen und HTML ersetzen:

| Supabase-Template | Datei im Repo |
|-------------------|---------------|
| Confirm signup | [supabase/templates/confirmation.html](../supabase/templates/confirmation.html) |
| Reset password | [supabase/templates/recovery.html](../supabase/templates/recovery.html) |

Betreff z. B.: „Bestätige deine E-Mail für RecipeDeck" bzw. „RecipeDeck — Passwort zurücksetzen".

> Die Templates verwenden die Supabase-Variable `{{ .ConfirmationURL }}`. Nicht durch feste URLs ersetzen.

### 2b. Absender (`noreply@mail.app.supabase.io` loswerden)

Der generische Absender + „powered by Supabase" kommt vom **Supabase-Default-SMTP**. Solange der aktiv ist,
lässt sich der Absender nicht ändern (und es gilt ein striktes Rate-Limit). Für einen eigenen Absender:

Dashboard → **Project Settings → Authentication → SMTP Settings** → **Enable Custom SMTP** und die Brevo-SMTP-Daten eintragen. Danach:
- **Sender email**: `auth@recipedeck.app`
- **Sender name**: `RecipeDeck`
- `recipedeck.app` in Brevo per SPF/DKIM verifizieren (DMARC wird empfohlen; sonst landen Mails eher im Spam).

Ohne Custom SMTP bleiben Absender und „powered by"-Footer der Supabase-Standard.

---

## Sicherheitshinweis

Beim Debuggen wurde ein vollständiger `access_token` + `refresh_token` aus einer Bestätigungs-URL geteilt.
Refresh-Tokens sind langlebig. Empfehlung: in der betroffenen Session einmal **abmelden** (invalidiert das
Refresh-Token) oder Dashboard → Authentication → Users → betroffenen User → Sessions widerrufen. Da es ein
Test-Account ist, geringes Risiko — trotzdem nie Tokens in Chats/Logs teilen.
