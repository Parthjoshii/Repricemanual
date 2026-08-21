# Strict Irregular Sequence & Reactivity Test Report

This report presents visual verification of the calculator across non-linear sequences, multi-delimited GDS copy-pasting, roundtrip parameter edits ($A \to B \to A$), mid-calculation currency modifications, dynamic Summary table updates, and manual dual-currency settlement.

---

## 1. Multi-Delimited GDS Tax Copy-Paste Fix (Zero False Negatives)

### Context & Test
Pasting raw, column-aligned, multi-space, tab-separated, or multi-line tax strings copied directly from a GDS screen (e.g. Amadeus, Sabre, Galileo) into **NEW TAX**.

### Visual Evidence
![Space-Separated GDS Tax Parsing Fix](C:\Users\Parth Joshi\.gemini\antigravity-ide\brain\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6\visual_1_space_separated_taxes_fix.png)

### Observed Results
- **Positive Taxes**: `MUR0.00`
- **Negative Taxes**: `None`
- **Net Tax Adjustment**: `MUR0.00`
- **Add / Refund Taxes**: Clean (no false refund lines).
- **Outcome**: **100% PASS**.

---

## 2. Parameter Roundtrip Reactivity ($A \to B \to A$)

### Context & Test
1. Set Old Fare to `100`, New Fare to `305` $\to$ Fare Difference: `INR205`.
2. Edit New Fare to `307` $\to$ Fare Difference updates immediately to `INR207`.
3. Edit New Fare back to `305` $\to$ Fare Difference restores immediately to `INR205`.

### Visual Evidence
![Fare Roundtrip Restoration](C:\Users\Parth Joshi\.gemini\antigravity-ide\brain\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6\visual_2_fare_roundtrip_restoration.png)

### Observed Results
- Both `#fareDiff` and `#baseFareDiffBadge` remain in lockstep.
- Exact restoration of values upon reverting changes.
- **Outcome**: **100% PASS**.

---

## 3. Mid-Calculation Currency Switching & Decimal Formatting

### Context & Test
Changing the currency dropdown on live values across varying IATA precision standards:
- `USD`: 2 decimal places (`USD205.00`)
- `KWD`: 3 decimal places (`KWD205.000`)
- `JPY`: 0 decimal places (`JPY205`)
- `AED`: 0 decimal places / unit 1 (`AED205`)

### Visual Evidence
![Mid-Calculation Currency Switch](C:\Users\Parth Joshi\.gemini\antigravity-ide\brain\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6\visual_3_mid_calculation_currency_switch.png)

### Observed Results
- Auto-reformats all active fields with zero cache staleness.
- Synchronizes the reference badge and calculation engine instantly.
- **Outcome**: **100% PASS**.

---

## 4. Dynamic Reverse Summary Rendering & Booking Class Header

### Context & Test
1. Click **Summarise** first with baseline fare and tax inputs.
2. Enter and convert the **Fare Calculation String** in reverse order afterward.

### Visual Evidence
![Dynamic Summary Table & Booking Class Header](C:\Users\Parth Joshi\.gemini\antigravity-ide\brain\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6\visual_4_dynamic_summary_booking_class.png)

### Observed Results
- Top-left header dynamically updates from `Booking class` to **`Booking class : Outbound T & Inbound X`**.
- Converted Fare Calculation String row updates instantly without requiring a re-click of *Summarise*.
- **Outcome**: **100% PASS**.

---

## 5. Manual Dual-Currency Settlement, Lightbulb Tooltip & Downline Propagation

### Context & Test
1. Base fares in `USD` ($100 \to 200$, base diff `USD100.00`).
2. Overwrite Fare Diff with `INR8500` and Change Fee with `INR3000` under `Economy` cabin (5% K3).
3. Hover on the animated lightbulb cue.

### Visual Evidence
![Manual Dual-Currency Settlement & Lightbulb](C:\Users\Parth Joshi\.gemini\antigravity-ide\brain\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6\visual_5_manual_dual_currency_propagation.png)

### Observed Results
- Animated lightbulb displays tooltip prompt: *"Manually enter converted settlement amount (e.g. INR 4277) if issuing in a different currency."*
- Base Reference Badge retains original base currency: `Base: USD100.00`.
- Downline K3 Tax (5% of 8500 = 425 + 5% of 3000 = 150 $\to$ `INR575`) and Per Pax (`INR12075`) recalculate in `INR`.
- **Outcome**: **100% PASS**.

---

## 6. Multi-PTC Consolidated Summary Table

### Context & Test
Configure Adult (ADT) and Child (CNN) tabs with independent base fares and taxes, and generate consolidated summary breakdown.

### Visual Evidence
![Multi-PTC Consolidated Summary](C:\Users\Parth Joshi\.gemini\antigravity-ide\brain\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6\visual_6_multi_ptc_consolidated_summary.png)

### Observed Results
- Independent column metrics for **Adult** and **Child**.
- Consolidated **Amount Payable** row reflecting the exact sum of all passenger sub-totals.
- **Outcome**: **100% PASS**.

---

## Comprehensive Test Execution Summary

| Test Suite | Purpose | Status |
| :--- | :--- | :--- |
| `strict-irregular-sequence-audit.js` | Full irregular sequence, roundtrip edits, and zig-zag toggling | **39/39 PASS (100%)** |
| `test-space-separated-taxes.js` | Multi-space, column, tab, and multi-line GDS tax clipboard parsing | **PASS (100%)** |
| `test-fare-diff-correction.js` | Live sync between input field & reference badge upon corrections | **PASS (100%)** |
| `booking-class-summary-verify.js` | Dynamic outbound/inbound booking class detection in summary table | **PASS (100%)** |
| `manual-dual-currency-verify.js` | Dual-currency settlement propagation & animated visual bulb cues | **PASS (100%)** |
| `e2e-comprehensive-audit.js` | Full end-to-end audit across calculation rules & edge cases | **12/12 PASS (100%)** |
| `deep-parameter-debugging.js` | Math precision, cabin rates, passenger multipliers & XSS security | **39/39 PASS (100%)** |
| `restore-trigger-verify.js` | Zero-error session persistence & trigger banner restoration | **7/7 PASS (100%)** |
