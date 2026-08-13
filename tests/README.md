# Regression tests

Playwright scripts that drive `index.html` directly (as a `file://` URL — no dev server needed)
and assert on the rendered DOM. Each script is self-contained and exits non-zero on failure.

## Setup (one-time)

```bash
npm init -y
npm install playwright
npx playwright install chromium
```

Run this in a scratch folder outside the repo, or in the repo root if you don't mind `node_modules`
being present locally (it's covered by a typical `.gitignore`, but this repo doesn't have a build
step and doesn't ship one — these dependencies exist only to run the tests, not the app itself).

## Running

Each script takes the path to `index.html` as its one argument:

```bash
node tests/autocalc-verify.js index.html
```

Run all of them:

```bash
for f in tests/*-verify.js tests/*-table.js; do
  echo "=== $f ==="
  node "$f" index.html || echo "FAILED: $f"
done
```

## What each covers

| Script | Covers |
|---|---|
| `autocalc-verify.js` | "Auto-calculate from Adult" toggle (CNN/INF single-ratio derivation) |
| `autocalc-consecutive-q.js` | Consecutive Q-surcharges scale correctly under auto-calc |
| `fcs-only-summary-verify.js` | A PTC with only a converted Fare Calc String (no fare/tax) still appears in Summarise |
| `summary-staleness-verify.js` | Re-converting the Fare Calc String and toggling K3 both update the summary/GDS immediately |
| `summary-sequence-verify.js` | A tax-only (or fare-calc-only) summary keeps picking up further tax recalculations, in any order |
| `parser-hardening-verify.js` | Fare Calculation String Parser: embedded-keyword false positives, whitespace tolerance, case normalization, malformed-input warnings |
| `q-surcharge-verify.js` | All documented Q-surcharge string shapes parse correctly |
| `q-decimal-split-verify.js` | A `Q`-surcharge glued directly onto the previous surcharge's amount (`...50.00Q DXBYFC29.81`) keeps its decimal intact instead of splitting into two bogus integers |
| `clipboard-border-verify.js` | Summary table copies with rich HTML formatting (not just plain text) and bold borders |
| `custom-tabs-verify.js` | Add/rename/remove custom PTC tabs via the in-app modal, 2-tab cap |
| `hybrid-tabs-verify.js` | INF/CNN and CNN/ADT hybrid tabs: outbound/inbound split, side trips, open jaw, fallback warnings |
| `hybrid-q-directional-verify.js` | The return leg's own Q-surcharges (written before its fare amount, between the two primary components) scale at the *inbound* PTC rate, not the outbound one |
| `ptc-single-table.js` | Consolidated Summary table layout: one column per PTC, no Total column, Amount Payable row |
| `persistence-verify.js` | Session state (all tabs, custom tabs, active tab) survives a page reload once restored |
| `restore-trigger-verify.js` | Restoration is trigger-based, not automatic: reload leaves fields empty and shows a banner; Restore populates everything; Dismiss clears the saved session for good; starting to type without restoring auto-dismisses the banner |
| `xss-fix-verify.js` | NUC-validation-FAIL display and the clipboard HTML builder escape user input |
| `summarise-live-flush-verify.js` | Summarise (and tab-switch/autosave) flush any edit still inside the 300ms auto-recalc debounce window instead of reading stale `summaryData` |
| `tab-dirty-indicator-verify.js` | The "unsummarised data" tab dot lights up the instant a field is edited and clears once Calculate/Summarise/tab-switch folds it in, independently per tab |
| `core-fare-tax-math-verify.js` | `calculateFare()`/`calculateTaxes()` core arithmetic: K3-on-fare-diff/change-fee at each cabin rate, Per Pax/Sub Total formulas, pax multiplication, PD-prefixed tax merging, K3-on-YQ |
| `currency-rounding-verify.js` | `formatAmount()` against `roundingRules`: INR ceiling, 0-decimal currencies, 3-decimal currencies, default 2-decimal, zero/empty/NaN edge cases |
| `tax-string-parsing-verify.js` | `parseAmount`/`parseTaxToken`/`parseTaxes`/`formatTaxInput`: the fixed 2-char tax-code anchor (vs. ambiguous digit+letter codes), PD prefix, invalid-entry rejection |
| `summary-consolidation-math-verify.js` | `mergeSummaryData()` sums/perPax recompute/currency-mismatch guard; `buildTaxOnlySummaryData`/`buildFareCalcOnlySummaryData` exact fields; Amount Payable summed correctly across 3 PTCs with different pax counts |
| `gds-string-verify.js` | `buildGdsLine`/`generateGdsString`: K3 folded into displayed Change Fee, +/- tax sign, single vs. multi-PTC (labeled lines + TOTAL), matches the live Amount Payable |
| `fare-calc-nuc-roe-math-verify.js` | Parser's `calculatedNuc = fareSum + qSum`, `baseFare = calculatedNuc * ROE`, and the exact ±0.01 NUC-validation tolerance boundary |
| `autocalc-percentage-math-verify.js` | `deriveFareCalcString()`'s exact 75%/10% per-token scaling (fare components and Q surcharges independently), NUC = sum of independently-rounded tokens; `round2()`'s float-rounding-trap handling |
| `hybrid-boundary-fallback-verify.js` | `findHybridBoundary()`'s fallback when a source string doesn't have exactly 2 primary fare components (one-way, 3+ legs): whole string scaled at the outbound rate, with a warning naming the actual count found |

`ptc-verify.js` from earlier in this project's history is intentionally **not** included here —
it asserted on a 3-table summary layout that predates the single consolidated table this app uses
today, so it no longer reflects intended behavior.
