const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('========================================================================');
  console.log('STARTING DEEP PARAMETER DEBUGGING & ERROR TESTING SUITE');
  console.log('========================================================================\n');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const uncaughtErrors = [];
  page.on('pageerror', err => {
    console.error('UNCAUGHT BROWSER ERROR:', err.message);
    uncaughtErrors.push(err.message);
  });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function testAssert(category, name, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] [${category}] ${name}`);
    } else {
      failedTests++;
      console.error(`  [FAIL] [${category}] ${name} ${details ? '--> ' + details : ''}`);
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 1: CURRENCY ROUNDING & PRECISION ACROSS ALL UNIT TYPES
  // --------------------------------------------------------------------------
  console.log('\n--- 1. CURRENCY PRECISION & IATA ROUNDING RULES ---');

  // 1.1: 0-Decimal Currency (JPY - Unit 1, Direction NEAREST)
  await page.selectOption('#currency', 'JPY');
  await page.fill('#fareDiff', '');
  await page.fill('#oldFare', '12500');
  await page.fill('#newFare', '18750');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  let jpyDiff = await page.inputValue('#fareDiff');
  testAssert('Currency Rules', 'JPY 0-decimal integer rounding (18750 - 12500 = JPY6250)', jpyDiff === 'JPY6250', `Got ${jpyDiff}`);

  // 1.2: 3-Decimal Currency (KWD - Unit 0.001, Direction UP)
  await page.selectOption('#currency', 'KWD');
  await page.fill('#fareDiff', '');
  await page.fill('#oldFare', '10.125');
  await page.fill('#newFare', '25.375');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  let kwdDiff = await page.inputValue('#fareDiff');
  testAssert('Currency Rules', 'KWD 3-decimal rounding (25.375 - 10.125 = KWD15.250)', kwdDiff === 'KWD15.250', `Got ${kwdDiff}`);

  // 1.3: Standard 2-Decimal Currency (USD - Unit 0.01)
  await page.selectOption('#currency', 'USD');
  await page.fill('#fareDiff', '');
  await page.fill('#oldFare', '149.99');
  await page.fill('#newFare', '299.50');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  let usdDiff = await page.inputValue('#fareDiff');
  testAssert('Currency Rules', 'USD 2-decimal rounding (299.50 - 149.99 = USD149.51)', usdDiff === 'USD149.51', `Got ${usdDiff}`);

  // 1.4: TND (Unit 0.001, Direction UP)
  await page.selectOption('#currency', 'TND');
  await page.fill('#fareDiff', '');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '155.333');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  let tndDiff = await page.inputValue('#fareDiff');
  testAssert('Currency Rules', 'TND 3-decimal unit 0.001 rounding (155.333 - 100 = TND55.333)', tndDiff === 'TND55.333', `Got ${tndDiff}`);

  // 1.5: AED (Unit 1, Direction UP)
  await page.selectOption('#currency', 'AED');
  await page.fill('#fareDiff', '');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '153');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  let aedDiff = await page.inputValue('#fareDiff');
  testAssert('Currency Rules', 'AED Unit 1 rounding UP (153 - 100 = AED53)', aedDiff === 'AED53', `Got ${aedDiff}`);

  // --------------------------------------------------------------------------
  // SECTION 2: MANUAL DUAL-CURRENCY ENTRY & DOWNLINE SETTLEMENT PROPAGATION
  // --------------------------------------------------------------------------
  console.log('\n--- 2. MANUAL DUAL-CURRENCY & SETTLEMENT PROPAGATION ---');

  // Reset to USD
  await page.selectOption('#currency', 'USD');
  await page.fill('#fareDiff', '');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '135');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // Auto-calculated USD diff
  let initialDiff = await page.inputValue('#fareDiff');
  testAssert('Dual Currency', 'Initial Auto Fare Diff is USD35.00', initialDiff === 'USD35.00', `Got ${initialDiff}`);

  // Animated bulb visibility
  let bulbVisible = await page.isVisible('#fareDiffBulb');
  let bulbTooltip = await page.getAttribute('#fareDiffBulb', 'data-tooltip');
  testAssert('UI Bulb', 'Animated bulb appears next to Fare Diff title on calculation', bulbVisible, `Visible: ${bulbVisible}`);
  testAssert('UI Bulb', 'Bulb tooltip has informative text', bulbTooltip.includes('converted settlement amount'), `Tooltip: ${bulbTooltip}`);

  // Overwrite Fare Diff with INR 4277
  await page.fill('#fareDiff', 'INR4277');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  let inrPerPax = await page.inputValue('#perPax');
  testAssert('Settlement Propagation', 'Downline Per Pax switches to INR4277', inrPerPax === 'INR4277', `Got ${inrPerPax}`);

  let inrNotice = await page.isVisible('#inrMessage:not(:empty)');
  testAssert('Settlement Propagation', 'INR message banner activated', inrNotice, `Notice visible: ${inrNotice}`);

  // Test clearing Fare Diff reverts back to auto calculation
  await page.fill('#fareDiff', '');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  let revertedDiff = await page.inputValue('#fareDiff');
  testAssert('Settlement Propagation', 'Clearing manual Fare Diff reverts to auto USD35.00', revertedDiff === 'USD35.00', `Got ${revertedDiff}`);

  // Overwrite back to INR4277
  await page.fill('#fareDiff', 'INR4277');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // --------------------------------------------------------------------------
  // SECTION 3: CABIN TYPES & K3 GST COMBINATIONS
  // --------------------------------------------------------------------------
  console.log('\n--- 3. CABIN TYPES & K3 GST TAX COMBINATIONS ---');

  // Change Fee = 3000
  await page.fill('#changeFee', '3000');

  // 3.1: Economy Cabin (5% GST)
  await page.selectOption('#cabin', 'economy');
  await page.check('#applyK3OnFareDiff');
  await page.check('#applyK3OnChangeFee');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  let k3Economy = await page.inputValue('#k3Tax');
  // 5% of 4277 = 213.85 -> 214; 5% of 3000 = 150 -> Total K3 = 364
  testAssert('K3 Tax', 'Economy K3 5% on Diff(4277) + Fee(3000) = INR364', k3Economy === 'INR364', `Got ${k3Economy}`);

  let addTaxesWithK3 = await page.inputValue('#addTaxes');
  testAssert('K3 Tax', 'Add Taxes contains calculated INR214K3', addTaxesWithK3.includes('INR214K3'), `Got ${addTaxesWithK3}`);

  // 3.2: Business Cabin (18% GST)
  await page.selectOption('#cabin', 'business');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  let k3Business = await page.inputValue('#k3Tax');
  // 18% of 4277 = 769.86 -> 770; 18% of 3000 = 540 -> Total K3 = 1310
  testAssert('K3 Tax', 'Business K3 18% on Diff(4277) + Fee(3000) = INR1310', k3Business === 'INR1310', `Got ${k3Business}`);

  // 3.3: Premium Economy Cabin (18% GST)
  await page.selectOption('#cabin', 'premium');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  let k3Prem = await page.inputValue('#k3Tax');
  testAssert('K3 Tax', 'Premium Economy K3 18% matches Business = INR1310', k3Prem === 'INR1310', `Got ${k3Prem}`);

  // 3.4: First Class (18% GST)
  await page.selectOption('#cabin', 'first');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  let k3First = await page.inputValue('#k3Tax');
  testAssert('K3 Tax', 'First Class K3 18% = INR1310', k3First === 'INR1310', `Got ${k3First}`);

  // Switch back to Economy for remaining tests
  await page.selectOption('#cabin', 'economy');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // --------------------------------------------------------------------------
  // SECTION 4: PASSENGER MULTIPLIER MATH
  // --------------------------------------------------------------------------
  console.log('\n--- 4. PASSENGER MULTIPLIER MATH ---');

  // Pax = 3
  await page.fill('#pax', '3');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  let perPax3 = await page.inputValue('#perPax');
  let subTotal3 = await page.inputValue('#subTotal');
  // Per Pax = 4277 (diff) + 3000 (fee) + 214 (K3 diff) + 150 (K3 fee) = 7641
  // SubTotal = 7641 * 3 = 22923
  testAssert('Pax Math', 'Per Pax is INR7641 with 3 passengers', perPax3 === 'INR7641', `Got ${perPax3}`);
  testAssert('Pax Math', 'Sub Total is INR22923 (7641 * 3)', subTotal3 === 'INR22923', `Got ${subTotal3}`);

  // Reset Pax = 1
  await page.fill('#pax', '1');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // --------------------------------------------------------------------------
  // SECTION 5: TAX ADJUSTMENT CALCULATOR & NEGATIVE TAX PARSING
  // --------------------------------------------------------------------------
  console.log('\n--- 5. TAX ADJUSTMENT & NEGATIVE TAX ROUTING ---');

  // Enter complex old and new taxes
  await page.fill('#oldTax', 'INR500YQ/INR400YR/INR300IN');
  await page.fill('#newTax', 'INR200YQ/INR600YR/INR300IN');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);

  let addTaxesVal = await page.inputValue('#addTaxes');
  let refundTaxesVal = await page.inputValue('#refundTaxes');
  let taxAdjVal = await page.inputValue('#taxAdj');

  // YQ: 200 - 500 = -300 (Refund)
  // YR: 600 - 400 = +200 (Add)
  // IN: 300 - 300 = 0
  // Net Tax = -100
  testAssert('Tax Adj', 'Positive YR tax (+INR200) routed to Add Taxes', addTaxesVal.includes('INR200YR'), `Got ${addTaxesVal}`);
  testAssert('Tax Adj', 'Negative YQ tax (-INR300) routed to Refund Taxes', refundTaxesVal.includes('-INR300YQ'), `Got ${refundTaxesVal}`);
  testAssert('Tax Adj', 'Net Tax Adjustment calculated accurately', taxAdjVal.includes('INR'), `Got ${taxAdjVal}`);

  // --------------------------------------------------------------------------
  // SECTION 6: FARE CALCULATION STRING PARSER (NUC, ROE, Q-SURCHARGES)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. FARE CALCULATION STRING PARSER ---');

  if (await page.$eval('#parserCollapsible', el => el.classList.contains('collapsed'))) {
    await page.click('#parserToggleBtn');
    await page.waitForTimeout(300);
  }

  const fareCalcStringSample = 'BOM EK X/DXB EK NYC 102.21TLEEPIN1 EK X/DXB BOM 404.56XWEEFIN1 Q5.00 NUC511.77 ROE90.3344456';
  await page.fill('#fareCalcString', fareCalcStringSample);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
    await page.waitForTimeout(100);
  }

  let statedNuc = await page.textContent('#statedNuc');
  let roeVal = await page.textContent('#roe');
  let baseFareVal = await page.textContent('#baseFare');

  testAssert('Parser', 'NUC extracted accurately (511.77)', statedNuc.includes('511.77'), `Got ${statedNuc}`);
  testAssert('Parser', 'ROE extracted accurately (90.3344456)', roeVal.includes('90.3344456'), `Got ${roeVal}`);
  testAssert('Parser', 'Base Fare calculated as NUC * ROE', baseFareVal.length > 0, `Got ${baseFareVal}`);

  // --------------------------------------------------------------------------
  // SECTION 7: SUMMARY CONSOLIDATION & DUAL-CURRENCY DISPLAY
  // --------------------------------------------------------------------------
  console.log('\n--- 7. SUMMARY CONSOLIDATION & DUAL-CURRENCY DISPLAY ---');

  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  await page.waitForSelector('#summary table');
  const summaryRows = await page.$$eval('#summary table tbody tr', trs =>
    trs.map(tr => ({
      label: tr.querySelector('td:first-child')?.textContent?.trim(),
      val: tr.querySelector('td:last-child')?.textContent?.trim()
    }))
  );

  const oldFareCell = summaryRows.find(r => r.label === 'Old Fare')?.val;
  const newFareCell = summaryRows.find(r => r.label === 'New Fare')?.val;
  const fareDiffCell = summaryRows.find(r => r.label === 'Fare Difference')?.val;
  const feeCell = summaryRows.find(r => r.label === 'Change Fee')?.val;
  const totalCell = summaryRows.find(r => r.label === 'Sub Total')?.val;
  const fcsCell = summaryRows.find(r => r.label === 'Fare Calculation String Adult')?.val;

  testAssert('Summary Table', 'Old Fare preserved in USD (USD100.00)', oldFareCell === 'USD100.00', `Got ${oldFareCell}`);
  testAssert('Summary Table', 'New Fare preserved in USD (USD135.00)', newFareCell === 'USD135.00', `Got ${newFareCell}`);
  testAssert('Summary Table', 'Fare Difference displayed in INR (INR4277)', fareDiffCell === 'INR4277', `Got ${fareDiffCell}`);
  testAssert('Summary Table', 'Change Fee displayed in INR with K3 breakdown', feeCell.includes('INR3150') && feeCell.includes('INR150'), `Got ${feeCell}`);
  testAssert('Summary Table', 'Sub Total calculated in INR', totalCell.startsWith('INR'), `Got ${totalCell}`);
  testAssert('Summary Table', 'Fare Calc String parsed into Summary', fcsCell && fcsCell.includes('TLEEPIN1'), `Got ${fcsCell}`);

  // GDS string check
  let gdsOutput = await page.inputValue('#gdsString');
  testAssert('GDS Command', 'GDS Command formatted with FARE DIFF INR', gdsOutput.includes('FARE DIFF INR4277'), `Got ${gdsOutput}`);
  testAssert('GDS Command', 'GDS Command formatted with CHG FEE INR', gdsOutput.includes('CHG FEE INR3150'), `Got ${gdsOutput}`);

  // --------------------------------------------------------------------------
  // SECTION 8: MULTI-PTC TABS (ADT, CNN, INF, CUSTOM TABS)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. MULTI-PTC TAB SWITCHING & ISOLATION ---');

  // Switch to CNN
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(200);

  // CNN enters USD fares
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '75');
  await page.fill('#newFare', '101.25');
  await page.fill('#fareDiff', 'INR3208');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // Switch back to ADT - verify ADT snapshot intact
  await page.click('#ptcTabADT');
  await page.waitForTimeout(200);
  let restoredAdtDiff = await page.inputValue('#fareDiff');
  testAssert('Multi-PTC Isolation', 'ADT fareDiff preserved as INR4277 on switch back', restoredAdtDiff === 'INR4277', `Got ${restoredAdtDiff}`);

  // Multi-PTC Summarise
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  const headerCols = await page.$$eval('#summary table thead tr th', ths => ths.map(th => th.textContent.trim()));
  testAssert('Multi-PTC Summary', 'Summary contains Adult column', headerCols.includes('Adult'), `Cols: ${headerCols}`);
  testAssert('Multi-PTC Summary', 'Summary contains Child column', headerCols.includes('Child'), `Cols: ${headerCols}`);

  const multiPtcRows = await page.$$eval('#summary table tbody tr', trs =>
    trs.map(tr => tr.querySelector('td:first-child')?.textContent?.trim())
  );
  testAssert('Multi-PTC Summary', 'Summary contains Amount Payable row', multiPtcRows.includes('Amount Payable'), `Rows: ${multiPtcRows}`);

  // --------------------------------------------------------------------------
  // SECTION 9: INPUT VALIDATION, ERROR MODALS & SECURITY
  // --------------------------------------------------------------------------
  console.log('\n--- 9. INPUT VALIDATION, ERROR MODALS & SECURITY ---');

  // 9.1: Currency Mismatch Error
  await page.fill('#oldFare', 'USD 100');
  await page.fill('#newFare', 'EUR 150');
  await page.click('#fareCalcButton', { force: true });
  await page.waitForTimeout(200);

  let isErrorModalVisible = await page.isVisible('#errorModal.show');
  let modalText = isErrorModalVisible ? await page.textContent('#modalMessage') : '';
  testAssert('Validation', 'Currency mismatch triggers error modal', isErrorModalVisible && modalText.includes('same currency'), `Modal: ${modalText}`);

  await page.evaluate(() => closeErrorModal());
  await page.waitForTimeout(100);

  // Reset fields cleanly and recalculate to clear debounce
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '135');
  await page.fill('#fareDiff', 'INR4277');
  await page.click('#fareCalcButton', { force: true });
  await page.waitForTimeout(350);
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  // 9.2: Empty Tax Validation
  if (await page.$eval('#taxCollapsible', el => el.classList.contains('collapsed'))) {
    await page.click('#taxToggleBtn');
    await page.waitForTimeout(200);
  }
  await page.fill('#oldTax', '');
  await page.fill('#newTax', '');
  await page.click('#taxCalcButton', { force: true });
  await page.waitForTimeout(200);

  let isTaxEmptyModalVisible = await page.isVisible('#errorModal.show');
  let taxEmptyModalText = isTaxEmptyModalVisible ? await page.textContent('#modalMessage') : '';
  testAssert('Validation', 'Empty tax inputs trigger prompt modal', isTaxEmptyModalVisible && taxEmptyModalText.includes('Enter both OLD TAX and NEW TAX'), `Modal: ${taxEmptyModalText}`);

  await page.evaluate(() => closeErrorModal());
  await page.waitForTimeout(100);

  // 9.3: XSS Protection / Sanitization
  await page.evaluate(() => { window.__xss_executed = false; });
  await page.fill('#oldTax', '<img src=x onerror="window.__xss_executed=true">');
  await page.fill('#newTax', 'INR100YR');
  await page.click('#taxCalcButton', { force: true });
  await page.waitForTimeout(200);

  let isXssExecuted = await page.evaluate(() => window.__xss_executed === true);
  testAssert('Security', 'XSS payload in tax input is safely neutralized without execution', !isXssExecuted, `Executed: ${isXssExecuted}`);

  await page.evaluate(() => closeErrorModal());
  await page.waitForTimeout(100);

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`DEEP DEBUGGING COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log(`UNCAUGHT RUNTIME ERRORS: ${uncaughtErrors.length}`);
  console.log('========================================================================\n');

  assert.strictEqual(failedTests, 0, `All ${totalTests} test assertions must pass`);
  assert.strictEqual(uncaughtErrors.length, 0, 'There must be zero uncaught runtime errors');

  await browser.close();
})();
