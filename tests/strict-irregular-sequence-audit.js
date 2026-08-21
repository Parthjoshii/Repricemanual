const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('========================================================================');
  console.log('STARTING STRICT IRREGULAR SEQUENCE & ZIG-ZAG REACTIVITY AUDIT');
  console.log('========================================================================\n');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1400, height: 1000 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  let passed = 0;
  let failed = 0;

  function check(label, condition, actual = '') {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${label}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${label} --> Got: ${actual}`);
    }
  }

  // ==========================================================================
  // SCENARIO 1: A -> B -> A ROUNDTRIP FARE EDITS
  // ==========================================================================
  console.log('--- SCENARIO 1: A -> B -> A Roundtrip Fare Edits ---');
  await page.selectOption('#currency', 'INR');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '305');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  let fareDiff = await page.inputValue('#fareDiff');
  let badge = await page.textContent('#baseFareDiffBadge');
  check('Initial INR 100 -> INR 305 produces Fare Diff INR205', fareDiff === 'INR205', fareDiff);
  check('Initial Base Badge shows Base: INR205', badge === 'Base: INR205', badge);

  // Edit to B: 307
  await page.fill('#newFare', '307');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('Edit New Fare to INR 307 updates Fare Diff to INR207', fareDiff === 'INR207', fareDiff);
  check('Base Badge updates to Base: INR207', badge === 'Base: INR207', badge);

  // Edit back to A: 305
  await page.fill('#newFare', '305');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('Edit New Fare back to INR 305 restores Fare Diff to INR205', fareDiff === 'INR205', fareDiff);
  check('Base Badge restores to Base: INR205', badge === 'Base: INR205', badge);

  // ==========================================================================
  // SCENARIO 2: CURRENCY DROPDOWN SWITCHES MID-CALCULATION
  // ==========================================================================
  console.log('\n--- SCENARIO 2: Currency Dropdown Switching on Live Values ---');
  // Switch to USD (2 decimals)
  await page.selectOption('#currency', 'USD');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('Currency switch to USD updates Fare Diff to USD205.00', fareDiff === 'USD205.00', fareDiff);
  check('Base Badge updates to Base: USD205.00', badge === 'Base: USD205.00', badge);

  // Switch to KWD (3 decimals)
  await page.selectOption('#currency', 'KWD');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('Currency switch to KWD updates Fare Diff to KWD205.000', fareDiff === 'KWD205.000', fareDiff);
  check('Base Badge updates to Base: KWD205.000', badge === 'Base: KWD205.000', badge);

  // Switch to JPY (0 decimals)
  await page.selectOption('#currency', 'JPY');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('Currency switch to JPY updates Fare Diff to JPY205', fareDiff === 'JPY205', fareDiff);
  check('Base Badge updates to Base: JPY205', badge === 'Base: JPY205', badge);

  // Switch back to INR
  await page.selectOption('#currency', 'INR');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  check('Currency switch back to INR restores Fare Diff to INR205', fareDiff === 'INR205', fareDiff);

  // Set to USD for subsequent USD tests
  await page.selectOption('#currency', 'USD');
  await page.waitForTimeout(350);

  // ==========================================================================
  // SCENARIO 3: TAX EDITS IN IRREGULAR ORDER & MULTI-LINE/SPACE FORMATS
  // ==========================================================================
  console.log('\n--- SCENARIO 3: Tax Edits & Multi-Line Delimiters ---');
  await page.fill('#oldTax', 'USD500YQ/USD200AE');
  await page.fill('#newTax', 'USD700YQ/USD200AE');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(100);

  let netTaxAdj = await page.inputValue('#taxAdj');
  let addTaxes = await page.inputValue('#addTaxes');
  check('Initial Tax calculation: +USD200 on YQ', netTaxAdj === 'USD200.00' && addTaxes === 'USD200.00YQ', `TaxAdj: ${netTaxAdj}, AddTaxes: ${addTaxes}`);

  // Paste space-separated taxes in New Tax
  await page.fill('#newTax', 'USD500YQ    USD350AE    USD100F6');
  await page.waitForTimeout(350);
  netTaxAdj = await page.inputValue('#taxAdj');
  addTaxes = await page.inputValue('#addTaxes');
  check('Pasting multi-spaced New Tax updates Tax Adj to USD250.00 (150AE + 100F6)', netTaxAdj === 'USD250.00', netTaxAdj);
  check('Add Taxes contains USD150.00AE/USD100.00F6', addTaxes === 'USD150.00AE/USD100.00F6', addTaxes);

  // Edit back to original New Tax
  await page.fill('#newTax', 'USD700YQ/USD200AE');
  await page.waitForTimeout(350);
  netTaxAdj = await page.inputValue('#taxAdj');
  addTaxes = await page.inputValue('#addTaxes');
  check('Restoring New Tax restores Tax Adj to USD200.00', netTaxAdj === 'USD200.00' && addTaxes === 'USD200.00YQ', netTaxAdj);

  // ==========================================================================
  // SCENARIO 4: SUMMARY RENDERING & REVERSE FCS PARSING
  // ==========================================================================
  console.log('\n--- SCENARIO 4: Summary Rendering & Reverse FCS Updates ---');
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  let isSummaryVisible = await page.isVisible('#summaryContent');
  check('Summary table is displayed upon clicking Summarise', isSummaryVisible, String(isSummaryVisible));

  let headerTh = await page.$eval('#summary table thead tr th:first-child', el => el.textContent.trim());
  check('Initial Summary Header is default "Booking class"', headerTh === 'Booking class', headerTh);

  // Now enter Fare Calculation String in reverse order
  if (await page.$eval('#parserCollapsible', el => el.classList.contains('collapsed'))) {
    await page.click('#parserToggleBtn');
    await page.waitForTimeout(100);
  }
  await page.fill('#fareCalcString', 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM 404.56XWEEFIN1/NDC2 Q5.00 NUC511.77 ROE90.3344456');
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  headerTh = await page.$eval('#summary table thead tr th:first-child', el => el.textContent.trim());
  check('Adding FCS dynamically updates Summary Header to "Booking class : Outbound T & Inbound X"', headerTh === 'Booking class : Outbound T & Inbound X', headerTh);

  // Edit FCS to single leg: Outbound Y
  await page.fill('#fareCalcString', 'DXB EK LON 200.00YLEEPIN1 NUC200.00 ROE3.6725');
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  headerTh = await page.$eval('#summary table thead tr th:first-child', el => el.textContent.trim());
  check('Editing FCS updates Summary Header to "Booking class : Outbound Y"', headerTh === 'Booking class : Outbound Y', headerTh);

  // ==========================================================================
  // SCENARIO 5: K3 GST CABIN & CHECKBOX ZIG-ZAG TOGGLING
  // ==========================================================================
  console.log('\n--- SCENARIO 5: K3 GST Cabin & Checkbox Zig-Zag Toggling ---');
  await page.selectOption('#cabin', 'economy'); // 5%
  await page.check('#applyK3OnFareDiff'); // 5% of 205 = 10.25 -> USD10.25
  await page.waitForTimeout(350);

  let k3Tax = await page.inputValue('#k3Tax');
  let perPax = await page.inputValue('#perPax');
  check('Economy (5%) K3 on Fare Diff (205) = USD10.25', k3Tax === 'USD10.25', k3Tax);
  check('Per Pax includes K3 (205 + 200 tax + 10.25 K3 = USD415.25)', perPax === 'USD415.25', perPax);

  // Switch to Business (18%)
  await page.selectOption('#cabin', 'business'); // 18% of 205 = 36.9 -> USD36.90
  await page.waitForTimeout(350);
  k3Tax = await page.inputValue('#k3Tax');
  perPax = await page.inputValue('#perPax');
  check('Switching Cabin to Business (18%) dynamically updates K3 to USD36.90', k3Tax === 'USD36.90', k3Tax);
  check('Per Pax updates to USD441.90 (205 + 200 tax + 36.90 K3)', perPax === 'USD441.90', perPax);

  // Switch back to Economy (5%)
  await page.selectOption('#cabin', 'economy');
  await page.waitForTimeout(350);
  k3Tax = await page.inputValue('#k3Tax');
  check('Switching Cabin back to Economy restores K3 to USD10.25', k3Tax === 'USD10.25', k3Tax);

  // ==========================================================================
  // SCENARIO 6: MANUAL DUAL-CURRENCY OVERWRITE & REVERT
  // ==========================================================================
  console.log('\n--- SCENARIO 6: Manual Dual-Currency Overwrite, Edit, & Revert ---');
  // Reset Currency to USD
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('USD Base Fares (100 -> 200) gives Fare Diff USD100.00', fareDiff === 'USD100.00', fareDiff);
  check('Base Badge shows Base: USD100.00', badge === 'Base: USD100.00', badge);

  // Manual Overwrite to INR 8500
  await page.fill('#fareDiff', 'INR8500');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  perPax = await page.inputValue('#perPax');
  check('Manual Fare Diff keeps INR8500', fareDiff === 'INR8500', fareDiff);
  check('Base Badge retains Base: USD100.00', badge === 'Base: USD100.00', badge);
  check('Per Pax switches to INR currency', perPax.startsWith('INR'), perPax);

  // Edit manual value to INR 8900
  await page.fill('#fareDiff', 'INR8900');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  check('Editing manual value updates Fare Diff to INR8900', fareDiff === 'INR8900', fareDiff);

  // Edit back to INR 8500
  await page.fill('#fareDiff', 'INR8500');
  await page.waitForTimeout(350);
  fareDiff = await page.inputValue('#fareDiff');
  check('Editing manual value back updates Fare Diff to INR8500', fareDiff === 'INR8500', fareDiff);

  // Clear Fare Diff and blur to trigger automatic revert to base
  await page.fill('#fareDiff', '');
  await page.evaluate(() => document.getElementById('fareDiff').blur());
  await page.waitForTimeout(200);
  fareDiff = await page.inputValue('#fareDiff');
  badge = await page.textContent('#baseFareDiffBadge');
  check('Clearing Fare Diff field automatically reverts to base USD100.00', fareDiff === 'USD100.00', fareDiff);
  check('Base Badge shows Base: USD100.00', badge === 'Base: USD100.00', badge);

  // ==========================================================================
  // SCENARIO 7: MULTI-PTC SWITCHING & ISOLATION
  // ==========================================================================
  console.log('\n--- SCENARIO 7: Multi-PTC Tab Switching & Dynamic Consolidation ---');
  // ADT has USD 100 diff
  // Switch to CNN
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(150);
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '50');
  await page.fill('#newFare', '120');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  const cnnDiff = await page.inputValue('#fareDiff');
  check('Child (CNN) tab calculates independent Fare Diff USD70.00', cnnDiff === 'USD70.00', cnnDiff);

  // Switch back to ADT
  await page.click('#ptcTabADT');
  await page.waitForTimeout(150);
  const adtDiffAfterSwitch = await page.inputValue('#fareDiff');
  check('Adult (ADT) tab preserves USD100.00 on switch back', adtDiffAfterSwitch === 'USD100.00', adtDiffAfterSwitch);

  // Edit ADT New Fare to 250 (diff 150)
  await page.fill('#newFare', '250');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  const adtDiffUpdated = await page.inputValue('#fareDiff');
  check('ADT New Fare edit updates Fare Diff to USD150.00', adtDiffUpdated === 'USD150.00', adtDiffUpdated);

  // Summarise Multi-PTC
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  const summaryHeaders = await page.$$eval('#summary table thead tr th', ths => ths.map(t => t.textContent.trim()));
  console.log('Multi-PTC Summary Headers:', summaryHeaders);
  check('Summary table has columns for Adult and Child', summaryHeaders.includes('Adult') && summaryHeaders.includes('Child'), JSON.stringify(summaryHeaders));

  console.log(`\n========================================================================`);
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED | ${errors.length} CONSOLE ERRORS`);
  console.log(`========================================================================`);

  assert.strictEqual(failed, 0, 'All irregular sequence tests must pass');
  assert.strictEqual(errors.length, 0, 'Zero console errors allowed');

  await browser.close();
})();
