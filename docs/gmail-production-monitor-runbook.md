# Gmail Production Monitor Runbook

This is an internal RecipeDeck operations check for the single operator mailbox
`recipedeckapp@gmail.com`. It is not an application feature and must not be
exposed as an HTTP endpoint.

## 1. One-time Google setup

1. Enable Gmail API in the Google Cloud project.
2. Keep the OAuth scope exactly `https://www.googleapis.com/auth/gmail.readonly`.
3. In Google Auth Platform, publish the consent screen as **In production**.
   A restricted-scope External app left in Testing issues refresh tokens that
   expire after seven days.
4. Keep `recipedeckapp@gmail.com` as the only authorized mailbox for this
   internal monitor.

## 2. Local authorization

The downloaded Desktop OAuth JSON is local-only and already ignored by Git.
Set these local `.env` values (the client-file path is intentionally never a
Northflank setting):

```dotenv
GMAIL_OAUTH_CLIENT_FILE=data/client_secret_<desktop-client>.json
GMAIL_OAUTH_TOKEN_FILE=data/gmail-oauth-token.json
GMAIL_MAILBOX=recipedeckapp@gmail.com
```

Run:

```bash
npm run gmail:authorize
```

Open the printed URL while signed in as `recipedeckapp@gmail.com`. The local
callback writes `data/gmail-oauth-token.json` with restrictive permissions.
Do not paste that file into GitHub, issue trackers, chat, or logs.

## 3. Northflank runtime secrets

Copy the values from the local token cache into these Northflank **runtime
secrets**:

```text
GMAIL_OAUTH_CLIENT_ID
GMAIL_OAUTH_CLIENT_SECRET
GMAIL_OAUTH_REFRESH_TOKEN
GMAIL_MAILBOX=recipedeckapp@gmail.com
```

For the self-sending, controlled end-to-end probe also set:

```text
GMAIL_BREVO_PROBE_ENABLED=true
RECIPE_INVITE_EMAIL_PROVIDER=brevo
BREVO_API_KEY
RECIPE_INVITE_EMAIL_FROM=RecipeDeck <einladung@recipedeckapp.de>
RECIPE_INVITE_EMAIL_REPLY_TO=recipedeckapp@gmail.com
```

No OAuth JSON path or token-cache file is configured in Northflank.

### Current setup (since 2026-09-27)

The probe runs as its **own Northflank cron job** `gmail-brevo-probe` in project
`rezepti`, not inside the web service. Its runtime environment holds exactly the
ten variables above; the web service `rezepti-app` environment was not touched
(an update there replaces the whole environment).

| Setting | Value |
|---|---|
| Image | `dacown/rezepti:latest` (same as the web service) |
| Command | `node dist/gmail-brevo-probe.js` |
| Plan | `nf-compute-10` |
| Schedule | `0 7 * * *` (UTC), `concurrencyPolicy: forbid`, `backoffLimit: 0` |
| Deadline | `activeDeadlineSeconds: 1500` (probe waits up to 15 min) |

Manual run: `POST /v1/projects/rezepti/jobs/gmail-brevo-probe/runs`; status via
`GET …/runs/{runId}`. To change one variable, read the job's environment first
and write back the complete set, as with the web service.

**Refresh token lifetime:** while the Google OAuth app is still in *Testing*,
the refresh token expires after 7 days and the job then fails with
`invalid_grant`. Publishing the app *In production* needs the privacy policy URL
`https://www.recipedeckapp.de/datenschutz` (Google Auth Platform → Branding).
After publishing, run `npm run gmail:authorize` once more and replace only
`GMAIL_OAUTH_REFRESH_TOKEN` in the job.

**Status 2026-09-27 — job created but suspended:** the first manual run failed
with Brevo `401 unrecognised IP address 34.91.8.145`. The job's egress IP
differs from the web service's, and the Brevo API only accepts allowlisted IPs.
Gmail was never reached. Before enabling the schedule, decide one of:
allowlist the job's egress IP in Brevo (Northflank egress IPs are not
guaranteed to be stable), a Northflank static egress IP, or running the probe
where the allowlisted IP already applies.

## 4. Commands

After the production image is deployed, a one-off Northflank job can run:

```bash
node dist/gmail-brevo-probe.js
```

It sends one uniquely identified invitation-style probe to the configured
operator mailbox, waits up to 15 minutes, and succeeds only when exactly one
matching Inbox message arrives. It reads only message metadata; it does not
retrieve or store mail bodies.

For a previously sent known test email, use:

```bash
node dist/gmail-brevo-smoke.js --subject="Rezept-Einladung: Brevo delivery probe <uuid>" --max-age-minutes=15
```

Schedule the probe as a Northflank Cron Job no more often than daily. Alert on
any non-zero exit status. The main web service should not run this command as
its start command.

## Recovery

If the job logs `invalid_grant` or authorization is revoked:

1. Run `npm run gmail:authorize` locally again.
2. Replace only `GMAIL_OAUTH_REFRESH_TOKEN` in Northflank.
3. Run one controlled probe manually.
4. Re-enable the daily Cron Job after the probe succeeds.
