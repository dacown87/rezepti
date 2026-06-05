# RecipeDeck

Rezepte aus URLs extrahieren — YouTube, Instagram, TikTok, Webseiten, Cookidoo — ins Deutsche übersetzen, speichern und verwalten.

**Production:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

---

## Features

- **Extraktion** aus YouTube, Instagram, TikTok, Webseiten, Cookidoo, Foto-Import
- **KI-Analyse** via Groq (Llama 3.3 / Llama 4 / Whisper) — Text, Audio, Bild
- **Rezeptverwaltung** — Inline-Bearbeitung, Bewertung, Notizen, Tags, Kategorien
- **Kochmodus** — Vollbild, Wake Lock, Portionsscaler
- **Meal Planner** — 7-Tage-Plan mit Drag & Drop
- **Einkaufsliste** — Multi-Rezept-Aggregation, Abhaken, Export
- **PDF-Export** — Rezeptkarte mit QR-Code
- **BYOK** — Bring Your Own Groq Key für URL-, Text-, Foto-, Audio- und Vision-Extraktion
- **PWA** — Homescreen-Installation auf iOS/Android

---

## Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Kostenloser [Groq API-Key](https://console.groq.com)
- [Supabase](https://supabase.com) Projekt (kostenloser Free-Tier reicht)

---

## Schnellstart

```bash
git clone git@github.com:dacown87/rezepti.git
cd rezepti

cp .env.example .env
# .env öffnen und ausfüllen:
#   GROQ_API_KEY=...
#   DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Dev-Modus (Hot Reload)

```bash
docker compose up rezepti
```

→ [http://localhost:3000](http://localhost:3000)

Änderungen in `src/` und `public/` sind sofort sichtbar.

### Production-Modus

```bash
docker compose --profile react-prod up rezepti-react-prod
```

Der Production-Build nutzt den aktuellen `Dockerfile`-Target `production` und baut den Expo-Web-Export im Container.

### Frontend-Build lokal

```bash
npm run build:mobile
```

Der lokale Expo-Web-Build braucht eigene `mobile/node_modules` (`npm --prefix mobile ci`). Im Docker-Build passiert das im `web-builder` automatisch. Der Expo-Export schreibt `Exported: ../public`, kann lokal aber am Ende haengen; fuer wiederholte Performance-Iterationen den Export einmal laufen lassen und danach nur `perf:bundle`/`perf:lighthouse` ausfuehren.

Nach Aenderungen an Expo-/React-Native-Abhaengigkeiten sollte zusaetzlich `cd mobile && CI=1 npx expo-doctor` gruen laufen. Fuer den aktuellen SDK-55-Stand sind insbesondere `react 19.2.0`, `react-dom 19.2.0`, `react-native 0.83.6` und `react-native-svg 15.15.3` der erwartete Zustand.

### Mobile Release Gate & Performance

```bash
npm --prefix mobile run typecheck
npm run test:mobile:rntl-guard
npm --prefix mobile run test:unit
npm run test:unit
npm run perf:bundle
npm run perf:lighthouse:compare
npm run perf:validate
npm run perf:stability:seed
npm run perf:budget:suggest
```

`perf:lighthouse:compare` misst die statische Expo-Web-Ausgabe mit `simulate` und `devtools` Throttling und schreibt `artifacts/performance/throttling-comparison.json`. Phase 4c ist abgeschlossen: die statische App-Shell in `mobile/app/+html.tsx` senkt die mobilen p50-LCP-Werte fuer `/shopping` und `/recipe/1` von ~25s auf ~0.9-1.45s.

Strict-Hardening: `perf:stability:seed` automatisiert die 10 echten Runs, ohne `history.json` direkt zu editieren; pro Messung schreibt nur `perf:validate` die History. Der Seed fuehrt jetzt standardmaessig einen verworfenen Warm-up-`perf:lighthouse`-Lauf vor `lighthouse-1` aus, damit ein einzelner Cold-Run-Ausreisser nicht das gemessene 10er-Fenster vergiftet. Danach berechnet `perf:budget:suggest` Budget-Vorschlaege aus methodenmarkierten vollstaendigen Runs (`p95 * 1.10`).

Aktueller Stand 2026-05-31: `schedule`-Runs laufen nach zwei gruenen Strict-Probes strict, `push`/`pull_request` bleiben warn-only und `workflow_dispatch` kann weiter zwischen `warn` und `strict` waehlen. Fuer neue Budget- oder Shell-Aenderungen bleibt der gueltige Pfad: `perf:stability:seed`, `perf:budget:suggest`, danach `perf:validate`.

---

## Konfiguration (`.env`)

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `GROQ_API_KEY` | ✅ | Server-Fallback für Groq; einzelne Extraktionsjobs können per BYOK überschreiben |
| `DATABASE_URL` | ✅ | Supabase PostgreSQL — **Transaction Pooler URL** (Port 6543) |
| `STAGING_DATABASE_URL` | | Separate Supabase-Staging-Datenbank für Advisor-/Migration-Proben |
| `RECIPE_SOURCE_AUDIT_DATABASE_URL` | | Optionale DB-URL für `scripts/get-db-urls.ts`; fällt auf `DATABASE_URL` zurück |
| `SUPABASE_URL` | ✅ fuer Multi-User Slice 1 | Server Supabase Projekt-URL fuer Token-Verifikation |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ fuer Multi-User Slice 1 | Server Supabase Publishable Key fuer Token-Verifikation |
| `SUPABASE_ANON_KEY` | optional | Server Supabase Legacy-Anon-Key-Fallback |
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ fuer Mobile Auth | Mobile-public Supabase Projekt-URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ fuer Mobile Auth | Mobile-public Publishable Key; bevorzugt gegenueber Legacy-Anon-Key |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | optional | Mobile-public Legacy-Anon-Key-Fallback |
| `STAGING_SUPABASE_URL` | | Staging-only Projekt-URL fuer Cloud-RLS-Smoke |
| `STAGING_SUPABASE_PUBLISHABLE_KEY` | | Staging-only Publishable Key fuer User-JWT-Smoke |
| `STAGING_SUPABASE_ANON_KEY` | optional | Staging-only Legacy-Anon-Key-Fallback |
| `STAGING_SUPABASE_SECRET_KEY` | | Staging-only Secret Key fuer Admin-Bootstrap/Cleanup; alternativ Legacy `STAGING_SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_RLS_SMOKE_CONFIRM` | | Muss fuer Staging-Smoke exakt `rezepti-staging` sein |
| `STAGING_AUTH_USER_EMAIL` | | Staging-only Testuser fuer Auth-/RLS-Smokes |
| `STAGING_AUTH_USER_PASSWORD` | | Staging-only Passwort fuer Auth-/RLS-Smokes |
| `STAGING_AUTH_ADMIN_EMAIL` | | Staging-only Admin-Testuser |
| `STAGING_AUTH_ADMIN_PASSWORD` | | Staging-only Admin-Passwort |
| `STAGING_AUTH_HOUSEHOLD_SLUG` | | Staging-only Testhaushalt fuer spaetere Household-Smokes |
| `PORT` | | Server-Port (Standard: `3000`) |
| `GROQ_TEXT_MODEL` | | Standard: `llama-3.3-70b-versatile` |
| `GROQ_VISION_MODEL` | | Standard: `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GROQ_WHISPER_MODEL` | | Standard: `whisper-large-v3-turbo` |
| `COOKIDOO_EMAIL` | | Thermomix-Login (optional) |
| `COOKIDOO_PASSWORD` | | Thermomix-Passwort (optional) |

> **DATABASE_URL:** Die direkte Supabase-URL (`db.[ref].supabase.co:5432`) funktioniert nur lokal.
> Für Production immer den Transaction Pooler verwenden.
> URL im Supabase Dashboard: Settings → Database → Connection pooling.

Echte Zugangsdaten gehören nur in `.env`, CI-/Deploy-Secrets oder den Secret Manager. Der Pre-commit-Hook blockiert hardcodierte Postgres-URLs, Supabase-Service-Role-JWTs und OpenAI-artige API-Keys in getrackten Dateien.

### Multi-User Auth Env-Matrix (Phase 0.5)

Der erste Multi-User-Slice macht Supabase Auth fuer Shopping/Planner verpflichtend. Die Server-API bleibt in Slice 1 die Datenzugriffsgrenze; Mobile nutzt nur `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` oder den Legacy-Fallback `EXPO_PUBLIC_SUPABASE_ANON_KEY`, um User-Sessions aufzubauen und Bearer Tokens an den Server zu senden.

| Klasse | Variablen | Client-sichtbar? |
|--------|-----------|------------------|
| Server-only | `DATABASE_URL`, `RECIPE_SOURCE_AUDIT_DATABASE_URL`, alle Secret-/Service-Role-Keys | Nein |
| Mobile-public | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` oder `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Ja |
| Staging-only | `STAGING_DATABASE_URL`, `STAGING_SUPABASE_*`, `STAGING_AUTH_*`, `SUPABASE_RLS_SMOKE_CONFIRM` | Nein |

Kein `service_role`-, Secret- oder Postgres-Passwort darf in Mobile/Web-Client-Code, Expo-Public-Env oder gebuildete Assets gelangen. Admin- und Rollenentscheidungen duerfen nicht aus user-editierbarem `user_metadata` kommen.

Auth-Fehler verwenden fuer Slice 1 den JSON-Vertrag `{ "error": { "code", "message", "cause", "fix" } }`. Route-Privacy-Matrix, Testuser-Bootstrap und Staging-RLS-Smoke stehen im Runbook: `docs/auth-runbook-route-privacy.md`.

---

## Datenbankschema deployen

Beim ersten Start das Schema in Supabase anlegen:

```bash
npx drizzle-kit push
```

---

## API-Endpunkte

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/` | GET | Web-App |
| `/api/v1/recipes` | GET/POST | Rezepte auflisten / erstellen |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | Einzelnes Rezept |
| `/api/v1/extract/react` | POST | Extraktion starten (Polling) |
| `/api/v1/extract/react/:jobId` | GET/DELETE | Job-Status / abbrechen |
| `/api/v1/extract/text` | POST | Freitext als Rezept extrahieren (Polling, min. 50 Zeichen) |
| `/api/v1/extract/photo` | POST | Foto-Upload als Rezept extrahieren (Multipart, Polling) |
| `/api/v1/extract/jobs` | GET | Letzte Extraktionsjobs auflisten |
| `/api/v1/images/search` | GET | Rezeptbilder suchen (`q`, optional `limit`) |
| `/api/v1/keys/validate` | POST | BYOK Key validieren |
| `/api/v1/keys` | POST | BYOK Key speichern |
| `/api/v1/keys/:keyHash` | DELETE | BYOK Key löschen |
| `/api/v1/health` | GET | Server + DB Status |
| `/api/v1/planner` | GET/POST/DELETE | Meal Planner, ab Multi-User-Slice mit Supabase Bearer Token + aktivem Haushalt |
| `/api/v1/shopping` | GET/POST/DELETE | Einkaufsliste, ab Multi-User-Slice mit Supabase Bearer Token + aktivem Haushalt |
| `/api/v1/dictionary` | GET | Zutaten-Wörterbuch lesen |
| `/api/v1/dictionary` | POST | Zutaten-Wörterbuch schreiben, nur Admin-Auth |
| `/api/v1/dictionary/match` | GET | Kanonischen Zutatennamen matchen |

BYOK kann bei Extraktionsrequests über `x-groq-key` oder als `apiKey` im JSON-Body mitgegeben werden. Der Key wird validiert, für den Job gehasht gespeichert und explizit bis zu LLM-, Whisper-, Vision-, Nutrition- und TikTok-OCR-Aufrufen weitergereicht; die Server-Umgebungsvariable bleibt unverändert.

Lokaler Supabase-RLS-Smoke fuer den Multi-User-Slice:

```bash
npm run test:auth
npx supabase start
npx supabase db reset --local --yes
npm run supabase:rls-smoke
```

Staging-RLS-Smoke vor Release, nur gegen bestaetigtes Staging-Projekt:

```bash
SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging npm run supabase:rls-smoke:staging
```

Der Staging-Smoke nutzt `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` und `STAGING_SUPABASE_SECRET_KEY`. Legacy-Fallbacks sind `STAGING_SUPABASE_ANON_KEY` und `STAGING_SUPABASE_SERVICE_ROLE_KEY`. Er erstellt kurzlebige Testuser und Haushalte, prueft RLS-Isolation ueber echte User-JWTs und raeumt die eigenen Testdaten wieder auf.

---

## Weitere Dokumentation

- `CLAUDE.md` — Projektstruktur, Befehle, Architektur und Agent-Konventionen
- `TODO.md` — Aktuelle offene Punkte, QA-Befunde und Roadmap-Notizen
- `test/README.md` — Teststruktur und lokale Testbefehle
- `docs/TEST_STATUS.md` — Historischer Teststatus und bekannte Testlücken
- `docs/auth-runbook-route-privacy.md` — Multi-User Auth Phase 0.5: Env-Matrix, API-Error-Kontrakt, Route-Privacy-Matrix und Staging-Smoke
- `docs/testing/rntl-migration-phase-0-inventory.md` — RNTL-Migrationsstand, Runtime-Blocker und verbleibende `UNSAFE_*`-Altfaelle
- `docs/testing/rntl-migration-authoring-checklist.md` — Regeln fuer neue Mobile-Tests waehrend der RNTL-Uebergangsphase
- `docs/SupaBase/supabase-advisor-remediation-plan.md` — reviewed Plan fuer die naechste Supabase-Advisor-Remediation
- `docs/performance/throttling-analysis.md` — Phase-4c Throttling-Vergleich, App-Shell-LCP-Fix und Budget-Hardening-Regeln
- `docs/performance/strict-probe-runbook.md` — Archiv/Runbook fuer Strict-Probe-Freigabe und spaetere Enforcement-Eskalationen
- `docs/superpowers/plans/2026-05-05-cleanup-punkte-3-4-5-6-7-8-9-12-13.md` — Cleanup-Plan und finaler Review-Stand

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Backend | [Hono.js](https://hono.dev) + TypeScript |
| Datenbank | [Supabase](https://supabase.com) PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Frontend | [Expo](https://expo.dev) (React Native Web) + TypeScript + Tailwind CSS |
| KI | [Groq API](https://console.groq.com) — Llama 3.3 / Llama 4 Scout / Whisper |
| Video | [yt-dlp](https://github.com/yt-dlp/yt-dlp) (via pip3 im Docker-Image) |
| Deployment | Docker → [Northflank](https://northflank.com) |
| CI/CD | GitHub Actions → Docker Hub (`dacown/rezepti:latest`) |

---

## Deployment

```
git push → main
  → GitHub Actions: Changelog + Version bump
  → Docker Hub: dacown/rezepti:latest
  → Northflank: auto-redeploy
```

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1–14 | Core, Cook Mode, Foto, PDF, Planner, Cookidoo, etc. | ✅ |
| 15 | React Native / Expo Web Migration | ✅ |
| SB-1 | Mobile: expo-sqlite entfernt → Server-API | ✅ |
| SB-2 | Server: SQLite → Supabase PostgreSQL | ✅ |
| Cleanup | Chefkoch/TikTok/Assets/Tests/PDF/Docker | ✅ im Workspace |
| — | Multi-User Login (Supabase Auth) | 🔜 |
| — | Rezept-Sharing via Link | 🔜 |
