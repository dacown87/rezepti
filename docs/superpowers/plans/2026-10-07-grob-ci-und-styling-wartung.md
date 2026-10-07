# Grobplan: CI- und Styling-Wartung (Paket CI)

> **Status: GROBPLAN — muss vor der Umsetzung ausgearbeitet werden.** Beide Punkte sind **trigger-basiert** und werden erst angegangen, wenn der Ausloeser eintritt.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → *Code / Infrastruktur* („`supabase-rls-smoke`: Registry-Pull-Limit") und *Aktive Backlog / Watchlist* → *Spaeter* („Styling-Track").

## CI1 — `supabase-rls-smoke`: Registry-Pull-Limit
**Trigger:** Der Job scheitert ausserhalb von Dispatch-Serien an `toomanyrequests` / Registry-Fehlern (Nightlies 01.–06.10.2026 waren gruen).

**Grober Umfang:**
1. Pruefen, welches Image `supabase start` tatsaechlich aus Docker Hub zieht (Vermutung: Mapping im Prefetch-Schritt `.github/workflows/ci.yml` ~Zeile 199 ist invertiert — gepullt wird von Docker Hub, getaggt auf `public.ecr.aws`).
2. Umdrehen: von `public.ecr.aws/supabase/...` pullen und auf die Namen taggen, die die CLI erwartet.
3. Alternativ: Images per `actions/cache` als Tarball cachen.

**Offen:** Welche Image-Namen erwartet die aktuelle Supabase-CLI-Version? Gilt das Mapping noch nach CLI-Updates?

## CI2 — Styling-Track NativeWind 5 / Tailwind 4
**Trigger:** NativeWind 5 ist stabil und offiziell mit Expo SDK 57 kompatibel, oder NativeWind 4 blockiert ein Upgrade.

**Grober Umfang:** Migrationsleitfaden NativeWind 4→5 und Tailwind 3.4→4 pruefen (Config-Format, `className`-Verhalten, Metro-Plugin), Bundle-Budgets und Lighthouse in CI neu messen, visuelle Pruefung aller Routen.

**Offen:** Aufwand, Risiko fuer Performance-Budgets (Messserien nur in CI).
