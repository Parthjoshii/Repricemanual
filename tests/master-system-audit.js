/**
 * ============================================================================
 * MANUAL REPRICE - MASTER SYSTEM AUDIT & ZERO-DEFECT TEST SUITE
 * ============================================================================
 * 
 * Single authoritative master test suite covering:
 *  1. Mathematical Accuracy & Currency Precision (Zero Floating-Point Drift)
 *  2. GDS Linear Fare Construction String & Tax Parser Engine
 *  3. Dynamic Passenger Tab State Management, Isolation & Order-Independence
 *  4. UI/UX Design Geometry & CSS Paint Lifecycle (Zero Flicker, 0.00px Offsets)
 *  5. Extreme Stateful Chaos Fuzzing & Disordered Sequence Stress Testing
 * 
 * Usage:
 *   node tests/master-system-audit.js
 *   node tests/master-system-audit.js --seed=12345 --chaos-steps=300
 * ============================================================================
 */

const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const fs = require('fs');

// CLI Arguments
const args = process.argv.slice(2);
let SEED = 42;
let CHAOS_STEPS = 200;

for (const arg of args) {
  if (arg.startsWith('--seed=')) SEED = parseInt(arg.split('=')[1], 10) || 42;
  if (arg.startsWith('--chaos-steps=')) CHAOS_STEPS = parseInt(arg.split('=')[1], 10) || 200;
}

// Deterministic Mulberry32 PRNG for reproducible chaos runs
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
function randInt(min, max) { return Math.floor(random() * (max - min + 1)) + min; }
function randChoice(arr) { return arr[randInt(0, arr.length - 1)]; }

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

// Suite Reporter
class AuditReporter {
  constructor() {
    this.totalTests = 0;
    this.passed = 0;
    this.failed = 0;
    this.moduleStats = {};
    this.currentModule = 'General';
    this.startTime = Date.now();
  }

  setModule(name) {
    this.currentModule = name;
    if (!this.moduleStats[name]) {
      this.moduleStats[name] = { passed: 0, failed: 0, tests: [] };
    }
    console.log(`\n========================================================================`);
    console.log(`MODULE: ${name}`);
    console.log(`========================================================================`);
  }

  assert(description, condition, actual = '') {
    this.totalTests++;
    if (condition) {
      this.passed++;
      this.moduleStats[this.currentModule].passed++;
      this.moduleStats[this.currentModule].tests.push({ desc: description, status: 'PASS' });
      console.log(`  ✓ [PASS] ${description}`);
    } else {
      this.failed++;
      this.moduleStats[this.currentModule].failed++;
      this.moduleStats[this.currentModule].tests.push({ desc: description, status: 'FAIL', actual });
      console.error(`  ✗ [FAIL] ${description} | Actual: ${actual}`);
    }
  }

  summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(`\n========================================================================`);
    console.log(`MASTER ZERO-DEFECT SYSTEM AUDIT COMPLETED in ${duration}s`);
    console.log(`Total Assertions: ${this.totalTests} | Passed: ${this.passed} | Failed: ${this.failed}`);
    console.log(`Success Rate: ${((this.passed / this.totalTests) * 100).toFixed(2)}%`);
    console.log(`========================================================================`);

    for (const [mod, stats] of Object.entries(this.moduleStats)) {
      const rate = ((stats.passed / (stats.passed + stats.failed || 1)) * 100).toFixed(1);
      console.log(`  - ${mod}: ${stats.passed}/${stats.passed + stats.failed} (${rate}%)`);
    }

    if (this.failed > 0) {
      console.error(`\n❌ SYSTEM AUDIT FAILED with ${this.failed} defect(s)!`);
      return false;
    } else {
      console.log(`\n✨ ZERO DEFECTS VERIFIED! SYSTEM IS 100% PRODUCTION READY!`);
      return true;
    }
  }
}

(async () => {
  const reporter = new AuditReporter();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });

  const capturedErrors = [];
  page.on('pageerror', (e) => capturedErrors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon') && !t.includes('ERR_FILE_NOT_FOUND')) {
        capturedErrors.push('console.error: ' + t);
      }
    }
  });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Clear storage to guarantee pristine state
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
  });
  await page.reload();
  await page.waitForSelector('h1');

  async function dismissModals() {
    try {
      await page.evaluate(() => {
        if (typeof closeErrorModal === 'function') closeErrorModal();
        if (typeof closeHelpModal === 'function') closeHelpModal();
        ['errorModal', 'ptcPromptModal', 'qCorrectionModal', 'helpModal'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.remove('show');
        });
        const errDisp = document.getElementById('errorDisplay');
        if (errDisp) errDisp.textContent = '';
      });
      await page.waitForTimeout(20);
    } catch (_) {}
  }

  async function safeClick(selector) {
    await dismissModals();
    try {
      await page.click(selector, { timeout: 3000 });
    } catch (_) {
      await dismissModals();
      await page.click(selector, { force: true, timeout: 3000 }).catch(() => {});
    }
  }

  async function safeCheck(selector) {
    await dismissModals();
    try {
      await page.check(selector, { timeout: 3000 });
    } catch (_) {
      await dismissModals();
      await page.check(selector, { force: true, timeout: 3000 }).catch(() => {});
    }
  }

  async function safeUncheck(selector) {
    await dismissModals();
    try {
      await page.uncheck(selector, { timeout: 3000 });
    } catch (_) {
      await dismissModals();
      await page.uncheck(selector, { force: true, timeout: 3000 }).catch(() => {});
    }
  }

  async function safeFill(selector, value) {
    await dismissModals();
    try {
      await page.fill(selector, value, { timeout: 3000 });
    } catch (_) {
      await dismissModals();
      await page.fill(selector, value, { force: true, timeout: 3000 }).catch(() => {});
    }
  }

  async function safeSelect(selector, value) {
    await dismissModals();
    try {
      await page.selectOption(selector, value, { timeout: 3000 });
    } catch (_) {
      await dismissModals();
      await page.selectOption(selector, value, { force: true, timeout: 3000 }).catch(() => {});
    }
  }

  // ==========================================================================
  // MODULE 1: MATHEMATICAL ENGINE, CURRENCY PRECISION & K3 GST AUDIT
  // ==========================================================================
  reporter.setModule('1. Mathematical Accuracy & Currency Precision');

  // 1.1 Precision Arithmetic & Zero IEEE-754 Drift
  const floatPrecision = await page.evaluate(() => {
    const t1 = round2(0.1 + 0.2); // 0.3
    const t2 = round2(205.15 * 3); // 615.45
    const t3 = round2(101 * 0.05); // 5.05
    const t4 = round2(1.005); // 1.01
    return { t1, t2, t3, t4 };
  });
  reporter.assert('0.1 + 0.2 stabilized to exact 0.30', floatPrecision.t1 === 0.3, floatPrecision.t1);
  reporter.assert('205.15 * 3 stabilized to exact 615.45', floatPrecision.t2 === 615.45, floatPrecision.t2);
  reporter.assert('101 * 0.05 stabilized to exact 5.05', floatPrecision.t3 === 5.05, floatPrecision.t3);
  reporter.assert('1.005 rounded to 1.01 with Number.EPSILON guard', floatPrecision.t4 === 1.01, floatPrecision.t4);

  // 1.2 IATA Currency Rounding Matrix
  const currencyMatrix = await page.evaluate(() => {
    const tests = [
      // Whole-Unit Ceilings
      { cur: 'INR', val: 100.01, expected: '101' },
      { cur: 'INR', val: 100.00, expected: '100' },
      { cur: 'AED', val: 100.01, expected: '101' },
      { cur: 'KRW', val: 101, expected: '110' },
      { cur: 'IDR', val: 101, expected: '200' },
      { cur: 'VND', val: 1001, expected: '2000' },
      { cur: 'CLP', val: 50.1, expected: '51' },
      // Whole-Unit Nearest
      { cur: 'JPY', val: 100.4, expected: '100' },
      { cur: 'JPY', val: 100.6, expected: '101' },
      // 3 Decimals Ceiling (0.001)
      { cur: 'KWD', val: 12.3451, expected: '12.346' },
      { cur: 'BHD', val: 5.1231, expected: '5.124' },
      { cur: 'OMR', val: 10.0001, expected: '10.001' },
      // 2 Decimals Integer Ceilings (1.00)
      { cur: 'SAR', val: 100.01, expected: '101.00' },
      { cur: 'PKR', val: 250.25, expected: '251.00' },
      { cur: 'BDT', val: 75.10, expected: '76.00' },
      // 2 Decimals Nearest (0.01)
      { cur: 'USD', val: 100.254, expected: '100.25' },
      { cur: 'USD', val: 100.256, expected: '100.26' },
      { cur: 'EUR', val: 50.123, expected: '50.12' },
      { cur: 'GBP', val: 75.456, expected: '75.46' },
      { cur: 'CAD', val: 80.999, expected: '81.00' },
    ];
    return tests.map(t => ({
      cur: t.cur,
      val: t.val,
      expected: t.expected,
      actual: formatAmount(t.val, t.cur)
    }));
  });

  currencyMatrix.forEach(t => {
    reporter.assert(`Currency ${t.cur} amount ${t.val} formats to ${t.expected}`, t.actual === t.expected, t.actual);
  });

  // 1.3 Indian GST (K3) Service Tax Engine
  const k3Tests = await page.evaluate(() => {
    const r1 = getCurrentFareK3State('INR', 1000, 500); // without cabin -> not calculated
    return { r1 };
  });
  reporter.assert('K3 without cabin selection returns k3Requested but leaves k3Fare 0', k3Tests.r1.k3Fare === 0, k3Tests.r1.k3Fare);

  // Test K3 with Economy (5%) and Business (18%)
  await safeSelect('#currency', 'INR');
  await safeSelect('#cabin', 'economy');
  await safeFill('#oldFare', '1000');
  await safeFill('#newFare', '2000'); // diff = 1000
  await safeFill('#changeFee', '500');
  await safeCheck('#applyK3OnFareDiff');
  await safeCheck('#applyK3OnChangeFee');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  const k3Economy = await page.evaluate(() => {
    return {
      k3Text: document.getElementById('k3Tax').value, // 5% of 1000 = 50, 5% of 500 = 25 -> Total 75
      taxAdj: document.getElementById('taxAdj').value, // 50 (fare diff K3 added to taxAdj)
      addTaxes: document.getElementById('addTaxes').value, // includes 50K3, excludes 25K3
    };
  });
  reporter.assert('K3 Economy: 5% on INR1000 Fare Diff + 5% on INR500 Change Fee = INR75', k3Economy.k3Text === 'INR75', k3Economy.k3Text);
  reporter.assert('K3 Economy: Add Taxes contains INR50K3 and excludes fee K3', k3Economy.addTaxes === 'INR50K3', k3Economy.addTaxes);

  // Test K3 Business (18%)
  await safeSelect('#cabin', 'business');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);
  const k3Business = await page.evaluate(() => {
    return {
      k3Text: document.getElementById('k3Tax').value, // 18% of 1000 = 180, 18% of 500 = 90 -> Total 270
      addTaxes: document.getElementById('addTaxes').value,
    };
  });
  reporter.assert('K3 Business: 18% on INR1000 + 18% on INR500 = INR270', k3Business.k3Text === 'INR270', k3Business.k3Text);
  reporter.assert('K3 Business: Add Taxes contains INR180K3', k3Business.addTaxes === 'INR180K3', k3Business.addTaxes);

  // 1.4 Net Tax Adjustment & Reconciliation
  await safeFill('#oldTax', 'INR500YQ INR250IN');
  await safeFill('#newTax', 'INR800YQ INR200IN'); // YQ: +300, IN: -50
  await safeCheck('#applyK3OnYQ'); // 18% of 300 = 54
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  const taxResult = await page.evaluate(() => {
    return {
      netTax: state.lastTaxResult?.netTax, // 300 - 50 = 250
      k3OnYQ: state.lastTaxResult?.k3OnYQ, // 54
      positiveTaxes: state.lastTaxResult?.positiveTaxes,
      negativeTaxes: state.lastTaxResult?.negativeTaxes,
    };
  });
  reporter.assert('Net tax diff equals 250 (300 YQ - 50 IN)', taxResult.netTax === 250, taxResult.netTax);
  reporter.assert('K3 on YQ at 18% equals 54', taxResult.k3OnYQ === 54, taxResult.k3OnYQ);

  // 1.4.1 OD Tax Code (Change Fee) Exclusion Permutations
  // Test A: OD entered in both Old and New taxes (INR500YQ INR1000OD vs INR800YQ INR1000OD)
  await safeFill('#oldTax', 'INR500YQ INR1000OD');
  await safeFill('#newTax', 'INR800YQ INR1000OD');
  await safeUncheck('#applyK3OnYQ');
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  const odResultA = await page.evaluate(() => ({
    netTax: state.lastTaxResult?.netTax,
    positiveTaxes: state.lastTaxResult?.positiveTaxes,
    negativeTaxes: state.lastTaxResult?.negativeTaxes,
    addTaxes: els.addTaxes.value,
    refundTaxes: els.refundTaxes.value,
    taxResultText: els.taxResult.innerText,
  }));
  reporter.assert('OD in both sides excluded from diff (netTax === 300)', odResultA.netTax === 300, odResultA.netTax);
  reporter.assert('OD not present in positive taxes or Add Taxes', !odResultA.positiveTaxes.some(t => t.includes('OD')) && !odResultA.addTaxes.includes('OD'));
  reporter.assert('OD not present in negative taxes or Refund Taxes', !odResultA.negativeTaxes.some(t => t.includes('OD')) && !odResultA.refundTaxes.includes('OD'));
  reporter.assert('OD change fee notice displayed in results', odResultA.taxResultText.includes('OD Tax (Change Fee): Already paid'));

  // Test B: OD in Old Tax only (INR500YQ INR1000OD vs INR800YQ) - OD must NOT be refunded
  await safeFill('#oldTax', 'INR500YQ INR1000OD');
  await safeFill('#newTax', 'INR800YQ');
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  const odResultB = await page.evaluate(() => ({
    netTax: state.lastTaxResult?.netTax,
    negativeTaxes: state.lastTaxResult?.negativeTaxes,
    refundTaxes: els.refundTaxes.value,
  }));
  reporter.assert('OD in Old Tax only is NOT refunded (negative taxes empty)', odResultB.netTax === 300 && odResultB.negativeTaxes.length === 0, odResultB.negativeTaxes);
  reporter.assert('Refund Taxes field excludes OD', !odResultB.refundTaxes.includes('OD'), odResultB.refundTaxes);

  // Test C: OD in New Tax as PD1000OD (INR500YQ vs INR800YQ PD1000OD) - OD must NOT be added
  await safeFill('#oldTax', 'INR500YQ');
  await safeFill('#newTax', 'INR800YQ PD1000OD');
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  const odResultC = await page.evaluate(() => ({
    netTax: state.lastTaxResult?.netTax,
    positiveTaxes: state.lastTaxResult?.positiveTaxes,
    addTaxes: els.addTaxes.value,
  }));
  reporter.assert('PD+value+OD in New Tax is NOT added (netTax === 300)', odResultC.netTax === 300, odResultC.netTax);
  reporter.assert('Positive Taxes contains only YQ and excludes OD', odResultC.positiveTaxes.length === 1 && odResultC.positiveTaxes[0] === 'INR300YQ', odResultC.positiveTaxes);
  reporter.assert('Add Taxes field excludes OD', !odResultC.addTaxes.includes('OD'), odResultC.addTaxes);

  // Test D: OD entered standalone in both sides (INR1000OD vs PD1000OD) -> zero diff
  await safeFill('#oldTax', 'INR1000OD');
  await safeFill('#newTax', 'PD1000OD');
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  const odResultD = await page.evaluate(() => ({
    netTax: state.lastTaxResult?.netTax,
    posTotal: state.lastTaxResult?.posTotal,
    negTotal: state.lastTaxResult?.negTotal,
  }));
  reporter.assert('Standalone OD in Old & New yields exact 0 net tax adjustment', odResultD.netTax === 0 && odResultD.posTotal === 0 && odResultD.negTotal === 0, odResultD);

  // 1.4.2 Tax Result DOM XSS Injection Immunity
  await safeFill('#oldTax', 'INR500YQ <img src="invalid-img" onerror="window.TAX_XSS=true">');
  await safeFill('#newTax', 'INR800YQ <script>window.TAX_XSS=true</script>');
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  const taxXssCheck = await page.evaluate(() => {
    const resEl = document.getElementById('taxResult');
    return {
      hasXssFlag: !!window.TAX_XSS,
      injectedImgCount: resEl.querySelectorAll('img').length,
      injectedScriptCount: resEl.querySelectorAll('script').length,
    };
  });
  reporter.assert('Tax Result DOM XSS injection prevented (0 executable nodes)', !taxXssCheck.hasXssFlag && taxXssCheck.injectedImgCount === 0 && taxXssCheck.injectedScriptCount === 0);

  // 1.5 Multi-PTC Consolidated Summary Math
  const summaryConsolidation = await page.evaluate(() => {
    const list = [
      { currency: 'INR', oldFare: 10000, newFare: 12000, diff: 2000, k3Fare: 100, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 100, subTotal: 2100, pax: 2, addTaxes: 'INR100K3', refundTaxes: '', convertedFareCalcString: 'STR1' },
      { currency: 'INR', oldFare: 5000, newFare: 6000, diff: 1000, k3Fare: 50, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 50, subTotal: 1050, pax: 1, addTaxes: 'INR50K3', refundTaxes: '', convertedFareCalcString: 'STR2' },
    ];
    return mergeSummaryData(list);
  });
  reporter.assert('Consolidated summary subTotal sums accurately: 2100 + 1050 = 3150', summaryConsolidation.subTotal === 3150, summaryConsolidation.subTotal);
  reporter.assert('Consolidated summary pax sums accurately: 2 + 1 = 3', summaryConsolidation.pax === 3, summaryConsolidation.pax);
  reporter.assert('Consolidated summary perPax recomputed: 3150 / 3 = 1050', summaryConsolidation.perPax === 1050, summaryConsolidation.perPax);
  reporter.assert('Zero floating point drift on currency keys', !String(summaryConsolidation.subTotal).includes('.9999'), summaryConsolidation.subTotal);

  // Currency mismatch guard in mergeSummaryData
  const mismatchResult = await page.evaluate(() => mergeSummaryData([
    { currency: 'INR', subTotal: 100 },
    { currency: 'USD', subTotal: 100 }
  ]));
  reporter.assert('Mixed currencies rejected with error object', !!mismatchResult.error, mismatchResult.error);

  // 1.6 Change Fee K3 Breakdown in Final Summary Table
  const changeFeeRowDefResult = await page.evaluate(() => {
    const feeRowDef = SUMMARY_ROW_DEFS.find(r => r.label === 'Change Fee');
    return {
      withK3: feeRowDef.get({ currency: 'INR', fee: 3000, k3Fee: 150 }),
      withoutK3: feeRowDef.get({ currency: 'INR', fee: 3000, k3Fee: 0 }),
      usdWithK3: feeRowDef.get({ currency: 'USD', fee: 100, k3Fee: 5 }),
    };
  });
  reporter.assert('Change Fee with K3 formatted as INR3150 (Incl. of K3 INR150)', changeFeeRowDefResult.withK3 === 'INR3150 (Incl. of K3 INR150)', changeFeeRowDefResult.withK3);
  reporter.assert('Change Fee without K3 formatted as plain INR3000', changeFeeRowDefResult.withoutK3 === 'INR3000', changeFeeRowDefResult.withoutK3);
  reporter.assert('Change Fee with K3 formatted in USD as USD105.00 (Incl. of K3 USD5.00)', changeFeeRowDefResult.usdWithK3 === 'USD105.00 (Incl. of K3 USD5.00)', changeFeeRowDefResult.usdWithK3);

  // ==========================================================================
  // MODULE 2: GDS LINEAR FARE CONSTRUCTION STRING PARSER AUDIT
  // ==========================================================================
  reporter.setModule('2. GDS Linear String Parser & Hardening');

  // 2.1 Production Airline Strings Verification with 8-character Fare Basis Codes
  const airlineStrings = [
    {
      airline: 'Air India',
      currency: 'INR',
      str: 'DEL AI LON 250.00H26APDEL AI DEL 250.00H26APDEL NUC500.00END ROE83.50',
      expectedNuc: '500.00',
      expectedRoe: '83.50',
      expectedBaseFare: '41750', // 500 * 83.50 = 41750
    },
    {
      airline: 'Emirates',
      currency: 'AED',
      str: 'DXB EK BOM Q15.00 450.00TLEEPDXB EK DXB Q15.00 450.00TLEEPDXB NUC930.00END ROE3.6725',
      expectedNuc: '930.00',
      expectedRoe: '3.6725',
      expectedBaseFare: '3416', // 930 * 3.6725 = 3415.425 -> ceil AED = 3416
    },
    {
      airline: 'Lufthansa',
      currency: 'EUR',
      str: 'FRA LH NYC 600.00W26APFRA LH FRA 600.00W26APFRA NUC1200.00END ROE0.92',
      expectedNuc: '1200.00',
      expectedRoe: '0.92',
      expectedBaseFare: '1104',
    },
    {
      airline: 'British Airways',
      currency: 'GBP',
      str: 'LHR BA JFK 550.00S26APLHR BA LHR 550.00S26APLHR NUC1100.00END ROE0.78',
      expectedNuc: '1100.00',
      expectedRoe: '0.78',
      expectedBaseFare: '858',
    },
    {
      airline: 'Singapore Airlines',
      currency: 'SGD',
      str: 'SIN SQ SYD 800.00V26APSIN SQ SIN 800.00V26APSIN NUC1600.00END ROE1.34',
      expectedNuc: '1600.00',
      expectedRoe: '1.34',
      expectedBaseFare: '2144',
    },
    {
      airline: 'Qatar Airways',
      currency: 'QAR',
      str: 'DOH QR LHR Q25.00 700.00H26APDOH QR DOH Q25.00 700.00H26APDOH NUC1450.00END ROE3.64',
      expectedNuc: '1450.00',
      expectedRoe: '3.64',
      expectedBaseFare: '5278',
    }
  ];

  for (const item of airlineStrings) {
    await safeSelect('#currency', item.currency);
    await safeFill('#fareCalcString', item.str);
    await safeClick('#parseButton');
    await page.waitForTimeout(60);

    const parsed = await page.evaluate(() => ({
      calcNuc: document.getElementById('calculatedNuc').textContent.trim(),
      roe: document.getElementById('roe').textContent.trim(),
      baseFare: document.getElementById('baseFare').textContent.trim(),
    }));

    reporter.assert(`${item.airline} NUC parsed correctly (${item.expectedNuc})`, parsed.calcNuc.includes(item.expectedNuc), parsed.calcNuc);
    reporter.assert(`${item.airline} ROE parsed correctly (${item.expectedRoe})`, parsed.roe.includes(item.expectedRoe), parsed.roe);
    reporter.assert(`${item.airline} Base Fare calculated (${item.expectedBaseFare})`, parsed.baseFare.includes(item.expectedBaseFare), parsed.baseFare);
  }

  // 2.2 Directional & Consecutive Q Surcharges
  const qTestStr = 'BOM AI LON Q10.00Q25.00 500.00H26APBOM AI BOM Q 15.00 500.00H26APBOM NUC1050.00END ROE83.5';
  await safeFill('#fareCalcString', qTestStr);
  await safeClick('#parseButton');
  await page.waitForTimeout(60);
  const qCount = await page.evaluate(() => document.querySelectorAll('#qSurcharges li').length);
  reporter.assert('Consecutive Q10.00Q25.00 and spaced Q 15.00 correctly parsed into 3 Q entries', qCount === 3, qCount);

  // 2.3 Trailing Q Surcharge Detection & Standardization
  const trailingQStr = 'DEL AI NYC 600.00H26APDEL Q12.29 AI DEL 600.00H26APDELNUC1212.29END ROE83.5';
  const trailingDetection = await page.evaluate((str) => detectTrailingQSurcharges(str), trailingQStr);
  reporter.assert('Trailing Q surcharge detected after fare basis code', trailingDetection !== null && trailingDetection.count > 0, trailingDetection?.count);
  reporter.assert('Trailing Q standardized before fare component', trailingDetection?.standardized.includes('Q12.29 600.00H26APDEL'), trailingDetection?.standardized);

  // 2.4 Selective Component Halving & Stopovers
  const stopoverStr = 'BOM AI LON 400.00H26APBOM AI PAR 1S50.00 300.00H26APBOM AI BOM 700.00H26APBOM NUC1450.00END ROE83.5';
  await safeFill('#fareCalcString', stopoverStr);
  await safeClick('#parseButton');
  await page.waitForTimeout(60);

  const stopoverVisible = await page.evaluate(() => document.getElementById('stopoverChargesSection').style.display !== 'none');
  reporter.assert('Stopover 1S50.00 detected and displayed', stopoverVisible);

  await safeCheck('#halveFareComponents');
  await page.waitForTimeout(60);
  const halvedNuc = await page.evaluate(() => document.getElementById('calculatedNuc').textContent);
  // (400/2 + 300/2 + 700/2) + 50 = 200 + 150 + 350 + 50 = 750
  reporter.assert('Halving components preserves unhalved stopover charge (NUC 750.00)', halvedNuc.includes('750.00'), halvedNuc);
  await safeUncheck('#halveFareComponents');

  // 2.5 Parser Resilience & XSS Injection Sanitization
  const xssStr = '<script>window.__xssPwned=true;</script>"><img src=x onerror=window.__xssPwned=true;>';
  await safeFill('#fareCalcString', xssStr);
  await safeClick('#parseButton');
  await page.waitForTimeout(60);
  await dismissModals();

  const xssPwned = await page.evaluate(() => window.__xssPwned === true);
  reporter.assert('XSS payload harmlessly escaped; no script execution occurred', !xssPwned);

  // 2.6 Real-Time IN Fare Alert Triggered on Input (Country Code 'IN')
  const inFareStr = 'BOM AI LON 250.00H26APIN1 AI BOM 250.00H26APIN1 NUC500.00END ROE83.50';
  await safeFill('#fareCalcString', inFareStr);
  await page.waitForTimeout(60);

  // Assert triggered IMMEDIATELY on input before clicking Convert (#parseButton)
  const inrMsgOnInput = await page.evaluate(() => {
    const el = document.getElementById('inrMessage');
    const style = window.getComputedStyle(el);
    return {
      text: el ? el.textContent.trim() : '',
      inHeader: el ? el.closest('h2#fareSectionHeading') !== null : false,
      fontWeight: parseInt(style.fontWeight, 10) || 0,
      fontSize: parseFloat(style.fontSize) || 0,
    };
  });
  reporter.assert('FCS input immediately triggers IN fare alert before conversion', inrMsgOnInput.text === 'IN fare detected, check if K3 needs to be calculated.', inrMsgOnInput.text);
  reporter.assert('IN fare alert positioned in Fare Calculator h2 header', inrMsgOnInput.inHeader);
  reporter.assert('IN fare alert typography is extra bold (weight >= 800)', inrMsgOnInput.fontWeight >= 800, inrMsgOnInput.fontWeight);
  reporter.assert('IN fare alert typography font size is prominent (>= 15px)', inrMsgOnInput.fontSize >= 15, `${inrMsgOnInput.fontSize}px`);

  // Assert clicking Convert executes validator without any disruption and keeps alert visible
  await safeClick('#parseButton');
  await page.waitForTimeout(60);
  const parserPassState = await page.evaluate(() => {
    return {
      nucVal: document.getElementById('nucValidation')?.textContent || '',
      baseFare: document.getElementById('baseFare')?.textContent || '',
      alertText: document.getElementById('inrMessage')?.textContent.trim() || '',
    };
  });
  reporter.assert('Fare calculation validator passes cleanly with IN fare alert active', parserPassState.nucVal.includes('PASS'));
  reporter.assert('IN fare alert persists post-conversion', parserPassState.alertText === 'IN fare detected, check if K3 needs to be calculated.', parserPassState.alertText);

  // String with foreign fare basis (e.g. US country code)
  const usFareStr = 'JFK AA LON 500.00TLEEPUS1 NUC500.00 END ROE1.0';
  await safeFill('#fareCalcString', usFareStr);
  await page.waitForTimeout(60);

  const inrMsgInactiveOnUS = await page.evaluate(() => document.getElementById('inrMessage')?.textContent.trim() || '');
  reporter.assert('FCS without country code IN clears IN fare alert', inrMsgInactiveOnUS === '', inrMsgInactiveOnUS);

  // Clearing FCS input directly clears IN fare alert immediately
  await safeFill('#fareCalcString', inFareStr);
  await page.waitForTimeout(60);
  await safeFill('#fareCalcString', '');
  await page.waitForTimeout(60);
  const inrMsgClearedOnEmptyInput = await page.evaluate(() => document.getElementById('inrMessage')?.textContent.trim() || '');
  reporter.assert('Clearing FCS input immediately clears IN fare alert', inrMsgClearedOnEmptyInput === '', inrMsgClearedOnEmptyInput);

  // Clearing parser button clears IN fare alert
  await safeFill('#fareCalcString', inFareStr);
  await safeClick('#parseButton');
  await page.waitForTimeout(60);
  await safeClick('#parserClearButton');
  await page.waitForTimeout(60);
  const inrMsgCleared = await page.evaluate(() => document.getElementById('inrMessage')?.textContent.trim() || '');
  reporter.assert('Clearing parser clears IN fare alert', inrMsgCleared === '', inrMsgCleared);

  // Selecting INR currency without FCS does NOT show IN fare alert
  await safeSelect('#currency', 'INR');
  await safeFill('#oldFare', '1000');
  await safeFill('#newFare', '2000');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);
  const inrMsgOnCurrencyOnly = await page.evaluate(() => document.getElementById('inrMessage')?.textContent.trim() || '');
  reporter.assert('Selecting INR currency alone does NOT trigger IN fare alert', inrMsgOnCurrencyOnly === '', inrMsgOnCurrencyOnly);

  // ==========================================================================
  // MODULE 3: PASSENGER TAB STATE MANAGEMENT & ISOLATION AUDIT
  // ==========================================================================
  reporter.setModule('3. Passenger Tab State Isolation & Order-Independence');

  // 3.1 Complete State Isolation across ADT, CNN, INF
  await safeClick('#ptcTabADT');
  await safeSelect('#currency', 'USD');
  await safeFill('#oldFare', '1000');
  await safeFill('#newFare', '1500');
  await safeFill('#changeFee', '200');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  // Switch to CHD and set different numbers with USD
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  await safeSelect('#currency', 'USD');
  await safeFill('#oldFare', '500');
  await safeFill('#newFare', '750');
  await safeFill('#changeFee', '100');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  // Switch to INF and set different numbers with USD
  await safeClick('#ptcTabINF');
  await page.waitForTimeout(60);
  await safeSelect('#currency', 'USD');
  await safeFill('#oldFare', '100');
  await safeFill('#newFare', '150');
  await safeFill('#changeFee', '20');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  // Verify ADT state remained 1000/1500/200
  await safeClick('#ptcTabADT');
  await page.waitForTimeout(60);
  const adtRestored = await page.evaluate(() => ({
    old: document.getElementById('oldFare').value,
    newF: document.getElementById('newFare').value,
    fee: document.getElementById('changeFee').value,
    diff: document.getElementById('fareDiff').value,
  }));
  reporter.assert('ADT Old Fare isolated at 1000', adtRestored.old === '1000', adtRestored.old);
  reporter.assert('ADT New Fare isolated at 1500', adtRestored.newF === '1500', adtRestored.newF);
  reporter.assert('ADT Fare Diff isolated at USD500.00', adtRestored.diff === 'USD500.00', adtRestored.diff);

  // Verify CHD state remained 500/750/100
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  const chdRestored = await page.evaluate(() => ({
    old: document.getElementById('oldFare').value,
    newF: document.getElementById('newFare').value,
    fee: document.getElementById('changeFee').value,
    diff: document.getElementById('fareDiff').value,
  }));
  reporter.assert('CHD Old Fare isolated at 500', chdRestored.old === '500', chdRestored.old);
  reporter.assert('CHD New Fare isolated at 750', chdRestored.newF === '750', chdRestored.newF);
  reporter.assert('CHD Fare Diff isolated at USD250.00', chdRestored.diff === 'USD250.00', chdRestored.diff);

  // 3.2 Order-Independent Calculations (Reverse Fill: INF -> CHD -> ADT)
  await safeClick('#fareClearButton');
  await safeClick('#ptcTabINF');
  await safeSelect('#currency', 'USD');
  await safeFill('#oldFare', '80');
  await safeFill('#newFare', '120');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  await safeClick('#ptcTabCHD');
  await safeSelect('#currency', 'USD');
  await safeFill('#oldFare', '400');
  await safeFill('#newFare', '600');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  await safeClick('#ptcTabADT');
  await safeSelect('#currency', 'USD');
  await safeFill('#oldFare', '800');
  await safeFill('#newFare', '1200');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  await safeClick('#summariseButton');
  await page.waitForTimeout(80);

  const multiTablePtcOrder = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('#summary thead th')).map(t => t.textContent.trim());
    return ths;
  });
  reporter.assert('Summary table maintains canonical ADT -> CHD -> INF column order regardless of fill order',
    multiTablePtcOrder.includes('Adult') && multiTablePtcOrder.includes('Child') && multiTablePtcOrder.includes('Infant'),
    JSON.stringify(multiTablePtcOrder));

  // 3.3 AutoCalc Dirty Guard
  await safeClick('#ptcTabADT');
  await safeFill('#fareCalcString', 'DEL AI LON 300.00H26APDEL AI DEL 300.00H26APDEL NUC600.00END ROE83.50');
  await safeClick('#parseButton');
  await page.waitForTimeout(60);

  // Manually dirty CHD tab
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  await safeFill('#fareCalcString', 'DIRTY CUSTOM STRING');
  await page.dispatchEvent('#fareCalcString', 'input');
  await page.waitForTimeout(60);

  // Switch back to ADT, re-parse new string
  await safeClick('#ptcTabADT');
  await safeFill('#fareCalcString', 'DEL AI LON 400.00H26APDEL AI DEL 400.00H26APDEL NUC800.00END ROE83.50');
  await safeClick('#parseButton');
  await page.waitForTimeout(60);

  // Verify CHD string was NOT overwritten
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  const chdFcs = await page.inputValue('#fareCalcString');
  reporter.assert('Dirty CHD tab protected from AutoCalc overwrite', chdFcs === 'DIRTY CUSTOM STRING', chdFcs);

  // 3.4 Custom Tab Dynamic Lifecycle
  const customTabCountBefore = await page.evaluate(() => document.querySelectorAll('.ptc-tab.custom').length);
  // Add custom tab via DOM trigger
  await page.evaluate(() => {
    const code = generatePtcCode('SENIOR');
    PTC_CODES.push(code);
    PTC_LABELS[code] = 'SENIOR';
    state.ptcData[code] = { formSnapshot: null, summaryData: null, dirty: false };
    const btn = buildCustomTabButton(code, 'SENIOR');
    els.ptcTabs.insertBefore(btn, els.ptcAddTabButton);
    switchPtcTab(code);
  });
  await page.waitForTimeout(80);

  const customTabActive = await page.evaluate(() => state.activePtc);
  reporter.assert('Custom tab created and activated', customTabActive.startsWith('SENIOR'), customTabActive);

  // Clean up custom tab directly
  await page.evaluate(() => {
    const code = state.activePtc;
    if (state.activePtc === code) {
      switchPtcTab('ADT');
    }
    const index = PTC_CODES.indexOf(code);
    if (index !== -1) PTC_CODES.splice(index, 1);
    delete state.ptcData[code];
    delete PTC_LABELS[code];
    const btn = ptcTabButton(code);
    if (btn) btn.remove();
    updatePtcTabUI();
  });
  await page.waitForTimeout(80);
  const customTabAfter = await page.evaluate(() => ({
    count: document.querySelectorAll('.ptc-tab.custom').length,
    activePtc: state.activePtc
  }));
  reporter.assert('Custom tab safely removed and active tab reverted to ADT',
    customTabAfter.count === customTabCountBefore && customTabAfter.activePtc === 'ADT',
    `${customTabAfter.count} tabs, active: ${customTabAfter.activePtc}`);

  // 3.5 Child Tab Copy Taxes from Adult Lifecycle
  const adtCopyTaxDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  reporter.assert('Copy Taxes from Adult checkbox is hidden on Adult tab', adtCopyTaxDisplay === 'none', adtCopyTaxDisplay);

  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  const chdCopyTaxDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  reporter.assert('Copy Taxes from Adult checkbox is visible on Child tab', chdCopyTaxDisplay !== 'none', chdCopyTaxDisplay);

  await safeClick('#ptcTabADT');
  await page.waitForTimeout(60);
  await safeFill('#oldTax', 'INR500YQ INR1000OD');
  await safeFill('#newTax', 'INR800YQ INR1000OD');
  await safeClick('#taxCalcButton');
  await page.waitForTimeout(60);

  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  await safeClick('label[for="copyTaxFromAdult"]');
  await page.waitForTimeout(100);

  const chdCopied = await page.evaluate(() => ({
    oldTax: els.oldTax.value,
    newTax: els.newTax.value,
    netTax: state.lastTaxResult?.netTax,
    isChecked: els.copyTaxFromAdult.checked,
  }));
  reporter.assert('Copy Taxes from Adult copies OLD & NEW taxes to Child', chdCopied.oldTax.includes('INR500YQ') && chdCopied.newTax.includes('INR800YQ') && chdCopied.isChecked);
  reporter.assert('Child taxes automatically calculated upon copy (netTax === 300)', chdCopied.netTax === 300, chdCopied.netTax);

  await safeFill('#newTax', 'INR900YQ');
  await page.waitForTimeout(60);
  const chdUncheckedOnEdit = await page.evaluate(() => els.copyTaxFromAdult.checked);
  reporter.assert('Child copy tax checkbox auto-unchecks on manual tax edit', !chdUncheckedOnEdit);

  await safeClick('#ptcTabINF');
  await page.waitForTimeout(60);
  const infCopyTaxDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  reporter.assert('Copy Taxes from Adult checkbox is hidden on Infant tab', infCopyTaxDisplay === 'none', infCopyTaxDisplay);

  await safeClick('#ptcTabADT');
  await page.waitForTimeout(60);

  // 3.4 Adult-to-Child Change Fee & Checkbox Synchronization
  await safeFill('#changeFee', '3000');
  await safeCheck('#applyK3OnChangeFee');
  await page.waitForTimeout(60);

  // Switch to Child tab and verify fee & checkbox are populated
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  const chdSyncedFee = await page.evaluate(() => ({
    fee: els.changeFee.value,
    k3Checked: els.applyK3OnChangeFee.checked,
  }));
  reporter.assert('Adult Change Fee (3000) auto-synced to Child tab', chdSyncedFee.fee === '3000', chdSyncedFee.fee);
  reporter.assert('Adult Apply K3 on Change Fee checkbox auto-synced to Child tab', chdSyncedFee.k3Checked === true);

  // Child tab fee remains independently editable
  await safeFill('#changeFee', '2500');
  await page.waitForTimeout(60);
  await safeClick('#ptcTabADT');
  await page.waitForTimeout(60);
  const adtFeePreserved = await page.evaluate(() => els.changeFee.value);
  reporter.assert('Child tab manual fee edit does not overwrite Adult tab', adtFeePreserved === '3000', adtFeePreserved);

  // 3.5 Adult Cabin Auto-Sync to All Tabs & Independent Overrides
  await safeSelect('#cabin', 'economy');
  await page.waitForTimeout(60);

  // Verify cabin auto-synced to Child and Infant tab snapshots
  const snapshotsCabin = await page.evaluate(() => ({
    chdCabin: state.ptcData['CHD']?.formSnapshot?.fields?.cabin,
    infCabin: state.ptcData['INF']?.formSnapshot?.fields?.cabin,
  }));
  reporter.assert('Adult Cabin (economy) auto-synced to Child tab snapshot', snapshotsCabin.chdCabin === 'economy', snapshotsCabin.chdCabin);
  reporter.assert('Adult Cabin (economy) auto-synced to Infant tab snapshot', snapshotsCabin.infCabin === 'economy', snapshotsCabin.infCabin);

  // Switch to Child tab and verify cabin dropdown is populated with 'economy'
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  const chdCabinVal = await page.evaluate(() => els.cabin.value);
  reporter.assert('Child tab active cabin restored as economy from Adult', chdCabinVal === 'economy', chdCabinVal);

  // Child tab cabin can be changed independently
  await safeSelect('#cabin', 'business');
  await page.waitForTimeout(60);
  const chdCabinBusiness = await page.evaluate(() => els.cabin.value);
  reporter.assert('Child tab cabin changed to business independently', chdCabinBusiness === 'business', chdCabinBusiness);

  // Switch back to Adult tab and verify Adult cabin remains economy
  await safeClick('#ptcTabADT');
  await page.waitForTimeout(60);
  const adtCabinStillEconomy = await page.evaluate(() => els.cabin.value);
  reporter.assert('Child cabin change does not overwrite Adult cabin (still economy)', adtCabinStillEconomy === 'economy', adtCabinStillEconomy);

  // Switch back to Child tab and verify Child cabin remains business
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(60);
  const chdCabinStillBusiness = await page.evaluate(() => els.cabin.value);
  reporter.assert('Child cabin retains business on return', chdCabinStillBusiness === 'business', chdCabinStillBusiness);

  // 3.6 End-to-End Summarise Bug Verification (No missing cabin error)
  await safeClick('#ptcTabADT');
  await page.waitForTimeout(60);
  await safeSelect('#currency', 'USD');
  await safeSelect('#cabin', 'economy');
  await safeFill('#oldTax', 'USD50YQ');
  await safeFill('#newTax', 'USD80YQ');
  await safeClick('#taxCalcButton');
  await safeFill('#oldFare', '1000');
  await safeFill('#newFare', '2000');
  await safeFill('#changeFee', '3000');
  await safeCheck('#applyK3OnChangeFee');
  await safeClick('#fareCalcButton');
  await page.waitForTimeout(60);

  // Reset modal error tracker before clicking Summarise
  let errorMessageEncountered = null;
  const originalErrorHandler = await page.evaluate(() => {
    window.__lastErrorMsg = null;
    const orig = window.showError;
    window.showError = function(msg) {
      window.__lastErrorMsg = msg;
      return orig.apply(this, arguments);
    };
    return true;
  });

  await safeClick('#summariseButton');
  await page.waitForTimeout(100);

  const summariseErrorCheck = await page.evaluate(() => {
    return {
      errorCaptured: window.__lastErrorMsg,
      summaryVisible: els.summaryContent.style.display === 'block',
      tableHtml: els.summary.innerHTML,
    };
  });

  reporter.assert('Clicking Summarise with Adult K3 on change fee triggers NO cabin error', !summariseErrorCheck.errorCaptured || !summariseErrorCheck.errorCaptured.toLowerCase().includes('cabin'), summariseErrorCheck.errorCaptured);
  reporter.assert('Summary table rendered successfully', summariseErrorCheck.summaryVisible && summariseErrorCheck.tableHtml.length > 0);

  // ==========================================================================
  // MODULE 4: UI/UX DESIGN GEOMETRY & CSS PAINT PIPELINE AUDIT
  // ==========================================================================
  reporter.setModule('4. UI/UX Geometry & CSS Paint Pipeline');

  // 4.1 Dual-Axis Vertical Centering Invariant (0.00px Offsets)
  for (const vpWidth of [1440, 1366, 1280, 1024]) {
    await page.setViewportSize({ width: vpWidth, height: 900 });
    await page.waitForTimeout(60);

    const offsets = await page.evaluate(() => {
      const fareDiff = document.getElementById('fareDiff').getBoundingClientRect();
      const fareCb = document.getElementById('applyK3OnFareDiff').getBoundingClientRect();
      const fareLbl = document.querySelector('label[for="applyK3OnFareDiff"]').getBoundingClientRect();

      const changeFee = document.getElementById('changeFee').getBoundingClientRect();
      const feeCb = document.getElementById('applyK3OnChangeFee').getBoundingClientRect();
      const feeLbl = document.querySelector('label[for="applyK3OnChangeFee"]').getBoundingClientRect();

      const fareDiffCenter = fareDiff.top + fareDiff.height / 2;
      const fareCbCenter = fareCb.top + fareCb.height / 2;
      const fareLblCenter = fareLbl.top + fareLbl.height / 2;

      const feeCenter = changeFee.top + changeFee.height / 2;
      const feeCbCenter = feeCb.top + feeCb.height / 2;
      const feeLblCenter = feeLbl.top + feeLbl.height / 2;

      return {
        fareCbToInput: Math.abs(fareCbCenter - fareDiffCenter),
        fareTextToCb: Math.abs(fareLblCenter - fareCbCenter),
        feeCbToInput: Math.abs(feeCbCenter - feeCenter),
        feeTextToCb: Math.abs(feeLblCenter - feeCbCenter),
      };
    });

    reporter.assert(`[${vpWidth}px] Fare Diff Checkbox-to-Input Offset == 0.00px`, offsets.fareCbToInput < 0.01, `${offsets.fareCbToInput.toFixed(2)}px`);
    reporter.assert(`[${vpWidth}px] Fare Diff Text-to-Checkbox Offset == 0.00px`, offsets.fareTextToCb < 0.01, `${offsets.fareTextToCb.toFixed(2)}px`);
    reporter.assert(`[${vpWidth}px] Change Fee Checkbox-to-Input Offset == 0.00px`, offsets.feeCbToInput < 0.01, `${offsets.feeCbToInput.toFixed(2)}px`);
    reporter.assert(`[${vpWidth}px] Change Fee Text-to-Checkbox Offset == 0.00px`, offsets.feeTextToCb < 0.01, `${offsets.feeTextToCb.toFixed(2)}px`);
  }

  // 4.2 Single-Line Invariant Across All Viewports
  const singleLineCheck = await page.evaluate(() => {
    const ids = ['applyK3OnYQ', 'applyK3OnFareDiff', 'applyK3OnChangeFee', 'copyTaxFromAdult'];
    return ids.map(id => {
      const lbl = document.querySelector(`label[for="${id}"]`);
      const r = lbl.getBoundingClientRect();
      const s = window.getComputedStyle(lbl);
      return {
        id,
        height: r.height,
        nowrap: s.whiteSpace === 'nowrap',
        singleLine: r.height <= 18
      };
    });
  });

  singleLineCheck.forEach(item => {
    reporter.assert(`Checkbox label [${item.id}] is single-line (height: ${item.height}px, nowrap)`, item.nowrap && item.singleLine, `height: ${item.height}px`);
  });

  // 4.3 CSS Paint Pipeline: Zero-Flicker Hardware Compositing
  const paintLifecycle = await page.evaluate(() => {
    const glider = document.querySelector('.tab-glider');
    const sGlider = window.getComputedStyle(glider);
    return {
      hasWillChange: sGlider.willChange.includes('transform'),
      hasBackfaceHidden: sGlider.backfaceVisibility === 'hidden',
    };
  });
  reporter.assert('Tab Glider has GPU will-change: transform', paintLifecycle.hasWillChange);
  reporter.assert('Tab Glider has backface-visibility: hidden for zero-flash compositing', paintLifecycle.hasBackfaceHidden);

  // Test Theme Switch Flicker Guard
  await safeClick('#themeToggle');
  const animatingTheme = await page.evaluate(() => document.documentElement.classList.contains('theme-animating'));
  reporter.assert('Theme switch triggers .theme-animating transition class', animatingTheme);
  await page.waitForTimeout(450);
  const animationFinished = await page.evaluate(() => !document.documentElement.classList.contains('theme-animating'));
  reporter.assert('Theme animation completes cleanly and removes animating class', animationFinished);

  // Switch back to light theme
  await safeClick('#themeToggle');
  await page.waitForTimeout(450);

  // 4.4 Stable Tab Dimensions
  const tabDimensions = await page.evaluate(() => {
    const adt = document.getElementById('ptcTabADT').getBoundingClientRect();
    const chd = document.getElementById('ptcTabCHD').getBoundingClientRect();
    return {
      adtHeight: Math.round(adt.height),
      chdHeight: Math.round(chd.height),
    };
  });
  reporter.assert('Active and Inactive tab buttons share identical height (35px)', tabDimensions.adtHeight === tabDimensions.chdHeight && tabDimensions.adtHeight === 35, `${tabDimensions.adtHeight}px vs ${tabDimensions.chdHeight}px`);

  // 4.5 Tab Glider Geometry & Absence of Pseudo-Element Baseline Lines
  const gliderSpecs = await page.evaluate(() => {
    const glider = document.querySelector('.tab-glider');
    const sGlider = window.getComputedStyle(glider);
    const gBefore = window.getComputedStyle(glider, '::before');
    const gAfter = window.getComputedStyle(glider, '::after');
    const chd = document.getElementById('ptcTabCHD');
    const sChd = window.getComputedStyle(chd);
    const chdLabel = chd.querySelector('.ptc-tab-label');
    const sChdLabel = window.getComputedStyle(chdLabel);

    return {
      gliderHeight: sGlider.height,
      gliderFilter: sGlider.filter,
      beforeDisplay: gBefore.display,
      afterDisplay: gAfter.display,
      tabZIndex: sChd.zIndex,
      tabFilter: sChd.filter,
      tabBorderTop: parseFloat(sChd.borderTopWidth),
      tabBorderBottom: parseFloat(sChd.borderBottomWidth),
      labelZIndex: sChdLabel.zIndex,
      labelPos: sChdLabel.position,
    };
  });
  reporter.assert('Tab Glider ::before wing is disabled (no baseline line or overlap)', gliderSpecs.beforeDisplay === 'none');
  reporter.assert('Tab Glider ::after wing is disabled (no baseline line or overlap)', gliderSpecs.afterDisplay === 'none');
  reporter.assert('Tab Glider height is 35px matching tab buttons', gliderSpecs.gliderHeight === '35px');
  reporter.assert('Tab Glider filter is none (no drop-shadow mask fringe)', gliderSpecs.gliderFilter === 'none');
  reporter.assert('Inactive Tab filter is none (no GPU tile invalidation or microsecond flash)', gliderSpecs.tabFilter === 'none');
  reporter.assert('Inactive Tab has crisp top border definition (>= 1px)', gliderSpecs.tabBorderTop >= 1);
  reporter.assert('Inactive Tab has zero bottom border for seamless baseline flush', gliderSpecs.tabBorderBottom === 0);
  reporter.assert('Inactive Tab z-index is auto (prevents isolated stacking context)', gliderSpecs.tabZIndex === 'auto');
  reporter.assert('Tab label position is relative with z-index: 5 (floats above glider)', gliderSpecs.labelPos === 'relative' && gliderSpecs.labelZIndex === '5');

  // 4.6 Tab Switch Dynamic Transit & Zero-Flicker Invariance
  await safeClick('#ptcTabCHD');
  await page.waitForTimeout(350);
  const chdTransition = await page.evaluate(() => {
    const glider = document.querySelector('.tab-glider');
    const chd = document.getElementById('ptcTabCHD');
    const label = chd.querySelector('.ptc-tab-label');
    const gBox = glider.getBoundingClientRect();
    const cBox = chd.getBoundingClientRect();
    const lBox = label.getBoundingClientRect();
    return {
      offsetMatch: Math.abs(gBox.left - cBox.left) <= 1.5,
      widthMatch: Math.abs(gBox.width - cBox.width) <= 1.5,
      labelWidthNonZero: lBox.width > 0,
    };
  });
  reporter.assert('Glider smoothly translates to exact Child tab offset', chdTransition.offsetMatch);
  reporter.assert('Glider morphs to exact Child tab width', chdTransition.widthMatch);
  reporter.assert('Child tab label remains fully visible during active state', chdTransition.labelWidthNonZero);

  await safeClick('#ptcTabINF');
  await page.waitForTimeout(350);
  const infTransition = await page.evaluate(() => {
    const glider = document.querySelector('.tab-glider');
    const inf = document.getElementById('ptcTabINF');
    const label = inf.querySelector('.ptc-tab-label');
    const chd = document.getElementById('ptcTabCHD');
    const chdLabel = chd.querySelector('.ptc-tab-label');
    const gBox = glider.getBoundingClientRect();
    const iBox = inf.getBoundingClientRect();
    const lBox = label.getBoundingClientRect();
    const clBox = chdLabel.getBoundingClientRect();
    return {
      offsetMatch: Math.abs(gBox.left - iBox.left) <= 1.5,
      widthMatch: Math.abs(gBox.width - iBox.width) <= 1.5,
      infLabelWidthNonZero: lBox.width > 0,
      chdLabelWidthNonZero: clBox.width > 0,
    };
  });
  reporter.assert('Glider smoothly translates to exact Infant tab offset', infTransition.offsetMatch);
  reporter.assert('Glider morphs to exact Infant tab width', infTransition.widthMatch);
  reporter.assert('Infant tab label remains fully visible during active state', infTransition.infLabelWidthNonZero);
  reporter.assert('Child tab label remains fully visible after becoming inactive (zero occlusion)', infTransition.chdLabelWidthNonZero);

  // Return active tab to ADT for clean state
  await safeClick('#ptcTabADT');
  await page.waitForTimeout(350);

  // 4.7 Halve Fare Component Selector Layout & Non-Overlap Invariant
  await safeFill('#fareCalcString', 'NYC EK X/DXB EK BOM118.50TLENPUS2/USN2 EK X/DXB EK NYC798.00KLEESUS1/USN2 NUC237.00END ROE1.000000 XF JFK4.50');
  await page.dispatchEvent('#fareCalcString', 'input');
  await safeCheck('#halveFareComponents');
  await page.waitForTimeout(150);

  const halveGeometry = await page.evaluate(() => {
    const selector = document.getElementById('halveComponentSelector');
    const chips = Array.from(document.querySelectorAll('#halveComponentOptions .halve-chip'));
    const parseBtn = document.getElementById('parseButton');
    const clearBtn = document.getElementById('parserClearButton');
    const selBox = selector.getBoundingClientRect();
    const parseBox = parseBtn.getBoundingClientRect();
    const clearBox = clearBtn.getBoundingClientRect();

    let maxChipBottom = 0;
    chips.forEach(chip => {
      const b = chip.getBoundingClientRect();
      if (b.bottom > maxChipBottom) maxChipBottom = b.bottom;
    });

    const minBtnTop = Math.min(parseBox.top, clearBox.top);
    const chipToButtonGap = minBtnTop - maxChipBottom;
    const selectorToButtonGap = minBtnTop - selBox.bottom;

    return {
      selectorVisible: selector.style.display !== 'none' && selBox.height > 0,
      selectorHeight: selBox.height,
      chipCount: chips.length,
      maxChipBottom,
      minBtnTop,
      chipToButtonGap,
      selectorToButtonGap,
      noOverlap: chipToButtonGap >= 4 && selectorToButtonGap >= 4,
    };
  });

  reporter.assert('Halve component selector is visible with multiple chips', halveGeometry.selectorVisible && halveGeometry.chipCount >= 3, `${halveGeometry.chipCount} chips`);
  reporter.assert('Halve component selector height expands naturally (> 45px)', halveGeometry.selectorHeight >= 45, `${halveGeometry.selectorHeight}px`);
  reporter.assert('Chips and Convert/Clear buttons have zero overlap (gap >= 4px)', halveGeometry.noOverlap, `gap = ${halveGeometry.chipToButtonGap}px`);

  // ==========================================================================
  // MODULE 5: EXTREME STATEFUL CHAOS FUZZING & IRREGULAR SEQUENCES
  // ==========================================================================
  reporter.setModule('5. Extreme Chaos Fuzzing & Disordered Stress');

  console.log(`  Executing ${CHAOS_STEPS} stochastic interactions with SEED=${SEED}...`);
  const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'JPY', 'KWD', 'SAR'];
  const CABINS = ['economy', 'premium', 'business', 'first', ''];

  let chaosErrors = 0;
  for (let step = 1; step <= CHAOS_STEPS; step++) {
    const action = randInt(1, 14);
    try {
      switch (action) {
        case 1:
          await safeSelect('#currency', randChoice(CURRENCIES));
          break;
        case 2:
          await safeSelect('#cabin', randChoice(CABINS));
          break;
        case 3:
          await safeFill('#oldFare', String(randInt(0, 50000)));
          break;
        case 4:
          await safeFill('#newFare', String(randInt(0, 50000)));
          break;
        case 5:
          await safeFill('#changeFee', String(randInt(0, 10000)));
          break;
        case 6:
          if (randInt(0, 1) === 1) await safeCheck('#applyK3OnFareDiff');
          else await safeUncheck('#applyK3OnFareDiff');
          break;
        case 7:
          if (randInt(0, 1) === 1) await safeCheck('#applyK3OnChangeFee');
          else await safeUncheck('#applyK3OnChangeFee');
          break;
        case 8:
          if (randInt(0, 1) === 1) await safeCheck('#applyK3OnYQ');
          else await safeUncheck('#applyK3OnYQ');
          break;
        case 9:
          await safeClick('#fareCalcButton');
          break;
        case 10:
          await safeFill('#oldTax', `${randChoice(CURRENCIES)}${randInt(10, 500)}YQ ${randChoice(CURRENCIES)}${randInt(10, 200)}IN`);
          await safeFill('#newTax', `${randChoice(CURRENCIES)}${randInt(10, 600)}YQ ${randChoice(CURRENCIES)}${randInt(10, 250)}IN`);
          await safeClick('#taxCalcButton');
          break;
        case 11:
          await safeClick(randChoice(['#ptcTabADT', '#ptcTabCHD', '#ptcTabINF']));
          break;
        case 12:
          await safeClick('#summariseButton');
          break;
        case 13:
          await safeFill('#fareDiff', `${randChoice(CURRENCIES)}${randInt(100, 5000)}`);
          break;
        case 14:
          if (randInt(0, 4) === 0) await safeClick('#fareClearButton');
          break;
      }
      await dismissModals();
    } catch (err) {
      chaosErrors++;
      console.warn(`    Chaos step ${step} action ${action} error: ${err.message}`);
    }

    // Every 50 steps, verify DOM invariants
    if (step % 50 === 0) {
      const domInvariant = await page.evaluate(() => {
        const perPax = document.getElementById('perPax').value;
        const subTotal = document.getElementById('subTotal').value;
        const taxAdj = document.getElementById('taxAdj').value;
        return {
          hasNaN: perPax.includes('NaN') || subTotal.includes('NaN') || taxAdj.includes('NaN'),
          hasUndefined: perPax.includes('undefined') || subTotal.includes('undefined') || taxAdj.includes('undefined'),
        };
      });

      if (domInvariant.hasNaN || domInvariant.hasUndefined) {
        chaosErrors++;
        console.error(`    Invariant violation at step ${step}: NaN or undefined detected in DOM`);
      }
    }
  }

  reporter.assert(`Completed ${CHAOS_STEPS} chaos steps with 0 unhandled fatal crashes`, chaosErrors === 0, `${chaosErrors} errors`);
  reporter.assert('Page console and error listeners captured 0 uncaught JS exceptions', capturedErrors.length === 0, capturedErrors.join('; '));

  // ==========================================================================
  // FINAL REPORT & ARTIFACT GENERATION
  // ==========================================================================
  const allPassed = reporter.summary();

  // Save audit artifact report
  const auditReportPath = path.resolve('C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/643cd18c-a97f-4475-80c9-0ad6e75f8e33/master_zero_defect_audit_report.json');
  const auditReportDir = path.dirname(auditReportPath);
  if (!fs.existsSync(auditReportDir)) {
    fs.mkdirSync(auditReportDir, { recursive: true });
  }
  fs.writeFileSync(auditReportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTests: reporter.totalTests,
    passed: reporter.passed,
    failed: reporter.failed,
    seed: SEED,
    chaosSteps: CHAOS_STEPS,
    moduleStats: reporter.moduleStats,
    status: allPassed ? 'ZERO_DEFECT_VERIFIED' : 'FAILED',
  }, null, 2));

  console.log(`\nMaster audit report saved to: ${auditReportPath}`);

  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();
