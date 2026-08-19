const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const artifactDir = path.resolve('C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/1a69e0b2-33ac-4d8b-a578-b99b256dd4e6');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('================================================================');
  console.log('STARTING COMPREHENSIVE E2E TEST & AUDIT SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  // Track all browser logs and uncaught errors
  const browserLogs = [];
  const stateTransitions = [];
  page.on('console', msg => browserLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => {
    console.error('UNCAUGHT PAGE ERROR:', err);
    browserLogs.push(`[PAGE_ERROR] ${err.message}`);
  });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Dismiss error modal if triggered by offline/mocked fetch
  if (await page.isVisible('#errorModal.show')) {
    await page.click('#errorModal .modal-close-btn');
    await page.waitForTimeout(100);
  }

  const results = [];

  function recordResult(category, testName, inputs, expected, actual, pass) {
    results.push({ category, testName, inputs, expected, actual, pass });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] [${category}] ${testName}`);
    if (!pass) {
      console.log(`   Inputs: ${JSON.stringify(inputs)}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual:   ${actual}`);
    }
  }

  // --------------------------------------------------------------------------
  // CATEGORY 1: Unit & Calculation Logic Across Currency Pairs
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 1: Calculation Logic & Precision ---');

  // Test 1.1: Base Fare Difference Auto Calculation (USD)
  try {
    await page.selectOption('#currency', 'USD');
    await page.fill('#oldFare', '150');
    await page.fill('#newFare', '280');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    const autoDiff = await page.inputValue('#fareDiff');
    const pass = autoDiff === 'USD130.00';
    recordResult(
      'Calculation Logic',
      'USD Fare Difference Auto-Calculation (280 - 150 = USD130.00)',
      { oldFare: '150', newFare: '280', currency: 'USD' },
      'USD130.00',
      autoDiff,
      pass
    );
  } catch (e) {
    recordResult('Calculation Logic', 'USD Fare Difference Auto-Calculation', {}, 'USD130.00', e.message, false);
  }

  // Test 1.2: Manual Overwrite of Fare Diff to INR11245 & Change Fee INR6488
  try {
    await page.fill('#fareDiff', 'INR11245');
    await page.fill('#changeFee', 'INR6488');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    const perPax = await page.inputValue('#perPax');
    // 11245 + 6488 = 17733
    const pass = perPax === 'INR17733';
    recordResult(
      'Calculation Logic',
      'Manual Dual Currency Entry (INR11245 + INR6488 = INR17733)',
      { fareDiff: 'INR11245', changeFee: 'INR6488' },
      'INR17733',
      perPax,
      pass
    );
  } catch (e) {
    recordResult('Calculation Logic', 'Manual Dual Currency Entry', {}, 'INR17733', e.message, false);
  }

  // Test 1.3: K3 on Fare Difference (Economy = 5%)
  try {
    await page.selectOption('#cabin', 'economy');
    await page.check('#applyK3OnFareDiff');
    await page.uncheck('#applyK3OnChangeFee');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    const calculatedK3 = await page.inputValue('#k3Tax');
    // Fare Diff K3 = 5% of 11245 = 562.25 -> 563
    const pass = calculatedK3 === 'INR563';
    recordResult(
      'Calculation Logic',
      'K3 on Converted Fare Difference only (5% of 11245 = INR563)',
      { cabin: 'economy', fareDiff: '11245', applyK3OnFareDiff: true },
      'INR563',
      calculatedK3,
      pass
    );
  } catch (e) {
    recordResult('Calculation Logic', 'K3 on Converted Fare Difference only', {}, 'INR563', e.message, false);
  }

  // Test 1.4: K3 on Change Fee & Fare Difference combined (Economy = 5%)
  try {
    await page.check('#applyK3OnChangeFee');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    const calculatedK3Total = await page.inputValue('#k3Tax');
    // Fare Diff K3 (562.25) + Fee K3 (324.4) = 886.65 -> INR887
    const pass = calculatedK3Total === 'INR887';
    recordResult(
      'Calculation Logic',
      'Combined K3 on Fare Diff & Change Fee (562.25 + 324.4 = INR887)',
      { cabin: 'economy', applyK3OnFareDiff: true, applyK3OnChangeFee: true },
      'INR887',
      calculatedK3Total,
      pass
    );
  } catch (e) {
    recordResult('Calculation Logic', 'Combined K3 on Fare Diff & Change Fee', {}, 'INR887', e.message, false);
  }

  // --------------------------------------------------------------------------
  // CATEGORY 2: Component Reactivity & State Transitions
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 2: Component Reactivity & State Transitions ---');

  // Test 2.1: Reverse Order of Operations (Update Fare Calc String after initial Summary)
  try {
    stateTransitions.push({ action: 'Initial Summarize Click', timestamp: new Date().toISOString() });
    await page.click('#summariseButton');
    await page.waitForTimeout(300);

    // Now update Fare Calc String Parser after initial summary
    stateTransitions.push({ action: 'Enter Fare Calc String after initial summary', timestamp: new Date().toISOString() });
    if (await page.$eval('#parserCollapsible', el => el.classList.contains('collapsed'))) {
      await page.click('#parserToggleBtn');
      await page.waitForTimeout(300);
    }

    const testFareCalc = 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM 404.56XWEEFIN1/NDC2 Q5.00 NUC511.77 ROE90.3344456';
    await page.fill('#fareCalcString', testFareCalc);
    await page.click('#parseButton');
    await page.waitForTimeout(200);

    // Re-summarize
    stateTransitions.push({ action: 'Re-summarize with Fare Calc String', timestamp: new Date().toISOString() });
    await page.click('#summariseButton');
    await page.waitForTimeout(300);

    const fareCalcSummaryCell = await page.locator('#summary table tr:has(td:has-text("Fare Calculation String")) td:nth-child(2)').textContent();
    const hasFareCalcInSummary = fareCalcSummaryCell && fareCalcSummaryCell.includes('TLEEPIN1');

    // Visual screenshot for reverse order
    const reverseOrderScreenshotPath = path.join(artifactDir, 'e2e_reverse_order_summary.png');
    await page.screenshot({ path: reverseOrderScreenshotPath, fullPage: false });

    recordResult(
      'Reactivity & State',
      'Reverse Order of Operations: Fare Calc String added after initial summary updates table dynamically',
      { fareCalcString: testFareCalc },
      'Summary table contains Fare Calculation String row',
      hasFareCalcInSummary ? 'Fare Calculation String present and rendered' : 'Missing',
      Boolean(hasFareCalcInSummary)
    );
  } catch (e) {
    recordResult('Reactivity & State', 'Reverse Order of Operations', {}, 'Present', e.message, false);
  }

  // Test 2.2: K3 Toggle Sync with Real-time GDS String & Summary Table
  try {
    stateTransitions.push({ action: 'Toggle K3 Off on Change Fee', timestamp: new Date().toISOString() });
    await page.uncheck('#applyK3OnChangeFee');
    await page.click('#fareCalcButton');
    await page.click('#summariseButton');
    await page.waitForTimeout(200);

    const changeFeeRowK3Off = await page.locator('#summary table tr:has(td:has-text("Change Fee")) td:nth-child(2)').textContent();
    const gdsStringK3Off = await page.inputValue('#gdsString');

    stateTransitions.push({ action: 'Toggle K3 On on Change Fee', timestamp: new Date().toISOString() });
    await page.check('#applyK3OnChangeFee');
    await page.click('#fareCalcButton');
    await page.click('#summariseButton');
    await page.waitForTimeout(200);

    const changeFeeRowK3On = await page.locator('#summary table tr:has(td:has-text("Change Fee")) td:nth-child(2)').textContent();
    const gdsStringK3On = await page.inputValue('#gdsString');

    const k3SyncScreenshotPath = path.join(artifactDir, 'e2e_k3_toggle_sync.png');
    await page.screenshot({ path: k3SyncScreenshotPath, fullPage: false });

    const pass = changeFeeRowK3Off.includes('INR6488') && 
                 changeFeeRowK3On.includes('INR6813 (incl. K3 INR325)') &&
                 gdsStringK3On.includes('+ CHG FEE INR6813');

    recordResult(
      'Reactivity & State',
      'Real-time K3 Toggle Synchronization across Summary Table and GDS String',
      { applyK3OnChangeFee: 'toggled from false to true' },
      'Change Fee reflects INR6813 (incl. K3 INR325) and GDS reflects + CHG FEE INR6813',
      `Summary: ${changeFeeRowK3On} | GDS: ${gdsStringK3On}`,
      pass
    );
  } catch (e) {
    recordResult('Reactivity & State', 'K3 Toggle Synchronization', {}, 'Synchronized', e.message, false);
  }

  // Test 2.3: Animated Bulb Tips & Hover Tooltips
  try {
    const isFareDiffVisible = await page.isVisible('#fareDiffBulb');
    const isChangeFeeVisible = await page.isVisible('#changeFeeBulb');
    const fareDiffTooltip = await page.getAttribute('#fareDiffBulb', 'data-tooltip');
    const pass = isFareDiffVisible && isChangeFeeVisible && fareDiffTooltip.includes('converted settlement amount');

    recordResult(
      'Helper Information',
      'Animated bulb tips display next to Fare Difference and Change Fee titles with hover tooltips',
      { isFareDiffVisible, isChangeFeeVisible, fareDiffTooltip },
      'Visible animated bulb tips with hover tooltips',
      `Fare Diff: ${isFareDiffVisible} | Change Fee: ${isChangeFeeVisible}`,
      pass
    );
  } catch (e) {
    recordResult('Helper Information', 'Animated bulb tips', {}, 'Visible bulbs', e.message, false);
  }

  // --------------------------------------------------------------------------
  // CATEGORY 3: Multi-PTC Tabs & Consolidated Breakdown
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 3: Multi-PTC Calculations & Snapshot Persistence ---');

  try {
    // 1. ADT is already populated. Switch to CNN tab.
    stateTransitions.push({ action: 'Switch to CNN Tab', timestamp: new Date().toISOString() });
    await page.click('#ptcTabCNN');
    await page.waitForTimeout(300);

    // Enter CNN fares in USD and manual INR conversion
    await page.selectOption('#currency', 'USD');
    await page.fill('#oldFare', '112.50');
    await page.fill('#newFare', '210.00');
    await page.selectOption('#cabin', 'economy');
    await page.check('#applyK3OnFareDiff');
    await page.fill('#fareDiff', 'INR8434');
    await page.fill('#changeFee', 'INR4325');
    await page.check('#applyK3OnChangeFee');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    // 2. Switch to INF tab
    stateTransitions.push({ action: 'Switch to INF Tab', timestamp: new Date().toISOString() });
    await page.click('#ptcTabINF');
    await page.waitForTimeout(300);

    // Enter INF fares in USD and manual INR conversion
    await page.selectOption('#currency', 'USD');
    await page.fill('#oldFare', '15.00');
    await page.fill('#newFare', '28.00');
    await page.selectOption('#cabin', 'economy');
    await page.fill('#fareDiff', 'INR1125');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    // 3. Multi-PTC Summarise
    stateTransitions.push({ action: 'Click Multi-PTC Summarise', timestamp: new Date().toISOString() });
    await page.click('#summariseButton');
    await page.waitForTimeout(300);

    // Check Multi-PTC table columns/rows
    const tableHeaderHtml = await page.locator('#summary table thead').innerHTML();
    const hasAdult = tableHeaderHtml.includes('Adult');
    const hasChild = tableHeaderHtml.includes('Child');
    const hasInfant = tableHeaderHtml.includes('Infant');

    const multiPtcScreenshotPath = path.join(artifactDir, 'e2e_multi_ptc_summary.png');
    await page.screenshot({ path: multiPtcScreenshotPath, fullPage: false });

    const pass = hasAdult && hasChild && hasInfant;
    recordResult(
      'Multi-PTC Module',
      'Multi-PTC Summary Breakdown contains independent columns for Adult (ADT), Child (CNN), Infant (INF)',
      { tabs: ['ADT', 'CNN', 'INF'] },
      'Table header includes Adult, Child, Infant',
      `Adult: ${hasAdult}, Child: ${hasChild}, Infant: ${hasInfant}`,
      pass
    );
  } catch (e) {
    recordResult('Multi-PTC Module', 'Multi-PTC Summary Breakdown', {}, 'Consolidated table', e.message, false);
  }

  // --------------------------------------------------------------------------
  // CATEGORY 4: Input Validation & Edge Cases
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 4: Input Validation & Edge Cases ---');

  // Test 4.1: Zero Fare Difference
  try {
    await page.click('#ptcTabADT');
    await page.waitForTimeout(200);
    await page.selectOption('#currency', 'USD');
    await page.fill('#oldFare', '200');
    await page.fill('#newFare', '200');
    await page.fill('#fareDiff', '');
    await page.fill('#changeFee', '50');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    const diff = await page.inputValue('#fareDiff');
    const pass = diff === 'USD0.00';
    recordResult(
      'Edge Cases',
      'Zero Fare Difference (Old Fare == New Fare)',
      { oldFare: '200', newFare: '200' },
      'USD0.00',
      diff,
      pass
    );
  } catch (e) {
    recordResult('Edge Cases', 'Zero Fare Difference', {}, 'USD0.00', e.message, false);
  }

  // Test 4.2: Decimal precision and rounding (JPY = 0 decimals)
  try {
    await page.selectOption('#currency', 'JPY');
    await page.fill('#oldFare', '10000');
    await page.fill('#newFare', '15000');
    await page.fill('#fareDiff', '');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(200);

    const diffJpy = await page.inputValue('#fareDiff');
    const pass = diffJpy === 'JPY5000';
    recordResult(
      'Edge Cases',
      'JPY Currency Zero-Decimal Rounding Rule',
      { oldFare: '10000', newFare: '15000', currency: 'JPY' },
      'JPY5000',
      diffJpy,
      pass
    );
  } catch (e) {
    recordResult('Edge Cases', 'JPY Currency Zero-Decimal Rounding Rule', {}, 'JPY5000', e.message, false);
  }

  // Test 4.3: Negative Taxes categorized in Refund Taxes
  try {
    await page.fill('#oldTax', 'INR500YQ/INR400YR');
    await page.fill('#newTax', 'INR200YQ/INR100YR');
    await page.click('#taxCalcButton');
    await page.waitForTimeout(200);

    const refundTaxes = await page.inputValue('#refundTaxes');
    const pass = refundTaxes.includes('-INR300YQ') && refundTaxes.includes('-INR300YR');
    recordResult(
      'Edge Cases',
      'Negative Taxes properly routed to Refund Taxes field',
      { oldTax: 'INR500YQ/INR400YR', newTax: 'INR200YQ/INR100YR' },
      '-INR300YQ/-INR300YR',
      refundTaxes,
      pass
    );
  } catch (e) {
    recordResult('Edge Cases', 'Negative Taxes', {}, '-INR300YQ/-INR300YR', e.message, false);
  }

  // Test 4.4: Currency Mismatch Error Modal validation
  try {
    // Type mismatch currencies
    await page.fill('#oldFare', 'USD 100');
    await page.fill('#newFare', 'EUR 150');
    // Trigger tryCalculateFare via Enter or wait for debounce
    await page.keyboard.press('Tab');
    await page.waitForTimeout(350);

    const isModalVisible = await page.isVisible('#errorModal.show');
    const modalText = isModalVisible ? await page.textContent('#modalMessage') : '';
    const hasMismatchError = modalText.includes('Old Fare and New Fare must use the same currency');

    if (isModalVisible) {
      await page.click('#errorModal .modal-close-btn');
      await page.waitForTimeout(100);
    }

    recordResult(
      'Edge Cases',
      'Currency Mismatch Validation (USD vs EUR)',
      { oldFare: 'USD 100', newFare: 'EUR 150' },
      'Error modal triggers: Old Fare and New Fare must use the same currency',
      modalText,
      hasMismatchError
    );
  } catch (e) {
    recordResult('Edge Cases', 'Currency Mismatch Validation', {}, 'Error modal', e.message, false);
  }

  console.log('\n================================================================');
  console.log(`E2E AUDIT COMPLETE: ${results.filter(r => r.pass).length}/${results.length} TESTS PASSED`);
  console.log('================================================================');

  // Write detailed results to JSON for artifact generation
  fs.writeFileSync(
    path.join(artifactDir, 'e2e_test_report_data.json'),
    JSON.stringify({ results, stateTransitions, browserLogs }, null, 2)
  );

  await browser.close();
})();
