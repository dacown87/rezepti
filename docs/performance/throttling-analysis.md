# Phase 4c Throttling Analysis

Stand: 2026-09-27 (Nightly-Rebaseline, Paket 5b) — Phase-4c-Abschnitte darunter unveraendert vom 2026-05-11.

## 2026-09-27: Why nightly `/` LCP was ~25 s

The strict nightly `performance-audit` had been red since June with `/` @ `mobile-375x812` LCP around 25 s (e.g. nightly `36302555446`: `25,472 ms` vs a `1,200 ms` budget). Three independent causes, two in the measurement and one in the app:

1. **Measurement: the audit server shipped JS uncompressed.** `scripts/performance/lighthouse-runner.mjs` serves `public/` through its own `http` server without compression. Production goes through `hono/compress` (`src/index.ts`). In the nightly artifacts the entry chunk had `transferSize 4,796,038` (= its raw size); production transfers `898,310` bytes for the same kind of file. Lighthouse `simulate` (Lantern) replays observed transfer sizes over `1,474 kbps` / `150 ms` RTT, so ~4.8 MB of JS alone costs ~23-25 s. That is why TTI was ~26 s on **every** route, and why `/shopping` occasionally jumped to ~25 s too (readiness spread `2267%`): whenever the entry chunk finished downloading before the first paint, Lantern counted the whole download towards LCP even though the LCP element was the static shell.
   - Fix: the audit server now gzips text payloads >= 1 KiB when the client accepts gzip (`shouldGzipResponse`, `test/unit/lighthouse-runner-compression.test.ts`). Entry transfer in the audit is now `904,908` bytes, TTI dropped from ~26 s to ~7 s on all routes.
2. **App: `/` had no pre-hydration LCP candidate.** Since the session-restore screen (2026-06-09), the static `public/index.html` only contains the small "Session wird wiederhergestellt…" text. The Phase-4c shell (`rd-audit-shell`) was only primed for `/shopping` and `/recipe/*`, so the LCP element on `/` was the hydrated "RecipeDeck" heading in `(tabs)/index.tsx` — i.e. LCP ≈ time until the entry chunk has executed. History confirms: `/` was ~903 ms in May and went to ~25 s on all viewports from 2026-06-11 onward. With fix 1 alone `/` still measured ~6.4 s (honest number for a cold load on slow 4G).
   - Fix: `+html.tsx` primes the shell for `/` as well. The shell is now retired by the root layout as soon as the real UI renders (`mobile/utils/static-app-shell.ts`, called when `sessionRestoring` turns false); the 5.2 s timer remains only as a fallback for a stalled hydration. Before this, the shell covered already-hydrated screens for the full 5.2 s.

3. **Measurement: the first Lighthouse run of every audit was cold.** Found in the first CI run after fixes 1 and 2 (`36330390774`): `/` @ mobile measured `1,238 ms` LCP and `3,165 ms` bootup, while `/` @ tablet (same route, second run) and every other sample were at `~904 ms` / `~1,300-1,400 ms`. A fresh CI runner has cold OS/Chrome caches, and `/` @ mobile is always the first and budget-relevant sample. `perf:stability:seed` already had a warm-up step, `perf:audit` did not. This is the same pattern as the May note "one cold-run LCP outlier" on `/`.
   - Fix: `lighthouse-runner.mjs` runs one discarded warm-up pass (`/` @ mobile, report `warmup.report.json`, not part of `summary.json` results) before measuring. `PERF_LIGHTHOUSE_WARMUP=0` disables it. Result in the next run (`36330938173`): `/` @ mobile `904 ms` LCP, `1,384 ms` bootup.

Not the cause: the login-first gate (CI builds without `EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE`, final URL stayed `/`), a missing `public/` export (route map resolved all three routes), or the throttling method (`simulate` throughout).

Local result after fixes 1 and 2 (simulate, 9 samples): LCP `901-902 ms` on all routes and viewports, LCP element "Ansicht wird vorbereitet", CLS <= 0.001, TTI ~7.0-7.4 s.

### CI evidence and rebaseline (2026-09-27)

10 sequential `workflow_dispatch` warn runs on `chore/perf-nightly-rebaseline` with all three fixes (`36330938173`, `36331254884`, `36331559098`, `36331898984`, `36332197660`, `36332495132`, `36332836069`, `36333166765`, `36333456523`, `36333787988`). `performance-audit` was green in all ten. The five `supabase-rls-smoke` failures in that series were `toomanyrequests: Data limit exceeded` on image pulls, unrelated to this change. Readiness after the series: `ready=true`, LCP spread `/` 0.6 %, `/shopping` 0.3 %, `/recipe/1` 0.8 %.

| mobile-375x812 | LCP (10 runs) | jsExecutionMs (10 runs) |
|---|---|---|
| `/` | 902-908 ms | 1,238-1,985 ms |
| `/shopping` | 903-905 ms | 1,209-2,075 ms |
| `/recipe/1` | 903-910 ms | 1,320-2,954 ms |

Bundle (Expo SDK 57 export, deterministic per commit): `jsBytes 5,744,683`, `gzipJsBytes 1,188,544` (p95 `1,191,752`), `largestJsAssetBytes 4,807,957` (the entry chunk). Old budgets were `5,550,000` / `1,140,411` / `4,620,000`.

`perf:budget:suggest` (p95 * 1.1) on that window and what was adopted in `scripts/performance/baseline.json`:

| Budget | old | suggested | adopted | why |
|---|---|---|---|---|
| `maxJsBytes` | 5,550,000 | 6,319,151 | **5,920,000** | deterministic; ~3 % headroom instead of 10 % so growth stays visible |
| `maxGzipJsBytes` | 1,140,411 | 1,310,927 | **1,225,000** | same, ~3 % over p95 |
| `maxLargestJsAssetBytes` | 4,620,000 | 5,288,753 | **4,950,000** | same, ~3 % |
| `lcpMs` `/` / `/shopping` / `/recipe/1` | 1200 / 1100 / 1300 | 999 / 995 / 1001 | **999 / 995 / 1001** | simulated LCP is shell-bound and stable (<1 % spread) |
| `cls` | 0.02 | 0 | **0.02** | 0 would fail on any sub-pixel shift |
| `jsExecutionMs` | 2295 / 2042 / 2372 | 2184 / 2282 / 3250 | **3250 on all routes** | measured bootup-time on shared runners, not simulated; same entry chunk on every route, spread is runner noise. With the old values `/shopping` would have failed 3 of 10 nights |

Cheap entry-chunk savings, not part of this rebaseline (tighten the bundle budgets again when they land):

- **`lucide-react-native` bundles all 1,721 icons** (~1.2 MB raw / ~133 KB gzip of the 4.8 MB entry chunk) while the app imports 73. Metro does not tree-shake the barrel import and the package `exports` map blocks per-icon deep imports, so this needs Expo tree shaking or an import rewrite. Largest single saving.
- **jsQR** (~130 KB raw / ~47 KB gzip) is only the fallback for browsers without `BarcodeDetector`: lazy-loaded in PR #66, entry chunk `4,695.3 kB -> 4,567.7 kB` in CI. Total `jsBytes` stays the same because the code only moves to its own chunk.

## Decision

Outcome Z is the validated Phase 4c fix: add a minimal static, route-aware App Shell so Lighthouse has a stable LCP candidate before Expo Web hydration.

Reason: the first optimization slice (Outcome Y, PDF lazy-loading) reduced the entry bundle, but the real non-sandboxed Lighthouse comparison still showed `/shopping` and `/recipe/1` mobile LCP around 23-26s. After adding the static App Shell, both `simulate` and `devtools` report mobile p50 LCP below 1.5s for all audited routes.

## Validation Status

Phase A tooling and the real comparison run are complete:

- `LIGHTHOUSE_THROTTLING=simulate|devtools` is supported by `scripts/performance/lighthouse-runner.mjs`.
- `scripts/performance/throttling-compare.mjs` runs both methods via environment variables and writes method comparisons with p50/p75 and simulate-minus-devtools deltas.
- `scripts/performance/bundle-report.mjs` records raw and gzip JS metrics.
- `scripts/performance/validate-status.mjs` supports method-aware Lighthouse budgets plus gzip JS and JS execution checks.

The non-sandboxed `npm run perf:lighthouse:compare` run completed successfully on 2026-05-11 with 3/3 runs for `simulate`, 3/3 runs for `devtools`, and 9 samples per run.

## Optimization Slices Implemented

The initial Outcome-Y slice lazy-loads PDF export:

- `mobile/app/(tabs)/index.tsx` now imports `shareRecipeCardsPDF` only inside the export handler.
- `mobile/app/recipe/[id].tsx` now imports `shareRecipePDF` only inside the PDF handler.

This keeps `jspdf`, `qrcode`, and related export code out of the initial screen path until the user explicitly exports.

The validated Outcome-Z slice adds a static App Shell:

- `mobile/app/+html.tsx` injects a lightweight `rd-audit-shell` before the Expo root.
- The shell is route-aware for `/shopping` and `/recipe/*`.
- The shell fades out after the first startup window and does not affect native mobile builds.

## Bundle Evidence

Before Phase 4c, the largest JS asset in the tracked bundle report was:

- Entry chunk: `4,614,669` bytes raw.

After PDF lazy-loading plus the App Shell export:

- Entry chunk: `4,157,132` bytes raw before the shell-only rebuild; `4,156,752` bytes raw after the shell-only rebuild.
- New `pdf-export` chunk: `459,615` bytes raw before the shell-only rebuild; `459,615` bytes raw after the shell-only rebuild.
- Total JS gzip: `1,036,737` bytes.

Interpretation: lazy-loading moved about 457 KB raw out of the initial entry chunk and into an interaction-loaded chunk. That helped bundle shape but did not fix LCP alone; the App Shell is the slice that fixed the measured mobile LCP.

## Lighthouse Evidence

Mobile p50 LCP from `artifacts/performance/throttling-comparison.json` after the App Shell:

| Route | simulate p50 LCP | devtools p50 LCP | simulate-minus-devtools |
|---|---:|---:|---:|
| `/` | `903.006 ms` | `1449.870 ms` | `-546.864 ms` |
| `/shopping` | `901.733 ms` | `1448.252 ms` | `-546.519 ms` |
| `/recipe/1` | `1051.650 ms` | `1413.536 ms` | `-361.886 ms` |

Current validation:

```bash
npm run perf:bundle
npm run perf:lighthouse:compare
npm run perf:validate
```

`perf:validate` is warn-only and reports `lighthouse=ok`, `warningRate=0.0000`, and `fullCoverage=true`. The 2026-05-12 strict-hardening seed produced 10 complete `simulate` runs for the `mobile-375x812` budget window. Five consecutive green warn-mode CI runs (`25740992098`, `25741507844`, `25741808184`, `25742133438`, `25742437228`) then satisfied the observation gate, and a single manual `workflow_dispatch` with `perf_enforcement=strict` (run `25742783313`) passed green on 2026-05-12. CI policy remains warn-only for `push`/`pull_request`/`schedule`; strict is reserved for further explicit manual probe dispatches.

## Strict-Gate Rule

Do not enable the first manual strict probe until all of these are true:

- `throttling-comparison.json` contains successful `simulate` and `devtools` samples for `/`, `/shopping`, and `/recipe/1` on `mobile-375x812`.
- `artifacts/performance/observation.json` reports `strictProbeEligible=true`, which currently means `5` consecutive green CI warn-runs, `readiness.ready=true`, and a verified warm-up seed.
- The chosen method passes LCP, gzip JS, and JS execution budgets across repeated CI runs after the 2026-05-12 baseline hardening.

## Strict-Hardening Tooling

The 10-run collection is automated and was executed successfully on 2026-05-12 outside the sandbox:

```bash
npm run perf:stability:seed
npm run perf:budget:suggest
```

`perf:stability:seed` runs `perf:bundle` once, then a discarded warm-up `perf:lighthouse` run, then repeats `perf:lighthouse` + `perf:validate` for real measurements. It does not write `history.json` directly; `validate-status.mjs` remains the only history writer. New history records include `throttlingMethod` and unique run IDs so repeated validations inside one CI run do not overwrite each other.

`perf:budget:suggest` reads complete method-marked history runs and writes `artifacts/performance/budget-suggestions.json`. Default policy is conservative: report p50/p75/p95 and suggest `p95 * 1.10`.

The 2026-05-12 suggestion window was complete (`10/10`, first run `2026-05-12T06:06:18.985Z`, last run `2026-05-12T06:22:53.599Z`). Bundle suggestions were applied where they tightened the baseline (`maxGzipJsBytes=1140411`, `maxLargestJsAssetBytes=4572427`); `maxJsBytes` stayed at the existing tighter 5.2 MB limit. Lighthouse budgets were sharpened for `simulate/mobile-375x812`, but the `/` LCP suggestion of 24616 ms was rejected because it came from one cold-run outlier at 22378 ms while warm runs clustered near 903 ms.

Current policy after that finding: scheduled CI stays in `warn` mode while the sharpened budgets prove themselves; `strict` is reserved for explicit manual probe dispatches after the observation gate turns green. The cold-run artifact is handled operationally by a discarded warm-up Lighthouse run before the measured seed window, not by loosening the route budget. The first such probe dispatch (run `25742783313`) was executed and passed green on 2026-05-12; the `consecutiveGreenRuns` counter is back at `0` after that probe, so any further strict probe needs a fresh 5-run observation window.

Die operative Freigabe- und Run-Checkliste steht in `docs/performance/strict-probe-runbook.md`.
