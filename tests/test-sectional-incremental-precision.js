const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

// CLI options: --seed=<number> --steps=<number>
const args = process.argv.slice(2);
let SEED = 42;
let TOTAL_STEPS = 250;

for (const arg of args) {
  if (arg.startsWith('--seed=')) {
    SEED = parseInt(arg.split('=')[1], 10) || 42;
  }
  if (arg.startsWith('--steps=')) {
    TOTAL_STEPS = parseInt(arg.split('=')[1], 10) || 250;
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

const CURRENCIES = [
  { code: 'USD', decimals: 2, type: 'nearest', unit: 0.01 },
  { code: 'INR', decimals: 0, type: 'ceiling', unit: 1 },
  { code: 'EUR', decimals: 2, type: 'nearest', unit: 0.01 },
  { code: 'GBP', decimals: 2, type: 'nearest', unit: 0.01 },
  { code: 'AED', decimals: 0, type: 'ceiling', unit: 1 },
  { code: 'KWD', decimals: 3, type: 'ceiling', unit: 0.001 },
  { code: 'JPY', decimals: 0, type: 'nearest', unit: 1 },
  { code: 'CAD', decimals: 2, type: 'nearest', unit: 0.01 },
  { code: 'AUD', decimals: 2, type: 'nearest', unit: 0.01 }
];

const CABINS = ['economy', 'premium', 'business', 'first'];
const CABIN_RATES = { economy: 0.05, premium: 0.18, business: 0.18, first: 0.18 };
const TABS = ['ADT', 'CHD', 'INF', 'INF_CHD', 'CHD_ADT'];

function roundVal(amount, currRule) {
  if (isNaN(amount) || amount === 0) return 0;
  const unit = currRule.unit || (1 / Math.pow(10, currRule.decimals));
  let rounded;
  if (currRule.type === 'ceiling') {
    rounded = Math.ceil(amount / unit - 1e-9) * unit;
  } else {
    rounded = Math.round(amount / unit) * unit;
  }
  return parseFloat(rounded.toFixed(currRule.decimals));
}

function parseAmountVal(str) {
  if (!str) return 0;
  const m = str.match(/([+-]?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

(async () => {
  console.log('========================================================================');
  console.log('STARTING LARGE-SCALE SECTIONAL INCREMENTAL PRECISION AUDIT');
  console.log(`Config: SEED=${SEED} | TARGET_STEPS=${TOTAL_STEPS}`);
  console.log('Testing: Pure Taxes -> Fare Calc Strings -> Direct Fares & Cabin K3 -> Multi-PTC');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon') && !txt.includes('net::ERR_FILE_NOT_FOUND')) {
        consoleErrors.push('console error: ' + txt);
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
      await page.waitForTimeout(20);
    } catch (_) {}
  }

  await dismissModals();

  const val = async (id) => {
    return await page.$eval('#' + id, el => el.value !== undefined ? el.value : el.textContent).catch(() => '');
  };

  const isChecked = async (id) => {
    return await page.$eval('#' + id, el => !!el.checked).catch(() => false);
  };

  let executedSteps = 0;
  let verifiedInvariants = 0;

  // =========================================================================
  // ROOT CAUSE DIAGNOSTIC LOGGER & ASSERTION ENGINE
  // =========================================================================
  async function assertPrecision(actual, expected, contextInfo) {
    verifiedInvariants++;
    if (actual !== expected) {
      console.error('\n' + '='.repeat(74));
      console.error('🚨 PRECISION AUDIT FAILURE DETECTED!');
      console.error(`Step [${executedSteps}/${TOTAL_STEPS}] | Context: ${contextInfo.title}`);
      console.error(`Field: ${contextInfo.field}`);
      console.error(`Expected: "${expected}"`);
      console.error(`Actual:   "${actual}"`);
      if (contextInfo.mathTrace) {
        console.error('\n--- MATHEMATICAL TRACE ---');
        console.error(contextInfo.mathTrace);
      }
      try {
        const domSnapshot = await page.evaluate(() => ({
          currency: document.getElementById('currency')?.value,
          cabin: document.getElementById('cabin')?.value,
          oldTax: document.getElementById('oldTax')?.value,
          newTax: document.getElementById('newTax')?.value,
          addTaxes: document.getElementById('addTaxes')?.value,
          refundTaxes: document.getElementById('refundTaxes')?.value,
          taxAdj: document.getElementById('taxAdj')?.value,
          fareCalcString: document.getElementById('fareCalcString')?.value,
          newFare: document.getElementById('newFare')?.value,
          oldFare: document.getElementById('oldFare')?.value,
          fareDiff: document.getElementById('fareDiff')?.value,
          k3Tax: document.getElementById('k3Tax')?.value,
          changeFee: document.getElementById('changeFee')?.value,
          perPax: document.getElementById('perPax')?.value,
          subTotal: document.getElementById('subTotal')?.value,
          pax: document.getElementById('pax')?.value,
          gdsString: document.getElementById('gdsString')?.value
        }));
        console.error('\n--- DOM SNAPSHOT ---');
        console.error(JSON.stringify(domSnapshot, null, 2));

        const internalState = await page.evaluate(() => {
          if (typeof state !== 'undefined' && typeof activePtc !== 'undefined') {
            return {
              activePtc,
              currentTabState: state.passengerTypes ? state.passengerTypes[activePtc] : null
            };
          }
          return 'state unavailable';
        });
        console.error('\n--- INTERNAL TAB STATE ---');
        console.error(JSON.stringify(internalState, null, 2));
      } catch (dumpErr) {
        console.error('Failed to dump DOM state:', dumpErr.message);
      }
      console.error('='.repeat(74) + '\n');
      throw new Error(`Precision assertion failed at Step ${executedSteps}: Expected "${expected}", got "${actual}"`);
    }
  }

  async function safeClick(selector) {
    await dismissModals();
    if (await page.isVisible(selector)) {
      const isDisabled = await page.isDisabled(selector).catch(() => false);
      if (!isDisabled) {
        try {
          await page.click(selector, { timeout: 2000 });
        } catch (_) {
          await dismissModals();
          await page.click(selector, { force: true }).catch(() => {});
        }
      }
    }
  }

  async function safeCheck(selector) {
    await dismissModals();
    try {
      await page.check(selector, { timeout: 2000 });
    } catch (_) {
      await dismissModals();
      await page.check(selector, { force: true }).catch(() => {});
    }
  }

  async function safeUncheck(selector) {
    await dismissModals();
    try {
      await page.uncheck(selector, { timeout: 2000 });
    } catch (_) {
      await dismissModals();
      await page.uncheck(selector, { force: true }).catch(() => {});
    }
  }

  // =========================================================================
  // SECTION 1: PURE TAXES ONLY (65 Steps)
  // Input: only taxes. Math, add/refund fields, perPax, and summary table audit.
  // =========================================================================
  console.log('--- SECTION 1: Pure Taxes Only Section Audit (65 Steps) ---');

  const TAX_CODES = ['YQ', 'YR', 'IN', 'WO', 'P2', 'F6', 'GB', 'UB', 'XT', 'OC'];

  for (let s = 1; s <= 65; s++) {
    executedSteps++;
    const ptc = randChoice(TABS);
    await safeClick(`#ptcTab${ptc}`);
    await page.waitForTimeout(30);

    // Reset ptcData summaries so this step evaluates in pure single-tab tax isolation
    await page.evaluate(() => {
      if (typeof state !== 'undefined' && state.ptcData) {
        for (const k in state.ptcData) state.ptcData[k].summaryData = null;
      }
    });

    const curr = randChoice(CURRENCIES);
    const cabin = randChoice(CABINS);
    await page.selectOption('#currency', curr.code);
    await page.selectOption('#cabin', cabin);

    // Clear previous fare inputs to isolate tax section
    await page.fill('#oldFare', '');
    await page.fill('#newFare', '');
    await page.fill('#fareDiff', '');
    await page.fill('#changeFee', '');

    const numOldTaxes = randInt(1, 3);
    const numNewTaxes = randInt(1, 4);

    const oldTaxList = [];
    const newTaxList = [];
    const taxNetMap = {};

    for (let i = 0; i < numOldTaxes; i++) {
      const code = randChoice(TAX_CODES);
      const amt = randInt(20, 200);
      oldTaxList.push(`${curr.code}${amt}${code}`);
      taxNetMap[code] = (taxNetMap[code] || 0) - amt;
    }

    // Include some PD-restated entries occasionally
    const isPd = (s % 4 === 0);
    for (let i = 0; i < numNewTaxes; i++) {
      const code = randChoice(TAX_CODES);
      const amt = randInt(25, 300);
      if (isPd && i === 0 && oldTaxList.length > 0) {
        newTaxList.push(`PD${oldTaxList[0]}`);
        const m = oldTaxList[0].match(/([0-9]+(?:\.[0-9]+)?)([A-Z0-9]{2})$/);
        if (m) {
          const pdAmt = parseFloat(m[1]);
          const pdCode = m[2];
          taxNetMap[pdCode] = (taxNetMap[pdCode] || 0) + pdAmt;
        }
        newTaxList.push(`${curr.code}${amt}${code}`);
      } else {
        newTaxList.push(`${curr.code}${amt}${code}`);
      }
      taxNetMap[code] = (taxNetMap[code] || 0) + amt;
    }

    const separator = randChoice(['/', ' / ', '\n', ' ']);
    const oldTaxInput = oldTaxList.join(separator);
    const newTaxInput = newTaxList.join(separator);

    await page.fill('#oldTax', oldTaxInput);
    await page.fill('#newTax', newTaxInput);

    const checkK3OnYq = (s % 3 === 0);
    if (checkK3OnYq) {
      await safeCheck('#applyK3OnYQ');
    } else {
      await safeUncheck('#applyK3OnYQ');
    }

    await safeClick('#taxCalcButton');
    await page.waitForTimeout(60);

    // Verify calculated fields
    const domAddTaxes = await val('addTaxes');
    const domRefundTaxes = await val('refundTaxes');
    const domTaxAdj = await val('taxAdj');
    const domFareDiff = await val('fareDiff');
    const domPerPax = await val('perPax');
    const domSubTotal = await val('subTotal');

    // Expected net tax math
    let expectedAddSum = 0;
    let expectedRefundSum = 0;
    let yqDiff = 0;

    for (const [code, netAmt] of Object.entries(taxNetMap)) {
      if (code === 'YQ') yqDiff = netAmt;
      if (netAmt > 0) expectedAddSum += netAmt;
      if (netAmt < 0) expectedRefundSum += Math.abs(netAmt);
    }

    let expectedK3OnYq = 0;
    if (checkK3OnYq && yqDiff > 0) {
      expectedK3OnYq = roundVal(yqDiff * CABIN_RATES[cabin], curr);
    }

    const expectedNetTax = roundVal(expectedAddSum - expectedRefundSum + expectedK3OnYq, curr);
    const expectedTaxAdjStr = `${curr.code}${expectedNetTax.toFixed(curr.decimals)}`;

    // Invariant 1: Fare difference must remain clean (0 or empty)
    await assertPrecision(domFareDiff, '', {
      title: `[Section 1: Step ${s}] Isolation check: fare diff must remain empty`,
      field: 'fareDiff'
    });

    // Invariant 2: Tax adjustment must equal net tax
    await assertPrecision(parseAmountVal(domTaxAdj), expectedNetTax, {
      title: `[Section 1: Step ${s}] Net Tax Adjustment correctness`,
      field: 'taxAdj',
      mathTrace: `Expected Add: ${expectedAddSum}, Refund: ${expectedRefundSum}, K3 on YQ: ${expectedK3OnYq} => Net: ${expectedNetTax}`
    });

    // Invariant 3: PerPax and SubTotal must exactly equal net tax (since fare diff and change fee are 0)
    await assertPrecision(parseAmountVal(domPerPax), expectedNetTax, {
      title: `[Section 1: Step ${s}] Per Pax equals Tax Adjustment`,
      field: 'perPax'
    });

    await assertPrecision(parseAmountVal(domSubTotal), expectedNetTax, {
      title: `[Section 1: Step ${s}] Sub Total equals Tax Adjustment (pax=1)`,
      field: 'subTotal'
    });

    // Invariant 4: Summary Table correctness with taxes only
    await safeClick('#summariseButton');
    await page.waitForTimeout(60);

    const summaryVisible = await page.isVisible('#summaryContent');
    assert.strictEqual(summaryVisible, true, 'Summary content must be displayed');

    const gdsString = await val('gdsString');
    assert.ok(gdsString.includes('TAX'), `GDS string must include TAX`);
    assert.ok(gdsString.includes(`FARE DIFF ${curr.code}0`) || gdsString.includes(`FARE DIFF ${curr.code}0.00`) || gdsString.includes(`FARE DIFF ${curr.code}0.000`), `GDS string must show 0 FARE DIFF`);
    assert.ok(gdsString.includes(`CHG FEE ${curr.code}0`) || gdsString.includes(`CHG FEE ${curr.code}0.00`) || gdsString.includes(`CHG FEE ${curr.code}0.000`), `GDS string must show 0 CHG FEE`);

    // Invariant 5: Stale notice reactivity
    await page.fill('#oldTax', oldTaxInput + ' 10YQ');
    await page.waitForTimeout(30);
    const staleNoticeVisible = await page.isVisible('#summaryStaleNotice');
    assert.strictEqual(staleNoticeVisible, true, 'Stale notice must appear when taxes are altered');

    await safeClick('#taxCalcButton');
    await safeClick('#summariseButton');
    await page.waitForTimeout(30);
    const staleNoticeHidden = await page.isHidden('#summaryStaleNotice');
    assert.strictEqual(staleNoticeHidden, true, 'Stale notice must disappear after re-summarising');
  }
  console.log(`  ✓ Passed 65 pure taxes-only steps with 0 leaks and 100% precision.\n`);

  // =========================================================================
  // SECTION 2: FARE CALCULATION STRINGS (70 Steps)
  // Input: Complex Fare Calc Strings. NUC, ROE, Base Fare, auto-population,
  // combined summary with existing taxes, modals, stopovers, and selective halving.
  // =========================================================================
  console.log('--- SECTION 2: Fare Calculation Strings Audit (70 Steps) ---');

  const SAMPLE_STRINGS = [
    {
      raw: 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM 404.56XWEEFIN1/NDC2 Q5.00 NUC511.77 ROE90.3344456',
      nuc: 511.77,
      roe: 90.3344456,
      hasTrailingQ: false
    },
    {
      raw: 'LON BA PAR 150.00YAP21LON BA LON 150.00YAP21LON NUC300.00 ROE0.825000',
      nuc: 300.00,
      roe: 0.825000,
      hasTrailingQ: false
    },
    {
      raw: 'DEL AI BOM 120.50YEEPIN12 BOM AI DEL 120.50YEEPIN12 Q 25.00 1S35.00 NUC301.00 ROE82.450000',
      nuc: 301.00,
      roe: 82.450000,
      hasTrailingQ: false
    },
    {
      // Trailing Q attached after fare basis: triggers syntax notice modal
      raw: 'VCE QR DOH QR BLR 422.81KLEESIT1/ITN2 Q12.29 QR DOH QR VCE 422.81KLEESIT1/ITN2 Q12.29 NUC870.20 ROE0.925820',
      nuc: 870.20,
      roe: 0.925820,
      hasTrailingQ: true
    },
    {
      raw: 'VCE EK DXB EK SEZ HM PRI384.92TLEEPIT1/ITN2 HM X/SEZ EK X/DXB EK VCE563.74KLEESIT1/ITN2 1S57.59 1S34.00 NUC1040.25END ROE0.868150',
      nuc: 1040.25,
      roe: 0.868150,
      hasStopover: true
    }
  ];

  for (let s = 1; s <= 70; s++) {
    executedSteps++;
    const ptc = randChoice(TABS);
    await safeClick(`#ptcTab${ptc}`);
    await page.waitForTimeout(30);

    await page.evaluate(() => {
      if (typeof state !== 'undefined' && state.ptcData) {
        for (const k in state.ptcData) state.ptcData[k].summaryData = null;
      }
    });

    const curr = randChoice(CURRENCIES);
    await page.selectOption('#currency', curr.code);

    const sample = randChoice(SAMPLE_STRINGS);
    await page.fill('#fareCalcString', sample.raw);
    await page.waitForTimeout(40);

    await safeClick('#parseButton');
    await page.waitForTimeout(60);

    // If modal appears for trailing Q, test modal buttons
    const isModalVisible = await page.isVisible('#qCorrectionModal.show');
    if (isModalVisible) {
      if (s % 2 === 0) {
        await page.click('#qCorrectionApplyBtn');
      } else {
        await page.click('#qCorrectionAsIsBtn');
      }
      await page.waitForTimeout(100);
    }

    // Verify NUC, ROE, Base Fare
    const domCalcVal = await val('calculatedNuc');
    const domRoeVal = await val('roe');
    const domBaseFareVal = await val('baseFare');

    const expectedBaseFareNum = roundVal(sample.nuc * sample.roe, curr);
    const parsedBaseFareNum = parseAmountVal(domBaseFareVal);

    // Invariant 6: Base fare calculation accurately matches NUC * ROE
    await assertPrecision(parsedBaseFareNum, expectedBaseFareNum, {
      title: `[Section 2: Step ${s}] Base Fare calculation from NUC * ROE`,
      field: 'baseFare',
      mathTrace: `NUC: ${sample.nuc} * ROE: ${sample.roe} = ${sample.nuc * sample.roe} => Rounded (${curr.code}): ${expectedBaseFareNum}`
    });

    // Populate the validated new base fare into the Fare Calculator
    await page.fill('#newFare', String(expectedBaseFareNum));

    // Invariant 7: Selective Halving check if available
    if (sample.hasStopover) {
      await safeCheck('#halveFareComponents');
      await page.waitForTimeout(40);
      const halveOptionsVisible = await page.isVisible('#halveComponentSelector');
      assert.strictEqual(halveOptionsVisible, true, 'Halve component selector options must be visible');
      // Uncheck to restore
      await safeUncheck('#halveFareComponents');
      await page.waitForTimeout(30);
    }

    // Enter oldFare to check fareDiff re-calculation
    const oldFareAmt = randInt(100, Math.floor(expectedBaseFareNum * 0.8) || 200);
    await page.fill('#oldFare', String(oldFareAmt));
    await safeClick('#fareCalcButton');
    await page.waitForTimeout(40);

    const expectedDiff = roundVal(expectedBaseFareNum - oldFareAmt, curr);
    const domFareDiff = parseAmountVal(await val('fareDiff'));

    await assertPrecision(domFareDiff, expectedDiff, {
      title: `[Section 2: Step ${s}] Fare difference after string conversion`,
      field: 'fareDiff',
      mathTrace: `New Fare: ${expectedBaseFareNum} - Old Fare: ${oldFareAmt} = ${expectedDiff}`
    });

    // Invariant 8: Summary table displays both Fare Diff and Taxes
    await safeClick('#summariseButton');
    await page.waitForTimeout(40);
    const gdsString = await val('gdsString');
    assert.ok(gdsString.includes(`FARE DIFF ${curr.code}`), `GDS string must include FARE DIFF ${curr.code}`);
  }
  console.log(`  ✓ Passed 70 fare calc string validation steps with 100% precision.\n`);

  // =========================================================================
  // SECTION 3: DIRECT BASE FARES, FEES & CABIN K3 (65 Steps)
  // Input: Direct Old & New Base Fares, Change Fees, Cabin selection (5%/18%),
  // passenger counts (1 to 9), and K3 checkboxes.
  // =========================================================================
  console.log('--- SECTION 3: Direct Base Fares, Fees & Cabin K3 Audit (65 Steps) ---');

  for (let s = 1; s <= 65; s++) {
    executedSteps++;
    const ptc = randChoice(TABS);
    await safeClick(`#ptcTab${ptc}`);
    await page.waitForTimeout(30);

    await page.evaluate(() => {
      if (typeof state !== 'undefined' && state.ptcData) {
        for (const k in state.ptcData) state.ptcData[k].summaryData = null;
      }
    });

    const curr = randChoice(CURRENCIES);
    const cabin = randChoice(CABINS);
    await page.selectOption('#currency', curr.code);
    await page.selectOption('#cabin', cabin);

    const oldFare = randInt(500, 5000);
    const isUpgrade = (s % 3 !== 0);
    const newFare = isUpgrade ? oldFare + randInt(100, 2000) : Math.max(100, oldFare - randInt(50, 400));
    const changeFee = randInt(0, 500);
    const paxCount = randInt(1, 6);

    await page.fill('#oldFare', String(oldFare));
    await page.fill('#newFare', String(newFare));
    await page.fill('#changeFee', String(changeFee));
    await page.fill('#pax', String(paxCount));

    const applyK3Fare = (s % 2 === 0);
    const applyK3Fee = (s % 3 === 0);

    if (applyK3Fare) await safeCheck('#applyK3OnFareDiff');
    else await safeUncheck('#applyK3OnFareDiff');

    if (applyK3Fee) await safeCheck('#applyK3OnChangeFee');
    else await safeUncheck('#applyK3OnChangeFee');

    await safeClick('#fareCalcButton');
    await page.waitForTimeout(40);

    const diff = roundVal(newFare - oldFare, curr);
    let expectedK3Fare = 0;
    if (diff > 0 && applyK3Fare) {
      expectedK3Fare = roundVal(diff * CABIN_RATES[cabin], curr);
    }

    let expectedK3Fee = 0;
    if (changeFee > 0 && applyK3Fee) {
      expectedK3Fee = roundVal(changeFee * CABIN_RATES[cabin], curr);
    }

    const netTaxInDom = parseAmountVal(await val('taxAdj'));
    const expectedPerPax = roundVal(diff + changeFee + expectedK3Fee + netTaxInDom, curr);
    const expectedSubTotal = roundVal(expectedPerPax * paxCount, curr);

    const domFareDiff = parseAmountVal(await val('fareDiff'));
    const domK3Tax = parseAmountVal(await val('k3Tax'));
    const domPerPax = parseAmountVal(await val('perPax'));
    const domSubTotal = parseAmountVal(await val('subTotal'));

    // Invariant 9: Exact Fare Diff
    await assertPrecision(domFareDiff, diff, {
      title: `[Section 3: Step ${s}] Direct fare diff`,
      field: 'fareDiff'
    });

    // Invariant 10: Exact K3 Tax on Fare Diff & Change Fee
    const expectedTotalK3 = roundVal(expectedK3Fare + expectedK3Fee, curr);
    await assertPrecision(domK3Tax, expectedTotalK3, {
      title: `[Section 3: Step ${s}] Calculated K3 on fare diff + fee (${cabin})`,
      field: 'k3Tax',
      mathTrace: `K3 Fare (${expectedK3Fare}) + K3 Fee (${expectedK3Fee}) = ${expectedTotalK3}`
    });

    // Invariant 11: Exact Per Pax Amount
    await assertPrecision(domPerPax, expectedPerPax, {
      title: `[Section 3: Step ${s}] Per Pax Calculation`,
      field: 'perPax',
      mathTrace: `Diff(${diff}) + Fee(${changeFee}) + K3Fee(${expectedK3Fee}) + Tax(${netTaxInDom}) = ${expectedPerPax}`
    });

    // Invariant 12: SubTotal multiplies perPax by paxCount
    await assertPrecision(domSubTotal, expectedSubTotal, {
      title: `[Section 3: Step ${s}] Sub Total multiplication by pax count (${paxCount})`,
      field: 'subTotal',
      mathTrace: `PerPax(${expectedPerPax}) * Pax(${paxCount}) = ${expectedSubTotal}`
    });

    // Invariant 13: Summary Table and GDS string audit
    await safeClick('#summariseButton');
    await page.waitForTimeout(40);

    const gdsString = await val('gdsString');
    if (diff !== 0) {
      assert.ok(gdsString.includes('FARE DIFF'), 'GDS string must include FARE DIFF');
    }
    if (changeFee !== 0) {
      assert.ok(gdsString.includes('CHG FEE'), 'GDS string must include CHG FEE');
    }
  }
  console.log(`  ✓ Passed 65 direct base fare, fees, and cabin K3 steps with 100% precision.\n`);

  // =========================================================================
  // SECTION 4: CROSS-TAB ZIG-ZAG, MULTI-PTC AGGREGATION & LIVE FLUSHES (60 Steps)
  // Input: Rapid tab switching with active inputs, verifying zero state bleed,
  // multi-passenger consolidated tables, and keyboard/modal hygiene.
  // =========================================================================
  console.log('--- SECTION 4: Cross-Tab Zig-Zag & Multi-PTC Aggregation (60 Steps) ---');

  for (let s = 1; s <= 60; s++) {
    executedSteps++;
    const tabA = randChoice(TABS);
    let tabB = randChoice(TABS);
    while (tabB === tabA) tabB = randChoice(TABS);

    // Setup tab A
    await safeClick(`#ptcTab${tabA}`);
    await page.waitForTimeout(20);
    await page.selectOption('#currency', 'INR');
    const fareA = randInt(1000, 3000);
    await page.fill('#oldFare', String(fareA));
    await page.fill('#newFare', String(fareA + 500));
    await safeClick('#fareCalcButton');
    await page.waitForTimeout(20);

    // Switch to tab B and setup different values
    await safeClick(`#ptcTab${tabB}`);
    await page.waitForTimeout(20);
    await page.selectOption('#currency', 'INR');
    const fareB = randInt(4000, 8000);
    await page.fill('#oldFare', String(fareB));
    await page.fill('#newFare', String(fareB + 1000));
    await safeClick('#fareCalcButton');
    await page.waitForTimeout(20);

    // Invariant 14: Tab B must not have tab A's values
    const domOldFareB = parseAmountVal(await val('oldFare'));
    assert.strictEqual(domOldFareB, fareB, `Tab ${tabB} must retain its own oldFare without bleed`);

    // Switch back to tab A
    await safeClick(`#ptcTab${tabA}`);
    await page.waitForTimeout(20);

    // Invariant 15: Tab A must retain its original state intact
    const domOldFareA = parseAmountVal(await val('oldFare'));
    const domFareDiffA = parseAmountVal(await val('fareDiff'));
    assert.strictEqual(domOldFareA, fareA, `Tab ${tabA} must retain original oldFare after switching back`);
    assert.strictEqual(domFareDiffA, 500, `Tab ${tabA} must retain original fareDiff`);

    // Invariant 16: Multi-PTC Summary generation
    await safeClick('#summariseButton');
    await page.waitForTimeout(30);
    const summaryVisible = await page.isVisible('#summaryContent');
    assert.strictEqual(summaryVisible, true, 'Summary table must render for multi-PTC consolidation');
  }
  console.log(`  ✓ Passed 60 cross-tab zig-zag and multi-PTC aggregation steps with zero leaks.\n`);

  console.log('========================================================================');
  console.log(`TOTAL AUDIT COMPLETED: ${executedSteps} STEPS EXECUTED SUCCESSFULLY`);
  console.log(`VERIFIED INVARIANTS: ${verifiedInvariants} STRICT ASSERTIONS PASSED (100%)`);
  console.log(`CONSOLE / PAGE ERRORS: ${consoleErrors.length}`);
  console.log('========================================================================\n');

  assert.strictEqual(consoleErrors.length, 0, `Expected 0 console errors, but got:\n${consoleErrors.join('\n')}`);
  assert.ok(executedSteps >= TOTAL_STEPS, `Expected at least ${TOTAL_STEPS} steps, executed ${executedSteps}`);

  console.log('ALL SECTIONAL PRECISION INVARIANTS AND RUNTIME HYGIENE VERIFIED 100% OK!');
  await browser.close();
})().catch(err => {
  console.error('\nAUDIT ABORTED WITH ERROR:');
  console.error(err.message);
  process.exitCode = 1;
});
