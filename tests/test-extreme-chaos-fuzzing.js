const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

// Parse CLI flags: --seed=<number> --steps=<number>
const args = process.argv.slice(2);
let SEED = 42;
let NUM_STEPS = 250;

for (const arg of args) {
  if (arg.startsWith('--seed=')) {
    SEED = parseInt(arg.split('=')[1], 10) || 42;
  }
  if (arg.startsWith('--steps=')) {
    NUM_STEPS = parseInt(arg.split('=')[1], 10) || 250;
  }
}

// Deterministic PRNG: Mulberry32
function createPrng(seed) {
  let s = seed >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createPrng(SEED);

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('========================================================================');
  console.log(`STARTING EXTREME STATEFUL CHAOS & PROPERTY-BASED FUZZING TEST SUITE`);
  console.log(`Config: SEED=${SEED} | STEPS=${NUM_STEPS}`);
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1440, height: 1000 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore benign favicon or font load errors if any
      if (!txt.includes('favicon') && !txt.includes('net::ERR_FILE_NOT_FOUND')) {
        errors.push('console error: ' + txt);
      }
    }
  });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function dismissModals() {
    try {
      await page.evaluate(() => {
        if (typeof closeErrorModal === 'function') closeErrorModal();
        const m = document.getElementById('errorModal');
        if (m) m.classList.remove('show');
        const p = document.getElementById('ptcPromptModal');
        if (p) p.classList.remove('show');
      });
      await page.waitForTimeout(30);
    } catch (_) {}
  }

  async function safeClick(selector) {
    await dismissModals();
    if (await page.isVisible(selector)) {
      const isDisabled = await page.isDisabled(selector).catch(() => false);
      if (!isDisabled) {
        try {
          await page.click(selector, { timeout: 1500 });
        } catch (_) {
          await dismissModals();
          await page.click(selector, { force: true }).catch(() => {});
        }
      }
    }
  }

  await dismissModals();

  // Helper to parse amount + currency
  function parseAmountVal(str) {
    if (!str) return 0;
    const m = str.match(/([+-]?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  // Helper to parse tax breakdown tokens
  function parseTaxTokens(taxStr) {
    if (!taxStr) return [];
    return taxStr.split('/').map(t => t.trim()).filter(Boolean);
  }

  // =========================================================================
  // INVARIANT CHECKER: Audits the DOM and Internal State
  // =========================================================================
  let assertionCount = 0;

  async function verifyInvariants(contextLabel) {
    assertionCount++;

    await page.evaluate(() => {
      if (typeof flushPendingCalculations === 'function') flushPendingCalculations();
    });
    await page.waitForTimeout(50);

    // 1. Sanity: No NaN, undefined, or malformed numerical garbage in primary fields
    const fieldsToCheck = [
      '#fareDiff', '#changeFee', '#k3Tax', '#taxAdj', '#perPax', '#subTotal',
      '#addTaxes', '#refundTaxes', '#baseFareDiffBadge'
    ];

    for (const sel of fieldsToCheck) {
      if (await page.isVisible(sel)) {
        const val = (await page.inputValue(sel).catch(() => '')) ||
                    (await page.textContent(sel).catch(() => ''));
        assert.ok(!val.includes('NaN'), `[${contextLabel}] Field ${sel} contains NaN: "${val}"`);
        assert.ok(!val.includes('undefined'), `[${contextLabel}] Field ${sel} contains undefined: "${val}"`);
        assert.ok(!val.includes('null'), `[${contextLabel}] Field ${sel} contains null: "${val}"`);
        assert.ok(!val.includes('Infinity'), `[${contextLabel}] Field ${sel} contains Infinity: "${val}"`);
      }
    }

    // 2. Math Invariant: Amount Payable per Pax === Fare Diff + Change Fee + Tax Adj
    const fareDiffStr = await page.inputValue('#fareDiff');
    const changeFeeStr = await page.inputValue('#changeFee');
    const taxAdjStr = await page.inputValue('#taxAdj');
    const perPaxStr = await page.inputValue('#perPax');
    const subTotalStr = await page.inputValue('#subTotal');
    const paxCountStr = await page.inputValue('#pax');

    const fareDiffNum = parseAmountVal(fareDiffStr);
    const changeFeeNum = parseAmountVal(changeFeeStr);
    const taxAdjNum = parseAmountVal(taxAdjStr);
    const perPaxNum = parseAmountVal(perPaxStr);
    const subTotalNum = parseAmountVal(subTotalStr);
    const paxCount = parseInt(paxCountStr, 10) || 1;

    // Only verify if perPax is populated
    if (perPaxStr && perPaxStr.trim() !== '') {
      const expectedPerPax = fareDiffNum + changeFeeNum + taxAdjNum;
      const mCur = perPaxStr.match(/^([A-Z]{3})/);
      const cur = mCur ? mCur[1] : ((await page.$eval('#currency', el => el.value).catch(() => '')) || 'INR');
      const expectedRounded = await page.evaluate(({ amt, c }) => {
        return parseFloat(formatAmount(amt, c)) || amt;
      }, { amt: expectedPerPax, c: cur });
      const diff = Math.abs(perPaxNum - expectedRounded);
      if (diff >= 0.05) {
        console.error(`Mismatch details: fareDiffStr="${fareDiffStr}", changeFeeStr="${changeFeeStr}", taxAdjStr="${taxAdjStr}", perPaxStr="${perPaxStr}", expectedRounded=${expectedRounded}`);
      }
      assert.ok(
        diff < 0.05,
        `[${contextLabel}] PerPax math mismatch: perPax=${perPaxNum}, expected (${fareDiffNum} + ${changeFeeNum} + ${taxAdjNum}) = ${expectedRounded} (currency=${cur})`
      );

      // SubTotal === perPax * paxCount
      const expectedSubTotal = perPaxNum * paxCount;
      const subTotalDiff = Math.abs(subTotalNum - expectedSubTotal);
      assert.ok(
        subTotalDiff < 0.08,
        `[${contextLabel}] SubTotal math mismatch: subTotal=${subTotalNum}, expected (${perPaxNum} * ${paxCount}) = ${expectedSubTotal}`
      );
    }

    // 3. Math Invariant: Tax Adj Net === Sum of Positive Taxes in Add Taxes - Sum of Refund Taxes
    const addTaxesStr = await page.inputValue('#addTaxes');
    const refundTaxesStr = await page.inputValue('#refundTaxes');

    if (addTaxesStr || refundTaxesStr) {
      const addTokens = parseTaxTokens(addTaxesStr);
      const refTokens = parseTaxTokens(refundTaxesStr);

      let addSum = 0;
      for (const t of addTokens) {
        addSum += parseAmountVal(t);
      }
      let refSum = 0;
      for (const t of refTokens) {
        refSum += parseAmountVal(t);
      }

      const expectedTaxNet = addSum - refSum;
      if (taxAdjStr && taxAdjStr.trim() !== '') {
        const taxAdjDiff = Math.abs(taxAdjNum - expectedTaxNet);
        if (taxAdjDiff >= 0.05) {
          const debugInfo = await page.evaluate(() => ({
            activePtc: state.activePtc,
            currency: els.currency.value,
            oldTax: els.oldTax.value,
            newTax: els.newTax.value,
            oldFare: els.oldFare.value,
            newFare: els.newFare.value,
            fareDiff: els.fareDiff.value,
            changeFee: els.changeFee.value,
            cabin: els.cabin.value,
            k3Tax: els.k3Tax.value,
            applyK3OnYQ: els.applyK3OnYQ.checked,
            applyK3OnFareDiff: els.applyK3OnFareDiff.checked,
            applyK3OnChangeFee: els.applyK3OnChangeFee.checked,
            lastTaxResult: state.lastTaxResult,
            lastFareK3Total: state.lastFareK3Total,
            lastFareCurrency: state.lastFareCurrency,
            lastK3AddTaxes: state.lastK3AddTaxes
          }));
          console.error("DIAGNOSTIC DUMP:", JSON.stringify(debugInfo, null, 2));
        }
        assert.ok(
          taxAdjDiff < 0.05,
          `[${contextLabel}] Tax Adj reconciliation mismatch: taxAdj=${taxAdjNum}, expected (${addSum} - ${refSum}) = ${expectedTaxNet} (Add: "${addTaxesStr}", Ref: "${refundTaxesStr}")`
        );
      }
    }
  }

  // =========================================================================
  // PHASE 1: RAPID CHECKBOX PERMUTATION MATRIX ON ALL TABS
  // =========================================================================
  console.log('--- PHASE 1: Rapid Checkbox Permutation Matrix on Built-in Tabs ---');

  const tabsToTest = ['ADT', 'CNN', 'INF', 'INF_CNN', 'CNN_ADT'];
  const checkboxes = [
    '#applyK3OnYQ',
    '#applyK3OnFareDiff',
    '#applyK3OnChangeFee',
    '#halveFareComponents'
  ];

  for (const tab of tabsToTest) {
    const tabSelector = `.ptc-tab[data-ptc="${tab}"]`;
    await safeClick(tabSelector);
    await page.waitForTimeout(60);

    // Populate a baseline calculation
    await page.selectOption('#currency', 'INR');
    await page.selectOption('#cabin', 'economy');
    await page.fill('#oldTax', 'INR1000YQ');
    await page.fill('#newTax', 'INR3000YQ');
    await safeClick('#taxCalcButton');
    await page.waitForTimeout(50);

    await page.fill('#oldFare', 'INR10000');
    await page.fill('#newFare', 'INR15000');
    await page.fill('#changeFee', 'INR2000');
    await safeClick('#fareCalcButton');
    await page.waitForTimeout(50);

    // Rapid random multi-toggling sequence (16 rapid flips)
    for (let flip = 0; flip < 16; flip++) {
      const cb = randChoice(checkboxes);
      await safeClick(cb);
      await page.waitForTimeout(20);
    }

    // Force flush
    await safeClick('#fareCalcButton');
    await page.waitForTimeout(100);

    await verifyInvariants(`Phase 1 Tab [${tab}] Checkbox Chaos`);
    console.log(`  ✓ Tab [${tab}] passed rapid checkbox permutation testing.`);
  }

  // =========================================================================
  // PHASE 2: CHAOTIC MULTI-TAB MUTATION PIPELINE (250+ RANDOM ACTIONS)
  // =========================================================================
  console.log(`\n--- PHASE 2: 250+ Seeded Chaotic Actions Across All Tabs (Seed ${SEED}) ---`);

  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'KWD', 'SAR', 'JPY'];
  const cabins = ['economy', 'premium', 'business', 'first'];
  const taxCodes = ['YQ', 'YR', 'K3', 'P2', 'WO', 'IN', 'E3', 'OB', 'F2'];

  let createdCustomTabs = 0;

  for (let step = 1; step <= NUM_STEPS; step++) {
    const actionType = randInt(1, 10);
    const logPrefix = `Step ${step}/${NUM_STEPS}`;

    try {
      switch (actionType) {
        case 1: {
          // INPUT TAXES (matching current tab currency)
          const cur = await page.$eval('#currency', el => el.value).catch(() => 'INR') || 'INR';
          const code1 = randChoice(taxCodes);
          const code2 = randChoice(taxCodes);
          const amt1 = randInt(10, 500);
          const amt2 = randInt(10, 500);
          const amt3 = randInt(10, 500);

          const oldTaxStr = `${cur}${amt1}${code1}`;
          const newTaxStr = `${cur}${amt2}${code1} / ${cur}${amt3}${code2}`;

          await page.fill('#oldTax', oldTaxStr);
          await page.fill('#newTax', newTaxStr);
          if (random() > 0.4) {
            await safeClick('#taxCalcButton');
          }
          break;
        }

        case 2: {
          // INPUT FARES (matching current tab currency)
          const cur = await page.$eval('#currency', el => el.value).catch(() => 'INR') || 'INR';
          const oldAmt = randInt(200, 3000);
          // 25% chance of downgrade (new < old) to trigger/test lower base fare notice
          const newAmt = random() < 0.25 ? oldAmt - randInt(50, 150) : oldAmt + randInt(50, 1000);
          const feeAmt = random() > 0.3 ? randInt(20, 200) : 0;

          await page.fill('#oldFare', `${cur}${oldAmt}`);
          await page.fill('#newFare', `${cur}${newAmt}`);
          await page.fill('#changeFee', feeAmt > 0 ? `${cur}${feeAmt}` : '');

          if (random() > 0.4) {
            await safeClick('#fareCalcButton');
          }
          break;
        }

        case 3: {
          // TOGGLE CHECKBOXES
          const cb = randChoice([
            '#applyK3OnYQ',
            '#applyK3OnFareDiff',
            '#applyK3OnChangeFee',
            '#halveFareComponents',
            '#autoCalcFromAdult'
          ]);
          await safeClick(cb);
          break;
        }

        case 4: {
          // SWITCH CABIN CLASS
          const cabin = randChoice(cabins);
          await page.selectOption('#cabin', cabin);
          break;
        }

        case 5: {
          // SWITCH PTC TAB
          const activeTabs = await page.$$eval('.ptc-tab', els => els.map(e => e.dataset.ptc).filter(Boolean));
          const targetTab = randChoice(activeTabs);
          if (targetTab) {
            await safeClick(`.ptc-tab[data-ptc="${targetTab}"]`);
          }
          break;
        }

        case 6: {
          // CREATE CUSTOM TAB OR TOGGLE PAX
          if (createdCustomTabs < 3 && random() < 0.3) {
            const customName = `CUST${createdCustomTabs + 1}`;
            createdCustomTabs++;
            await safeClick('#ptcAddTabButton');
            await page.waitForTimeout(50);
            if (await page.isVisible('#ptcPromptModal.show')) {
              await page.fill('#ptcPromptInput', customName);
              await safeClick('#ptcPromptOkBtn');
              await page.waitForTimeout(50);
            }
          } else {
            const paxNum = randInt(1, 5);
            await page.fill('#pax', String(paxNum));
          }
          break;
        }

        case 7: {
          // FARE CALC STRING PARSER TEST
          const roundTripString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC1215.27END ROE0.855028';
          const oneWayString = 'BOM EK DXB 250.00YLEEPIN1 NUC250.00END ROE1.00';
          const stringToInject = random() > 0.3 ? roundTripString : oneWayString;

          const isStringEditable = await page.isEditable('#fareCalcString').catch(() => false);
          if (isStringEditable) {
            await page.fill('#fareCalcString', stringToInject);
            if (random() > 0.5) {
              await safeClick('#parseButton');
            }
          }
          break;
        }

        case 8: {
          // EXPLICIT CALCULATION CLICK
          if (random() > 0.5) {
            await safeClick('#taxCalcButton');
          } else {
            await safeClick('#fareCalcButton');
          }
          break;
        }

        case 9: {
          // CLEAR SECTION (test state reset hygiene)
          if (random() < 0.15) {
            const clearBtn = randChoice(['#taxClearButton', '#fareClearButton', '#parserClearButton']);
            await safeClick(clearBtn);
          }
          break;
        }

        case 10: {
          // SWITCH CURRENCY CLEANLY
          const cur = randChoice(currencies);
          await page.selectOption('#currency', cur);
          await page.evaluate(() => {
            if (typeof flushPendingCalculations === 'function') flushPendingCalculations();
          });
          break;
        }
      }

      await page.waitForTimeout(30);
      await dismissModals();

      // Check invariants every 10 steps or after major recalculations
      if (step % 10 === 0 || step === NUM_STEPS) {
        await verifyInvariants(`${logPrefix} [Action ${actionType}]`);
      }
    } catch (err) {
      console.error(`Error at ${logPrefix} (Action ${actionType}):`, err);
      throw err;
    }
  }

  console.log(`  ✓ Completed all ${NUM_STEPS} chaotic actions without math or state failure.`);

  // =========================================================================
  // PHASE 3: HIGH-FREQUENCY ZIG-ZAG TAB SWITCHING (DEBOUNCE FLUSH STRESS TEST)
  // =========================================================================
  console.log('\n--- PHASE 3: High-Frequency Zig-Zag Tab Switching with Active Inputs ---');

  // Tab A: ADT
  await safeClick('.ptc-tab[data-ptc="ADT"]');
  await page.fill('#oldFare', 'INR50000');
  await page.fill('#newFare', 'INR75000');
  await page.fill('#changeFee', 'INR3000');

  // Quickly switch to CNN within 30ms (well inside the 300ms debounce timer)
  await page.waitForTimeout(30);
  await safeClick('.ptc-tab[data-ptc="CNN"]');

  // Mutate CNN
  await page.fill('#oldFare', 'INR30000');
  await page.fill('#newFare', 'INR40000');
  await page.fill('#changeFee', 'INR1500');

  // Quickly switch to INF
  await page.waitForTimeout(20);
  await safeClick('.ptc-tab[data-ptc="INF"]');
  await page.fill('#oldFare', 'INR5000');
  await page.fill('#newFare', 'INR7000');

  // Quickly switch back to ADT
  await page.waitForTimeout(20);
  await safeClick('.ptc-tab[data-ptc="ADT"]');

  // ADT must have flushed and preserved its exact values without bleed from CNN or INF
  const adtOldFare = await page.inputValue('#oldFare');
  const adtNewFare = await page.inputValue('#newFare');
  const adtFee = await page.inputValue('#changeFee');
  const adtFareDiff = await page.inputValue('#fareDiff');
  const adtPerPax = await page.inputValue('#perPax');

  console.log(`  ADT Restored: Old=${adtOldFare}, New=${adtNewFare}, Fee=${adtFee}, Diff=${adtFareDiff}, PerPax=${adtPerPax}`);
  assert.strictEqual(adtOldFare, 'INR50000', 'ADT old fare must be perfectly preserved');
  assert.strictEqual(adtNewFare, 'INR75000', 'ADT new fare must be perfectly preserved');
  assert.strictEqual(adtFee, 'INR3000', 'ADT change fee must be perfectly preserved');
  assert.strictEqual(adtFareDiff, 'INR25000', 'ADT fare diff must be accurately calculated (75000 - 50000 = 25000)');

  // Verify CNN tab isolation
  await safeClick('.ptc-tab[data-ptc="CNN"]');
  const cnnOldFare = await page.inputValue('#oldFare');
  const cnnNewFare = await page.inputValue('#newFare');
  const cnnFareDiff = await page.inputValue('#fareDiff');
  console.log(`  CNN Restored: Old=${cnnOldFare}, New=${cnnNewFare}, Diff=${cnnFareDiff}`);
  assert.strictEqual(cnnOldFare, 'INR30000', 'CNN old fare must be perfectly preserved');
  assert.strictEqual(cnnNewFare, 'INR40000', 'CNN new fare must be perfectly preserved');
  assert.strictEqual(cnnFareDiff, 'INR10000', 'CNN fare diff must be accurately calculated (40000 - 30000 = 10000)');

  console.log('  ✓ High-frequency zig-zag tab switching passed with zero state leakage.');

  // Flush any in-flight calculations from tab transitions
  await page.evaluate(() => {
    if (typeof flushPendingCalculations === 'function') flushPendingCalculations();
  });
  await page.waitForTimeout(100);
  await dismissModals();

  // =========================================================================
  // PHASE 4: SUMMARY TABLE CONSOLIDATION & GDS STRING AUDIT
  // =========================================================================
  console.log('\n--- PHASE 4: Summary Table Consolidation & GDS String Audit ---');

  // 1. Verify currency mismatch rejection modal if tabs have mixed currencies
  await safeClick('#summariseButton');
  await page.waitForTimeout(200);

  const isModalOpen = await page.isVisible('#errorModal.show');
  if (isModalOpen) {
    const modalText = await page.textContent('#modalMessage');
    console.log('  Currency mismatch notice verified:', modalText);
    assert.ok(modalText.includes('same currency') || modalText.includes('different currency') || modalText.includes('Taxes'), 'Modal correctly rejects consolidating mixed-currency tabs');
    await dismissModals();
  }

  // 2. Harmonize active tabs to unified currency (INR) for multi-PTC consolidation
  const allTabs = await page.$$eval('.ptc-tab', els => els.map(e => e.dataset.ptc).filter(Boolean));
  for (const tab of allTabs) {
    await safeClick(`.ptc-tab[data-ptc="${tab}"]`);
    await page.selectOption('#currency', 'INR');
    const oldVal = await page.inputValue('#oldFare');
    const newVal = await page.inputValue('#newFare');
    if (oldVal && newVal) {
      await page.fill('#oldFare', 'INR' + Math.abs(parseAmountVal(oldVal)));
      await page.fill('#newFare', 'INR' + Math.abs(parseAmountVal(newVal)));
      const oldFee = await page.inputValue('#changeFee');
      if (oldFee) {
        await page.fill('#changeFee', 'INR' + Math.abs(parseAmountVal(oldFee)));
      }
      await safeClick('#fareCalcButton');
      await page.waitForTimeout(50);
    }
  }

  // Switch back to ADT
  await safeClick('.ptc-tab[data-ptc="ADT"]');
  await page.waitForTimeout(100);

  // Click Summarise
  await safeClick('#summariseButton');
  await page.waitForTimeout(250);

  if (await page.isVisible('#errorModal.show')) {
    const errText = await page.textContent('#modalMessage');
    console.error('Unexpected Summarise error modal:', errText);
    await dismissModals();
  }

  const isSummaryVisible = await page.isVisible('#summaryContent');
  assert.strictEqual(isSummaryVisible, true, 'Summary section must be visible after clicking Summarise');

  const gdsVal = await page.inputValue('#gdsString');
  const summaryTableText = await page.textContent('#summary');

  console.log('  GDS Output String:', gdsVal);
  assert.ok(gdsVal.length > 0, 'GDS string must not be empty');
  assert.ok(!gdsVal.includes('NaN'), 'GDS string must not contain NaN');
  assert.ok(!gdsVal.includes('undefined'), 'GDS string must not contain undefined');

  // Verify stale indicator reactivity
  assert.strictEqual(await page.isVisible('#summaryStaleNotice'), false, 'Stale notice should not be visible right after Summarise');

  // Edit a field
  await page.fill('#changeFee', 'INR9999');
  await page.waitForTimeout(350);

  // Stale notice should appear
  const isStale = await page.isVisible('#summaryStaleNotice');
  console.log('  Stale Notice visible after editing change fee:', isStale);
  assert.strictEqual(isStale, true, 'Stale notice must appear when inputs change after Summarise');

  // Re-clicking Summarise should refresh and hide stale notice
  await safeClick('#summariseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isVisible('#summaryStaleNotice'), false, 'Stale notice must disappear after refreshing Summarise');

  console.log('  ✓ Final Summary consolidation and stale notice reactivity verified.');

  assert.strictEqual(errors.length, 0, 'Zero unexpected runtime errors occurred during chaos execution: ' + JSON.stringify(errors));
  await browser.close();

  console.log('\n========================================================================');
  console.log(`EXTREME CHAOS FUZZING COMPLETED: ${assertionCount} INVARIANTS VERIFIED 100%!`);
  console.log('ZERO STATE LEAKS | ZERO CALCULATION DRIFTS | ZERO DEFECTS');
  console.log('========================================================================\n');
})();
