# Multi-User Auth Runbook & Route Privacy Matrix

Stand: 2026-06-04. Phase 0.5 ist als Dokumentation/Env-Vorbereitung umgesetzt; der erste Auth-Code-Schnitt fuer Server, Mobile-Session und Shopping-/Planner-Household-Scoping liegt im Feature-Branch. Ein lokaler Supabase-RLS-Smoke mit Bootstrap-Automation existiert; Cloud-/Staging-RLS-Smoke bleibt als Release-Gate offen.

## Ziel fuer Slice 1

Der erste Multi-User-Slice schuetzt Shopping und Planner mit Supabase Auth und serverseitiger Authorization. Die Server-API bleibt die Datenzugriffsgrenze fuer Slice 1; direkte Mobile-Data-API-Zugriffe werden nicht eingefuehrt.

Nicht versprechen: dass bereits alle Rezepti-Daten user-privat sind. BYOK, Import-Jobs, Plattform-Credentials, globale Default-Rezepte und Dictionary-Daten brauchen eigene Folgeentscheidungen.

Wichtig fuer Release-Kommunikation: Die Supabase Data API bleibt fuer `recipes` in Slice 1 geschlossen, aber die bestehende Server-API fuer Recipes ist weiterhin global/deferred. Login schuetzt in diesem Slice Shopping und Planner, nicht die komplette Rezeptverwaltung.

## Env-Matrix

| Klasse | Variablen | Darf in Mobile/Web-Client? | Zweck |
|---|---|---:|---|
| Server-only | `DATABASE_URL`, `RECIPE_SOURCE_AUDIT_DATABASE_URL`, alle Secret-/Service-Role-Keys | Nein | Direkter Backend-Zugriff, Migrationen, Audit-Scripts |
| Server Auth | `SUPABASE_URL`, `SUPABASE_ANON_KEY` oder `SUPABASE_PUBLISHABLE_KEY` | Nein | Bearer-Token-Verifikation im Server |
| Mobile-public | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` oder `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Ja | Supabase Auth Client und User-Session-Aufbau |
| Staging-only | `STAGING_DATABASE_URL`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`, `STAGING_SUPABASE_SECRET_KEY`, Legacy-Fallbacks `STAGING_SUPABASE_ANON_KEY` oder `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RLS_SMOKE_CONFIRM`, `STAGING_AUTH_USER_EMAIL`, `STAGING_AUTH_USER_PASSWORD`, `STAGING_AUTH_ADMIN_EMAIL`, `STAGING_AUTH_ADMIN_PASSWORD`, `STAGING_AUTH_HOUSEHOLD_SLUG` | Nein | Admin-/Testuser-Bootstrap und RLS-Smokes |

Guardrails:

- Kein `service_role`-, Secret- oder Postgres-Passwort in `mobile/`, `public/`, Expo-Public-Env oder gebuildeten Assets.
- Server-Autorisierung nicht auf `user_metadata` stuetzen. Falls Rollen gebraucht werden, serverseitige DB-Quelle oder belastbare `app_metadata` mit JWT-Frischebewusstsein verwenden.
- `getSession()` reicht nicht als serverseitige Authorization. Der Server muss Bearer Tokens gegen Supabase Auth verifizieren.

## Admin- und Testuser-Bootstrap

Lokal automatisiert:

```bash
npm run test:auth
npx supabase start
npx supabase db reset --local --yes
npm run supabase:rls-smoke
```

`npm run test:auth` ist der schnelle Unit-/Route-Vertrag fuer AuthContext, aktive Haushalte und Shopping-/Planner-Route-Scoping. Das RLS-Script liest danach `npx supabase status -o json`, erstellt kurzlebige User A/User B, Haushalte und Memberships, testet echte Supabase Data-API/RLS-Zugriffe und raeumt die eigenen Testdaten wieder ab.

Fuer Cloud/Staging gibt es jetzt einen gegateten Script-Pfad. Er darf nur gegen ein bestaetigtes Staging-Projekt laufen:

```bash
SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging npm run supabase:rls-smoke:staging
```

Der Script-Pfad benoetigt `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` und `STAGING_SUPABASE_SECRET_KEY`. Legacy-Fallbacks sind `STAGING_SUPABASE_ANON_KEY` und `STAGING_SUPABASE_SERVICE_ROLE_KEY`. Ohne `SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging` bricht das Script ab. URLs, die nach Production aussehen, werden ebenfalls abgelehnt.

Der manuelle Pfad bleibt als Fallback verbindlich, falls Staging-Keys nicht lokal verfuegbar sind:

1. Zielprojekt bestaetigen: Staging-Supabase-Projekt, nicht Production.
2. In Supabase Auth zwei Nutzer anlegen:
   - `STAGING_AUTH_USER_EMAIL`
   - `STAGING_AUTH_ADMIN_EMAIL`
3. Admin-Rolle nicht in `user_metadata` setzen. Fuer Slice 1 braucht es eine serverseitige Rollenquelle, z. B. spaetere `user_profiles`/`household_memberships`-Tabellen oder `app_metadata`.
4. Einen Testhaushalt mit `STAGING_AUTH_HOUSEHOLD_SLUG` vorbereiten oder den gegateten Staging-Smoke verwenden.
5. Tokens nur lokal/Staging verwenden und nicht in Logs, Screenshots oder Issue-Texten ablegen.

Offen fuer Release: Staging-Smoke gegen das bestaetigte Projekt tatsaechlich ausfuehren und Ergebnis in `docs/TEST_STATUS.md` dokumentieren.

## API-Error-Kontrakt

Auth- und Setup-Fehler sollen stabilen JSON-Aufbau liefern:

```json
{
  "error": {
    "code": "auth_missing",
    "message": "Sign in required.",
    "cause": "No Authorization bearer token was sent.",
    "fix": "Sign in again and retry the request."
  }
}
```

Pflichtfelder:

| Feld | Bedeutung |
|---|---|
| `code` | Stabiler Maschinen-Code fuer Mobile-Handling und Tests |
| `message` | Kurzer Nutzer-/Developer-lesbarer Fehler |
| `cause` | Konkrete Ursache, ohne Secrets oder Tokens |
| `fix` | Naechster sinnvoller Schritt |

Geplante Codes fuer Slice 1:

| Code | HTTP | Typischer Ausloeser |
|---|---:|---|
| `auth_missing` | 401 | Kein Bearer Token |
| `auth_invalid` | 401 | Falsches Schema, ungueltiger Token, Verifikation fehlgeschlagen |
| `token_expired` | 401 | Token abgelaufen oder nicht refreshbar |
| `admin_required` | 403 | User ist authentifiziert, aber kein Admin |
| `forbidden` | 403 | User authentifiziert, aber ohne Recht fuer Ressource |
| `setup_required` | 403 | User existiert, aber Profil/Membership fehlt |
| `no_household` | 403 | Kein aktiver Haushalt fuer geschuetzte Shopping-/Planner-Aktion |
| `not_found` | 404 | Ressource fehlt oder ist fuer diesen User nicht sichtbar |

## Route Privacy Matrix

| Route / Bereich | Aktuelle Phase-0.5-Klasse | Slice-1-Ziel | Hinweis |
|---|---|---|---|
| `GET /` | Public | Public | App-Shell bleibt oeffentlich erreichbar |
| `GET /api/v1/health` | Public | Public | Keine userbezogenen Details ausgeben |
| `POST /api/v1/keys/validate` | Deferred-but-warned | Authenticated oder backend-only entscheiden | BYOK-Privacy noch nicht als user-isoliert versprechen |
| `POST /api/v1/keys` | Backend-only/deferred | Authenticated spaeter nur mit per-user Ownership | `api_keys` bleibt Sicherheitsobjekt |
| `DELETE /api/v1/keys/:keyHash` | Backend-only/deferred | Authenticated spaeter nur eigene Keys | Hash darf keine fremde Loeschung erlauben |
| `GET/POST /api/v1/recipes` | Deferred-but-warned | Authenticated/household spaeter klaeren | Default-Rezepte und Ownership-Modell noch offen |
| `GET/PATCH/DELETE /api/v1/recipes/:id` | Deferred-but-warned | Authenticated/household spaeter klaeren | Nicht Teil des ersten geschuetzten Shopping/Planner-Slices |
| `POST /api/v1/extract/react` | Deferred-but-warned | Authenticated spaeter klaeren | Import-Jobs und BYOK-Isolation folgen |
| `GET/DELETE /api/v1/extract/react/:jobId` | Deferred-but-warned | Authenticated spaeter klaeren | Job-Ownership explizit modellieren |
| `POST /api/v1/extract/text` | Deferred-but-warned | Authenticated spaeter klaeren | Import-Ergebnis-Ownership offen |
| `POST /api/v1/extract/photo` | Deferred-but-warned | Authenticated spaeter klaeren | Upload-/Bild-Privacy offen |
| `GET /api/v1/extract/jobs` | Deferred-but-warned | Authenticated spaeter nur eigene Jobs | Keine globale Jobliste nach Login zeigen |
| `GET /api/v1/images/search` | Public/deferred | Public oder authenticated entscheiden | Suchanbieter-/Rate-Limit-Privacy pruefen |
| `GET/POST/DELETE /api/v1/planner` | Authenticated | Authenticated mit active household | Slice-1-Pflichtbereich |
| `GET/POST/DELETE /api/v1/shopping` | Authenticated | Authenticated mit active household | Slice-1-Pflichtbereich |
| `GET /api/v1/dictionary` | Public read | Public read/deferred | System-/Kanonisierungsdaten lesbar, keine Data-API-Freigabe |
| `POST /api/v1/dictionary` | Admin | Admin | Mutation nur mit serverseitigem Admin-Kontext |
| `GET /api/v1/dictionary/match` | Public read | Public read/deferred | Keine breite Data-API-Freigabe in Slice 1 |
| Admin-Funktionen | Admin | Admin | Admin-Quelle serverseitig modellieren, nicht `user_metadata` |

## RLS-Smoke

Lokal ausgefuehrt mit `npm run supabase:rls-smoke`. Der Smoke deckt ab:

- User A darf eigene Shopping-/Planner-Zeilen lesen, schreiben, aendern und loeschen.
- User B darf User-A-Haushaltszeilen nicht lesen, aendern oder loeschen.
- Zwei Mitglieder desselben Haushalts sehen gemeinsame Shopping-/Planner-Zeilen.
- Gemeinsame Household-Zeilen duerfen von Mitgliedern aktualisiert werden, ohne dass `user_id` als Creator-/Audit-Kontext umgeschrieben werden kann.
- `anon` kann `shopping_list` nicht lesen.
- `authenticated` kann `recipes` nicht ueber die Data API lesen.

Zusaetzlich decken Unit-Tests die Serverroute ab:

- Anonyme Requests auf geschuetzte Shopping-/Planner-Routen liefern `auth_missing`.
- Ungueltige Tokens liefern `auth_invalid`.
- Verifizierte Nutzer ohne Haushalt liefern `no_household`.

Noch offen: derselbe Smoke gegen bestaetigtes Cloud-/Staging-Projekt vor Release.
