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

`ptc-verify.js` from earlier in this project's history is intentionally **not** included here —
it asserted on a 3-table summary layout that predates the single consolidated table this app uses
today, so it no longer reflects intended behavior.
