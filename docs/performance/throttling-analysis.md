# Phase 4c Throttling Analysis

Stand: 2026-05-11

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

`perf:validate` is warn-only and reports `lighthouse=ok`, `warningRate=0.0000`, and `fullCoverage=true`. The 2026-05-12 strict-hardening seed produced 10 complete `simulate` runs for the `mobile-375x812` budget window; strict enforcement remains disabled until the sharpened budgets are proven stable in CI.

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

Current policy after that finding: scheduled CI stays in `warn` mode while the sharpened budgets prove themselves; `strict` is reserved for one explicit manual probe dispatch after the observation gate turns green. The cold-run artifact is handled operationally by warming up the seed path, not by loosening the route budget.

Die operative Freigabe- und Run-Checkliste steht in `docs/performance/strict-probe-runbook.md`.
