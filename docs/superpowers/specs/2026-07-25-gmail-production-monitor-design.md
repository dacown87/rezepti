# Gmail Production Monitor Design

## Goal

Verify the end-to-end arrival of RecipeDeck transactional email in the single
operator mailbox `recipedeckapp@gmail.com`, and surface provider warning mail.
The monitor is an internal operations tool; it is not exposed through the app
API or UI.

## Scope

- Read-only Gmail access for one mailbox.
- A local, one-time OAuth authorization flow using the Desktop OAuth client.
- A production-safe check that searches for a supplied Brevo test-mail subject
  within a bounded age window and returns structured status only.
- A scheduled production invocation and operator runbook.

The monitor does not store message bodies, provide user-facing mailbox access,
send mail through Gmail, or parse customer email.

## Credential model

The downloaded Desktop OAuth JSON remains a local bootstrap artifact. Before
bootstrap, the Google OAuth consent screen must be published as **In
production** for this internal operator account; an External app left in
Testing issues this restricted-scope refresh token for only seven days. A local
authorization command obtains a refresh token. Local `.env` and Northflank
runtime secrets contain only `GMAIL_OAUTH_CLIENT_ID`,
`GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, and
`GMAIL_MAILBOX`. The JSON client artifact and local token cache are ignored by
Git. The production process never depends on a local filesystem path.

## Components and flow

1. `scripts/gmail-authorize.ts` reads the local client JSON, presents the
   consent URL, accepts the authorization callback, and writes an ignored local
   token cache.
2. `src/gmail-monitor.ts` creates an OAuth client from the runtime secrets and
   calls Gmail only with `gmail.readonly`. This restricted scope is intentional:
   the narrower `gmail.metadata` scope cannot use Gmail's server-side `q`
   search parameter, which the bounded exact-subject check needs.
3. `scripts/gmail-brevo-smoke.ts` runs a bounded search for an exact subject
   and recent message, returning success only when the mail is present.
4. A production scheduler invokes the smoke script after a controlled Brevo
   probe. Each probe uses a unique subject containing an ISO timestamp or UUID;
   the checker searches that exact subject in `INBOX` for up to 15 minutes after
   the send and succeeds only on exactly one matching message. A missing or
   ambiguous match is an alert. It logs no credentials or message body.

## Error handling and security

Missing configuration, expired/revoked authorization, Gmail API failure, and
an absent expected message produce actionable non-secret errors and non-zero
exit status. Searches are constrained to the configured mailbox and a caller
supplied exact subject/age window. The process logs counts and message IDs only
when required for diagnosis, never headers, bodies, access tokens, or refresh
tokens. An `invalid_grant` result is an explicit reauthorization condition:
operators rerun the local bootstrap command, replace only the refresh-token
secret in Northflank, and rerun the controlled probe.

## Verification

- Unit tests mock the Gmail client for found, missing, configuration-error, and
  API-error paths.
- A local OAuth run confirms that the configured Google account grants
  read-only access.
- A controlled Brevo message followed by the Gmail smoke script demonstrates
  end-to-end delivery.
- Northflank receives the four runtime secrets and runs the same smoke command
  before any recurring scheduler is enabled.
- The runbook exercises revoked-token recovery and a deliberately missing
  subject, and verifies that both fail closed without secret output.
