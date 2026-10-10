# Airline Reprice & GDS Ticketing Invariants

These invariants govern all calculations, validations, and UI interactions in this repository. Any code modification must satisfy these constraints to guarantee zero audit flags.

## 1. Zero-Audit-Flag Tax Reconciliation Invariant
In GDS ticket reissues (Amadeus, Sabre, Travelport), the tax box entries on the ticket reissue mask must mathematically match the total net tax adjustment collected from the passenger:
$$\text{Sum}(\text{Add Taxes}) - \text{Sum}(\text{Refund Taxes}) \equiv \text{Tax Adjustment (Net)}$$
- Every positive tax difference must appear in `Add Taxes`.
- Every negative tax difference must appear in `Refund Taxes`.
- Additional tax components (such as K3 on positive YQ, K3 on Fare Difference, or K3 on Change Fee) must be merged into the respective tax token in `Add Taxes` so the totals remain in 100% balance.

## 2. K3 Accumulation & Warning Guard Invariants
- **Consolidated K3 Accumulation**: If a ticket already has a K3 difference resulting from old vs new tax inputs (e.g., `MUR567K3`), applying K3 on positive YQ (`MUR6K3`), fare difference, or change fee MUST NOT wipe out the existing K3. All K3 sources must be accumulated into a single consolidated token (e.g., `MUR573.00K3`).
- **Single-Warning Frequency Guard**: The warning informing the user that K3 is calculated automatically in the Fare Calculator must fire at most **once** per data entry session (`state.k3TaxWarningShown`), never re-triggering on subsequent keystrokes or blur events. It resets only upon clicking `Clear Taxes`.

## 3. Non-Destructive Manual Input Pattern
- **Pristine Raw Inputs**: The string entered by the user in `#fareCalcString` must never be overwritten with halved or transformed values.
- **Computed Output Separation**: Transformations (such as halving round-trip fare components) must be processed in memory and displayed in the validator result outputs (`#fareComponents`, `#calculatedNuc`, `#baseFare`, and `#nucValidation`'s `Corrected Fare String`), leaving the user's entered text completely intact.

## 4. Strict One-Way Journey Guard
- Halving fare component values (1/2) is strictly restricted to round-trip/multi-component journeys.
- If a one-way fare string (containing only 1 fare component) is detected when halving is checked:
  1. The calculation must be blocked.
  2. The checkbox must be automatically reverted to unchecked.
  3. An informative modal message must be shown to the user.
  4. The input string must remain unchanged.

## 5. Multi-PTC Hybrid Splitting & Auto-Calc
- Adult (`ADT`) is the canonical reference string for dependent passenger types (`CNN`, `INF`).
- Hybrid PTC tabs (`INF/CNN`, `CNN/ADT`) must adhere to strict outbound/inbound boundary separation (`findHybridBoundary`) to calculate accurate child/infant ratios per directional leg.

## 6. WCAG AAA Visual Hierarchy & Color Invariants
- Positive tax adjustments must use high-contrast emerald green (`--tax-pos-color: #15803d` in light mode, `#86efac` in dark mode, `font-weight: 600`).
- Negative tax adjustments must use high-contrast ruby crimson (`--tax-neg-color: #b91c1c` in light mode, `#fca5a5` in dark mode, `font-weight: 600`).
- Switch-track toggle background colors use moon-blue in light mode (`#1ba0f2`) to match the dark-mode moon icon, and cream in dark mode (`#fae8a4`).
