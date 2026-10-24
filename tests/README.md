# Regression & Automated Test Suites

Playwright & Node scripts that drive `index.html` directly (as a `file:///` URL — no dev server needed)
and assert on the rendered DOM and core mathematical logic. Each script is self-contained and exits with code 0 on success.

## Running Tests

Run the master test runner to execute all essential test suites:

```bash
node tests/run-all-tests.js
```

Or run an individual test suite:

```bash
node tests/test-extreme-chaos-fuzzing.js
```

Filter test suites by name:

```bash
node tests/run-all-tests.js chaos
node tests/run-all-tests.js math
```

## Essential Test Suite Index (36 Suites)

### 1. Master Audits, Sectional Precision & Chaos Fuzzing
| Script | Covers |
|---|---|
| `master-system-audit.js` | **Master Zero-Defect System Audit**: Single-file comprehensive test suite spanning all 5 modules (Math & Currency, GDS Linear Parser, Tab State Isolation, UI/UX Geometry & Zero-Flash Paint Pipeline with tab glider transit & stacking invariance, and 200-step Extreme Chaos Fuzzing) |
| `test-sectional-incremental-precision.js` | High-scale (250+ steps) systematic sectional precision: pure taxes isolation, fare calc strings, direct fares & cabin K3, cross-tab zig-zag, with automated root-cause failure analyzer |
| `test-extreme-chaos-fuzzing.js` | 6-phase property-based fuzzing: rapid checkbox matrix across all tabs, 250+ seeded chaotic actions, zig-zag switching, stopovers, selective halve chips, trailing Q syntax modal, summary & GDS consolidation |
| `test-principal-airline-audit.js` | Real-world airline reissue audit across Air India, Emirates, and British Airways itineraries |
| `strict-irregular-sequence-audit.js` | Irregular non-linear flows: A -> B -> A roundtrip edits, multi-space tax pasting, live currency switches, booking class headers |
| `e2e-comprehensive-audit.js` | End-to-end full application flows: multi-currency calculations, fare difference validations, and summary generation |

### 2. Modern Feature & UI Regressions
| Script | Covers |
|---|---|
| `test-theme-switch-slider.js` | Header alignment, light/dark slider theme toggle, Ctrl+M shortcut, and minimal Reload Calculator button micro-rotation |
| `test-trailing-q-surcharge.js` | Trailing Q surcharge syntax detection, verification modal, "Apply Standard Format" vs "Validate As-Is" |
| `test-stopover-and-halve-selector.js` | Stopover charges (`1S...`) parsing, interactive selective halve chips (All / Component 1 / Component 2) with zero textarea mutation |
| `currency-converter-verify.js` | 3-field currency converter collapsible card, Show/Hide toggle, live ROE calculation, and field sync |
| `manual-dual-currency-verify.js` | Manual 2nd currency settlement (INR overwrite, K3 recalculation, per-pax routing) |
| `custom-tabs-verify.js` | Add, rename, and remove custom PTC tabs via the in-app modal (2-tab cap) |
| `hybrid-tabs-verify.js` | INF/CNN and CNN/ADT hybrid tabs: outbound/inbound leg split, side trips, open jaw, and fallback warnings |
| `hybrid-q-directional-verify.js` | Inbound Q-surcharges scaled at the inbound PTC rate rather than outbound |
| `ptc-single-table.js` | Consolidated Summary table layout: one column per PTC, Amount Payable row, and Booking class header |
| `restore-trigger-verify.js` | Trigger-based session restore banner: Restore, Dismiss, and auto-dismiss on edit |
| `persistence-verify.js` | Session state persistence across reloads once restored |
| `clipboard-border-verify.js` | Summary table rich HTML clipboard formatting with styled borders |
| `tab-dirty-indicator-verify.js` | Unsummarised dirty dot indicator per tab |
| `xss-fix-verify.js` | User input escaping in NUC error display and HTML clipboard builder |
| `child-copy-tax-verify.js` | Child tab "Copy Taxes from Adult" visibility, automatic calculation, manual-typing auto-uncheck, and tab auto-sync |

### 3. Core Arithmetic & Unit-Level Tests
| Script | Covers |
|---|---|
| `core-fare-tax-math-verify.js` | `calculateFare()` / `calculateTaxes()` arithmetic: K3 rates across cabins, perPax/subTotal, pax multiplier, PD tax merging, K3-on-YQ |
| `currency-rounding-verify.js` | `formatAmount()` against `roundingRules`: INR ceiling, JPY nearest, BHD/KWD 3 decimals, default 2 decimals, zero/empty/NaN edge cases |
| `tax-string-parsing-verify.js` | `parseAmount`, `parseTaxToken`, `parseTaxes`, `formatTaxInput`: 2-char code anchor, PD prefix, invalid rejection |
| `summary-consolidation-math-verify.js` | `mergeSummaryData()` sums, perPax recompute, currency-mismatch guard, cross-PTC Amount Payable |
| `gds-string-verify.js` | `buildGdsLine`, `generateGdsString`: K3 folded into displayed Change Fee, +/- tax sign, multi-PTC lines |
| `fare-calc-nuc-roe-math-verify.js` | Parser's `calculatedNuc = fareSum + qSum`, `baseFare = calculatedNuc * ROE`, ±0.01 tolerance boundary |
| `autocalc-percentage-math-verify.js` | `deriveFareCalcString()`'s 75%/10% scaling math and float-rounding trap handling |
| `hybrid-boundary-fallback-verify.js` | `findHybridBoundary()` fallback when string does not have exactly 2 primary fare components |
| `parser-hardening-verify.js` | Parser keyword edge cases, whitespace tolerance, case normalization |
| `autocalc-verify.js` | "Auto-calculate from Adult" toggle (CNN/INF single-ratio derivation) |
| `autocalc-consecutive-q.js` | Consecutive Q-surcharges scaling under auto-calc |
| `q-surcharge-verify.js` | All documented Q-surcharge string syntax shapes |
| `q-decimal-split-verify.js` | Glued Q-surcharge decimal retention (`...50.00Q DXBYFC29.81`) |
| `fcs-only-summary-verify.js` | FCS-only PTC in summary table without fare/tax |
| `summary-staleness-verify.js` | Re-converting string updates summary immediately |
| `summary-sequence-verify.js` | Tax-only summary picking up further recalculations in any order |
| `summarise-live-flush-verify.js` | Flushing pending debounced inputs on Summarise click |
