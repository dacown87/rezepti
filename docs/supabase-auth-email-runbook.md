# Supabase Auth — E-Mail & Redirect Runbook

Behebt zwei Symptome, die beim Account-Erstellen auftraten:

1. **Bestätigungslink landet auf `http://localhost:3000/#access_token=…`** statt auf der Web-App.
2. **Generische E-Mail** („powered by Supabase", Absender `noreply@mail.app.supabase.io`) ohne RecipeDeck-Bezug.

Beides ist **Supabase-Dashboard-Konfiguration**, kein Code im Repo. Projekt-Ref: `zdiqtnljdxuhinqzgcnd`.
Produktions-URL: `https://p01--rezepti-app--2s7hvlwm5zc5.code.run`

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

Dashboard → **Project Settings → Authentication → SMTP Settings** → **Enable Custom SMTP** und Daten eines
E-Mail-Providers eintragen (z. B. Resend, Postmark, Brevo, SES). Danach:
- **Sender email**: z. B. `noreply@deine-domain.de`
- **Sender name**: `RecipeDeck`
- Domain beim Provider per SPF/DKIM verifizieren (sonst landen Mails im Spam).

Ohne Custom SMTP bleiben Absender und „powered by"-Footer der Supabase-Standard.

---

## Sicherheitshinweis

Beim Debuggen wurde ein vollständiger `access_token` + `refresh_token` aus einer Bestätigungs-URL geteilt.
Refresh-Tokens sind langlebig. Empfehlung: in der betroffenen Session einmal **abmelden** (invalidiert das
Refresh-Token) oder Dashboard → Authentication → Users → betroffenen User → Sessions widerrufen. Da es ein
Test-Account ist, geringes Risiko — trotzdem nie Tokens in Chats/Logs teilen.
