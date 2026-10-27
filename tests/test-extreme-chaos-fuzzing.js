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

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

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
      // Under the updated zero-audit airline standard, K3 on Change Fee is folded into Change Fee rather than Tax Adj
      const k3FeeNum = await page.evaluate(() => {
        const applyFeeK3 = els.applyK3OnChangeFee.checked;
        const fee = parseAmount(els.changeFee.value)?.amount ?? 0;
        const cabin = els.cabin.value;
        if (applyFeeK3 && fee !== 0 && cabin) {
          return fee * (K3_RATES[cabin] ?? 0.05);
        }
        return 0;
      });
      const expectedPerPax = fareDiffNum + (changeFeeNum + k3FeeNum) + taxAdjNum;
      const mCur = perPaxStr.match(/^([A-Z]{3})/);
      const cur = mCur ? mCur[1] : ((await page.$eval('#currency', el => el.value).catch(() => '')) || 'INR');
      const { expectedRounded, maxAllowedDiff } = await page.evaluate(({ amt, c }) => {
        const rounded = parseFloat(formatAmount(amt, c)) || amt;
        const rule = (typeof roundingRules !== 'undefined' && roundingRules[c]) || { unit: 0.01 };
        // For currencies with whole-unit ceiling (e.g. INR unit=1, IDR unit=100), adding already-ceiled
        // taxAdj from the DOM can introduce at most 1 rounding unit of discrepancy due to double ceiling.
        const tol = (rule.unit && rule.unit >= 1) ? (rule.unit + 0.05) : 0.05;
        return { expectedRounded: rounded, maxAllowedDiff: tol };
      }, { amt: expectedPerPax, c: cur });
      const diff = Math.abs(perPaxNum - expectedRounded);
      if (diff > maxAllowedDiff) {
        console.error(`Mismatch details: fareDiffStr="${fareDiffStr}", changeFeeStr="${changeFeeStr}", taxAdjStr="${taxAdjStr}", perPaxStr="${perPaxStr}", expectedRounded=${expectedRounded}`);
      }
      assert.ok(
        diff <= maxAllowedDiff,
        `[${contextLabel}] PerPax math mismatch: perPax=${perPaxNum}, expected (${fareDiffNum} + ${changeFeeNum + k3FeeNum} + ${taxAdjNum}) = ${expectedRounded} (currency=${cur}, diff=${diff}, maxAllowed=${maxAllowedDiff})`
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

  const tabsToTest = ['ADT', 'CHD', 'INF', 'INF_CHD', 'CHD_ADT'];
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
          // FARE CALC STRING PARSER TEST WITH STOPOVER CHARGES, DETECTOR, SELECTIVE HALVING & TRAILING Q
          const stringsPool = [
            'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC1215.27END ROE0.855028',
            'BOM EK DXB 250.00YLEEPIN1 NUC250.00END ROE1.00',
            'CE EK DXB EK SEZ HM PRI384.92TLEEPIT1/ITN2 HM X/SEZ EK X/DXB EK VCE563.74KLEESIT1/ITN2 1S57.59 1S34.00 NUC1040.25END ROE0.868150',
            'LON BA NYC 500.00Y1 BA LON 600.00Y2 1S50.00 NUC1150.00END ROE1.00',
            'SYD QF SIN 400.00Y1 QF SYD 450.00Y2 1S25.50 1S75.00 NUC950.50END ROE1.00',
            'VCE QR DOH QR BLR Q 12.29 563.74KLEESIT1/ITN2 QR DOH QR VCE 563.74KLEESIT1/ITN2Q12.29 NUC1152.06 ROE0.925820',
            'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB23.41 585.36UHEESIE1/VFN2Q COKDUB58.47 NUC1215.27END ROE0.855028'
          ];
          const stringToInject = randChoice(stringsPool);

          const isStringEditable = await page.isEditable('#fareCalcString').catch(() => false);
          if (isStringEditable) {
            await page.fill('#fareCalcString', stringToInject);
            await page.waitForTimeout(30);

            // Verify detector badge if multiple components
            const badgeText = await page.textContent('#fareComponentDetectorBadge').catch(() => '');
            if (badgeText) {
              assert.ok(badgeText.includes('Component'), `Badge must show component count: "${badgeText}"`);
            }

            if (random() > 0.4) {
              await safeClick('#parseButton');
              await page.waitForTimeout(60);

              // If trailing Q correction modal appears, exercise random choice
              if (await page.isVisible('#qCorrectionModal.show')) {
                const choice = randChoice(['apply', 'as-is', 'close', 'escape']);
                if (choice === 'apply') {
                  await safeClick('#qCorrectionApplyBtn');
                } else if (choice === 'as-is') {
                  await safeClick('#qCorrectionAsIsBtn');
                } else if (choice === 'close') {
                  await safeClick('#qCorrectionCloseBtn');
                } else {
                  await page.keyboard.press('Escape');
                }
                await page.waitForTimeout(40);
              }
            }

            // If halving is active and chips exist, randomly click one of the halve chips
            if (await page.isVisible('#halveComponentSelector')) {
              const chipInputs = await page.$$('.halve-chip input');
              if (chipInputs.length > 0) {
                const chip = randChoice(chipInputs);
                await chip.click().catch(() => {});
              }
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
  await safeClick('.ptc-tab[data-ptc="CHD"], .ptc-tab[data-ptc="CNN"]');

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
  await safeClick('.ptc-tab[data-ptc="CHD"], .ptc-tab[data-ptc="CNN"]');
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

  // =========================================================================
  // PHASE 5: STOPOVER CHARGES, SELECTIVE HALVE PERMUTATIONS, & DISCLAIMER
  // =========================================================================
  console.log('\n--- PHASE 5: Stopover Charges, Selective Halve Component Permutations, & Disclaimer Audit ---');

  // Switch to ADT tab and ensure clean baseline for Phase 5
  await safeClick('.ptc-tab[data-ptc="ADT"]');
  await page.waitForTimeout(50);
  if (await page.isChecked('#halveFareComponents')) {
    await page.uncheck('#halveFareComponents');
    await page.waitForTimeout(40);
  }
  await safeClick('#parserClearButton');
  await page.waitForTimeout(50);

  // 1. Multiple Stopovers (1S) detection and NUC aggregation
  const testStringWithStopovers = 'CE EK DXB EK SEZ HM PRI384.92TLEEPIT1/ITN2 HM X/SEZ EK X/DXB EK VCE563.74KLEESIT1/ITN2 1S57.59 1S34.00 NUC1040.25END ROE0.868150';
  await page.fill('#fareCalcString', testStringWithStopovers);
  await page.waitForTimeout(50);

  // Check detector badge
  const detectorBadgeText = await page.textContent('#fareComponentDetectorBadge');
  console.log('  Detector Badge:', detectorBadgeText);
  assert.strictEqual(detectorBadgeText, '2 Components Detected', 'Detector badge must accurately identify 2 components');

  // Convert
  await safeClick('#parseButton');
  await page.waitForTimeout(80);

  // Stopover Charges section must be visible with 2 items
  assert.strictEqual(await page.isVisible('#stopoverChargesSection'), true, 'Stopover charges section must be visible');
  const stopoverItems = await page.$$eval('#stopoverCharges li', lis => lis.map(li => li.textContent.trim()));
  console.log('  Stopover items parsed:', stopoverItems);
  assert.deepStrictEqual(stopoverItems, ['57.59', '34.00'], 'Both stopover charges must be parsed in exact sequence');

  // Calculated NUC must include both fare components and both stopovers
  const calcNucText = await page.textContent('#calculatedNuc');
  console.log('  Calculated NUC with Stopovers:', calcNucText);
  assert.ok(calcNucText.includes('1040.25'), 'Calculated NUC must equal 384.92 + 563.74 + 57.59 + 34.00 = 1040.25');

  const nucPassText = await page.textContent('#nucValidation');
  assert.ok(nucPassText.includes('PASS'), 'NUC validation must PASS for stopovers');
  console.log('  ✓ Stopover charges (1S) correctly identified and summed into NUC.');

  // 2. Selective Halve Component Permutations
  if (!(await page.isChecked('#halveFareComponents'))) {
    await page.check('#halveFareComponents');
    await page.waitForTimeout(50);
  }
  assert.strictEqual(await page.isVisible('#halveComponentSelector'), true, 'Halve component selector must appear when checked');

  const halveOptions = await page.$$eval('.halve-chip', chips => chips.map(c => c.textContent.trim()));
  console.log('  Halve Component Options:', halveOptions);
  assert.strictEqual(halveOptions.length, 3, 'Must present All Components + Component 1 + Component 2');

  // Test Component 1 halved only
  await page.click('input[name="halveComponentChoice"][value="0"]');
  await page.waitForTimeout(60);
  const comp1Nuc = await page.textContent('#calculatedNuc');
  console.log('  Calculated NUC (Component 1 halved):', comp1Nuc);
  assert.ok(comp1Nuc.includes('847.79'), 'NUC for Component 1 halved must equal 192.46 + 563.74 + 57.59 + 34.00 = 847.79');

  // Test Component 2 halved only
  await page.click('input[name="halveComponentChoice"][value="1"]');
  await page.waitForTimeout(60);
  const comp2Nuc = await page.textContent('#calculatedNuc');
  console.log('  Calculated NUC (Component 2 halved):', comp2Nuc);
  assert.ok(comp2Nuc.includes('758.38'), 'NUC for Component 2 halved must equal 384.92 + 281.87 + 57.59 + 34.00 = 758.38');

  // Test All Components halved
  await page.click('input[name="halveComponentChoice"][value="all"]');
  await page.waitForTimeout(60);
  const allHalvedNuc = await page.textContent('#calculatedNuc');
  console.log('  Calculated NUC (All Components halved):', allHalvedNuc);
  assert.ok(allHalvedNuc.includes('565.92'), 'NUC for All Components halved must equal 192.46 + 281.87 + 57.59 + 34.00 = 565.92');

  // Ensure textarea was NOT mutated
  const currentTextareaVal = await page.inputValue('#fareCalcString');
  assert.strictEqual(currentTextareaVal, testStringWithStopovers, 'Original textarea string must be 100% pristine');
  console.log('  ✓ Selective halving chips functional with zero input mutation.');

  // Uncheck halving
  if (await page.isChecked('#halveFareComponents')) {
    await page.uncheck('#halveFareComponents');
    await page.waitForTimeout(50);
  }

  // 3. Auto-Calculate to Child (CNN) with Unscaled Stopover Invariance
  await safeClick('.ptc-tab[data-ptc="CHD"], .ptc-tab[data-ptc="CNN"]');
  await page.waitForTimeout(50);
  const isAutoCalcChecked = await page.isChecked('#autoCalcFromAdult');
  if (!isAutoCalcChecked) {
    await safeClick('#autoCalcFromAdult');
    await page.waitForTimeout(50);
  }
  const cnnFareString = await page.inputValue('#fareCalcString');
  console.log('  Derived CNN Fare String:', cnnFareString);
  // Base components scaled 75%: 384.92 * 0.75 = 288.69, 563.74 * 0.75 = 422.81
  assert.ok(cnnFareString.includes('288.69TLEEPIT1CH/ITN2'), 'Component 1 scaled to 75% for Child');
  assert.ok(cnnFareString.includes('422.81KLEESIT1CH/ITN2'), 'Component 2 scaled to 75% for Child');
  // Stopovers MUST remain 100% unscaled: 1S57.59 and 1S34.00
  assert.ok(cnnFareString.includes('1S57.59'), 'Stopover 1S57.59 unscaled');
  assert.ok(cnnFareString.includes('1S34.00'), 'Stopover 1S34.00 unscaled');
  assert.ok(cnnFareString.includes('NUC803.09'), 'Scaled NUC equals 288.69 + 422.81 + 57.59 + 34.00 = 803.09');
  console.log('  ✓ Auto-calculated Child fare preserves stopovers unscaled.');

  // 4. Centered Disclaimer Cell and K3 Routing in Summary Table
  await safeClick('.ptc-tab[data-ptc="ADT"]');
  await page.fill('#oldFare', 'INR10000');
  await page.fill('#newFare', 'INR11000');
  await page.fill('#changeFee', 'INR9000');
  await page.selectOption('#cabin', 'economy');
  await page.check('#applyK3OnChangeFee');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  await safeClick('#summariseButton');
  await page.waitForTimeout(100);

  const disclaimerCell = await page.$('.summary-disclaimer-cell');
  assert.ok(disclaimerCell !== null, 'Disclaimer cell must be present inside summary table');
  const disclaimerText = await disclaimerCell.textContent();
  assert.ok(disclaimerText.includes('Please note that the fares are not guaranteed'), 'Disclaimer cell text verified');

  // Verify Change Fee label in summary
  const summaryFeeCell = await page.$$eval('#summary tbody tr', trs => {
    const r = trs.find(tr => tr.cells[0]?.textContent.trim() === 'Change Fee');
    return r ? r.cells[1]?.textContent.trim() : null;
  });
  console.log('  Summary Change Fee cell:', summaryFeeCell);
  assert.ok(summaryFeeCell.toLowerCase().includes('(incl. of k3'), 'Change Fee must indicate inclusion of K3');
  console.log('  ✓ Centered disclaimer row and K3 Change Fee routing verified in summary table.');

  // =========================================================================
  // PHASE 6: TRAILING Q SURCHARGE DETECTION, VERIFICATION MODAL, & LABELS AUDIT
  // =========================================================================
  console.log('\n--- PHASE 6: Trailing Q Surcharge Detection, Verification Modal, & Labels Audit ---');

  // Switch to ADT tab and clear
  await safeClick('.ptc-tab[data-ptc="ADT"]');
  await safeClick('#parserClearButton');
  await page.waitForTimeout(50);

  // 1. Audit Direct Numeric Trailing Q with Apply Standard Format & Labels
  const directQUserString = 'VCE QR DOH QR BLR Q 12.29 563.74KLEESIT1/ITN2 QR DOH QR VCE 563.74KLEESIT1/ITN2Q12.29 NUC1152.06 ROE0.925820';
  await page.fill('#fareCalcString', directQUserString);
  await safeClick('#parseButton');
  await page.waitForTimeout(100);

  // Modal must be visible
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true, 'Modal must appear for direct numerical trailing Q');

  // Verify updated labels
  const modalBadgeText = (await page.textContent('.q-modal-badge')).trim();
  console.log('  Modal Badge Text:', modalBadgeText);
  assert.strictEqual(modalBadgeText, 'FARE CALC STRING FORMAT', 'Badge must display "FARE CALC STRING FORMAT"');

  const modalHeadingText = (await page.textContent('#qCorrectionTitle')).trim();
  console.log('  Modal Heading Text:', modalHeadingText);
  assert.strictEqual(modalHeadingText, 'Fare Calculation Syntax Notice', 'Heading must match "Fare Calculation Syntax Notice"');

  const modalDescText = await page.textContent('.q-modal-desc');
  assert.ok(modalDescText.includes('In standard Fare Calc String format, Q-surcharges precede the fare component.'), 'Description must reference "Fare Calc String format"');

  const recCardLabel = (await page.textContent('.q-diff-card-recommended .q-diff-label span:first-child')).trim();
  console.log('  Recommended Card Label:', recCardLabel);
  assert.strictEqual(recCardLabel, 'Standard Fare Calc String Format', 'Recommended card label must read "Standard Fare Calc String Format"');

  // Verify diff highlights
  const diffInputtedHtml = await page.innerHTML('#qDiffInputted');
  assert.ok(diffInputtedHtml.includes('q-hl-misplaced'), 'Inputted diff must highlight misplaced Q surcharge');

  const diffStandardHtml = await page.innerHTML('#qDiffStandardized');
  assert.ok(diffStandardHtml.includes('q-hl-standard'), 'Standardized diff must highlight standardized Q surcharge');

  // Click Apply Standard Format & Validate
  await page.click('#qCorrectionApplyBtn');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Modal must close after Apply');

  // Verify standardized string in textarea
  const appliedFcs = await page.inputValue('#fareCalcString');
  assert.ok(appliedFcs.includes('Q12.29 563.74KLEESIT1/ITN2'), 'Textarea must be standardized with Q12.29 preceding fare component');

  // Verify clean components, surcharges, and NUC
  const directQComps = await page.$$eval('#fareComponents li', lis => lis.map(li => li.innerText.trim()));
  console.log('  Applied Fare Components:', directQComps);
  assert.strictEqual(directQComps.length, 2);
  assert.ok(directQComps[1].includes('(KLEESIT1/ITN2)'), 'Designator /ITN2 must NOT swallow Q12');

  const directQSurcharges = await page.$$eval('#qSurcharges li', lis => lis.map(li => li.innerText.trim()));
  console.log('  Applied Q Surcharges:', directQSurcharges);
  assert.deepStrictEqual(directQSurcharges, ['12.29', '12.29']);

  const directQNuc = await page.textContent('#calculatedNuc');
  assert.ok(directQNuc.includes('1152.06'), 'Calculated NUC must match 1152.06');
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'NUC validation must PASS');
  console.log('  ✓ Direct numeric trailing Q properly detected, standardized, and validated.');

  // 2. Audit Coded Airport-Pair Trailing Q with "Validate As-Is"
  await safeClick('#parserClearButton');
  await page.waitForTimeout(50);

  const codedQUserString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB23.41 585.36UHEESIE1/VFN2Q COKDUB58.47 NUC1215.27END ROE0.855028';
  await page.fill('#fareCalcString', codedQUserString);
  await safeClick('#parseButton');
  await page.waitForTimeout(100);

  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true, 'Modal must trigger for glued coded Q surcharge (585.36UHEESIE1/VFN2Q COKDUB58.47)');

  // Click Validate As-Is
  await page.click('#qCorrectionAsIsBtn');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Modal must close after Validate As-Is');

  // Invariant 3: Raw textarea string must remain 100% untouched
  const asIsFcs = await page.inputValue('#fareCalcString');
  assert.strictEqual(asIsFcs, codedQUserString, 'Raw string in textarea must remain pristine when user chooses Validate As-Is');

  // Verify clean components: /VFN2 must NOT swallow Q
  const codedQComps = await page.$$eval('#fareComponents li', lis => lis.map(li => li.innerText.trim()));
  console.log('  As-Is Fare Components:', codedQComps);
  assert.strictEqual(codedQComps.length, 2);
  assert.ok(codedQComps[1].includes('(UHEESIE1/VFN2)'), 'Second component must remain clean /VFN2 with NO trailing Q');

  // Verify Q surcharges: zero phantom 2.00 surcharge
  const codedQSurcharges = await page.$$eval('#qSurcharges li', lis => lis.map(li => li.innerText.trim()));
  console.log('  As-Is Q Surcharges:', codedQSurcharges);
  assert.strictEqual(codedQSurcharges.includes('2.00'), false, 'Phantom 2.00 surcharge must NOT exist');
  assert.deepStrictEqual(codedQSurcharges, ['58.47', '18.82', '23.41', '58.47'], 'All 4 Q surcharges cleanly parsed');

  // Calculated NUC must be exactly 1215.27
  const codedQNuc = await page.textContent('#calculatedNuc');
  console.log('  As-Is Calculated NUC:', codedQNuc);
  assert.ok(codedQNuc.includes('1215.27'), 'Calculated NUC must be 1215.27 (not 1217.27)');
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'NUC validation must PASS');

  // Subsequent Convert without text change must not re-prompt
  await safeClick('#parseButton');
  await page.waitForTimeout(80);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Subsequent Convert on verified string must not re-prompt');
  console.log('  ✓ Coded airport-pair trailing Q validated As-Is with raw text retention, clean designator, and no phantom surcharge.');

  // 3. Modal Dismissal Hygiene (Close button and Escape)
  await safeClick('#parserClearButton');
  await page.waitForTimeout(50);
  await page.fill('#fareCalcString', directQUserString);
  await safeClick('#parseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true);

  // Close via icon
  await page.click('#qCorrectionCloseBtn');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Modal must close on X icon click');

  // Re-open and close via Escape
  await safeClick('#parseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Modal must close on Escape key');
  console.log('  ✓ Modal dismissal hygiene verified (X button & Escape).');

  // 4. Downstream Integration: Child (CNN) Auto-Calculation from Validated Trailing Q Adult String
  await safeClick('#parserClearButton');
  await page.waitForTimeout(50);
  await page.fill('#fareCalcString', directQUserString);
  await safeClick('#parseButton');
  await page.waitForTimeout(100);
  await page.click('#qCorrectionApplyBtn');
  await page.waitForTimeout(200);

  await safeClick('.ptc-tab[data-ptc="CHD"], .ptc-tab[data-ptc="CNN"]');
  await page.waitForTimeout(80);
  if (await page.isChecked('#halveFareComponents')) {
    await page.uncheck('#halveFareComponents');
    await page.waitForTimeout(50);
  }
  if (await page.isChecked('#autoCalcFromAdult')) {
    await page.uncheck('#autoCalcFromAdult');
    await page.waitForTimeout(60);
  }
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(300);
  const derivedCnnFcs = await page.inputValue('#fareCalcString');
  console.log('  Derived CNN Fare String:', derivedCnnFcs);
  assert.ok(derivedCnnFcs.includes('422.81KLEESIT1CH/ITN2'), 'Child fare component accurately scaled to 75%');
  assert.ok(derivedCnnFcs.includes('9.22'), 'Child Q surcharge accurately scaled to 75%');
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'Child NUC validation PASS');
  console.log('  ✓ Downstream Auto-Calculate to Child cleanly handles decoupled components and surcharges.');

  await verifyInvariants('Phase 6 End');

  assert.strictEqual(errors.length, 0, 'Zero unexpected runtime errors occurred during chaos execution: ' + JSON.stringify(errors));
  await browser.close();

  console.log('\n========================================================================');
  console.log(`EXTREME CHAOS FUZZING COMPLETED: ${assertionCount} INVARIANTS VERIFIED 100%!`);
  console.log('ZERO STATE LEAKS | ZERO CALCULATION DRIFTS | ZERO DEFECTS');
  console.log('========================================================================\n');
})();
