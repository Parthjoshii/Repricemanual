const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  console.log('========================================================================');
  console.log('VERIFYING STOPOVER CHARGES, SELECTIVE HALVING, K3 ON FEE, & DISCLAIMER');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function closeModalIfOpen() {
    if (await page.isVisible('#errorModal.show')) {
      const msg = await page.textContent('#modalMessage');
      console.log('Dismissed modal message:', msg);
      await page.evaluate(() => closeErrorModal());
      await page.waitForTimeout(100);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Stopover (1S) Charges Identification & Exact NUC Validation
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: User Example String with Multiple Stopovers (1S) ---');
  const userFcs = 'CE EK DXB EK SEZ HM PRI384.92TLEEPIT1/ITN2 HM X/SEZ EK X/DXB EK VCE563.74KLEESIT1/ITN2 1S57.59 1S34.00 NUC1040.25END ROE0.868150';
  await page.fill('#fareCalcString', userFcs);
  await page.waitForTimeout(100);

  // Check badge shows 2 components detected
  const badgeText = await page.textContent('#fareComponentDetectorBadge');
  console.log('Detector Badge:', badgeText);
  assert.strictEqual(badgeText, '2 Components Detected');

  // Convert
  await page.click('#parseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  // Verify Stopover Charges list is visible and has 57.59 and 34.00
  const stopoverVisible = await page.isVisible('#stopoverChargesSection');
  assert.ok(stopoverVisible, 'Stopover charges section should be visible');
  const stopoverItems = await page.$$eval('#stopoverCharges li', lis => lis.map(l => l.textContent.trim()));
  console.log('Stopover items:', stopoverItems);
  assert.deepStrictEqual(stopoverItems, ['57.59', '34.00']);

  // Verify Calculated NUC = 1040.25 (384.92 + 563.74 + 57.59 + 34.00)
  const calcNucText = await page.textContent('#calculatedNuc');
  console.log('Calculated NUC:', calcNucText);
  assert.ok(calcNucText.includes('1040.25'), 'Calculated NUC should be 1040.25');
  assert.ok(calcNucText.includes('57.59 + 34.00'), 'Breakdown should include stopover amounts');

  // Verify NUC Validation passes!
  const nucValidationText = await page.textContent('#nucValidation');
  console.log('NUC Validation:', nucValidationText);
  assert.ok(nucValidationText.includes('PASS'), 'NUC Validation should PASS with stopovers included');
  console.log('✓ TEST 1 passed: Stopovers identified and NUC validated successfully.');

  // -------------------------------------------------------------------------
  // TEST 2: Stopovers Unscaled During Auto-Calculate from Adult
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Auto-Calculate to Child (CNN) with Unscaled Stopovers ---');
  await page.click('#ptcTabCHD, #ptcTabCNN');
  await page.waitForTimeout(150);

  // Check Auto-calculate from Adult
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(250);
  await closeModalIfOpen();

  const cnnFcs = await page.inputValue('#fareCalcString');
  console.log('Derived CNN String:', cnnFcs);
  // Fare components scaled by 75%: 384.92*0.75=288.69, 563.74*0.75=422.81
  assert.ok(cnnFcs.includes('288.69TLEEPIT1CH'), 'First component scaled to 288.69 with CH suffix');
  assert.ok(cnnFcs.includes('422.81KLEESIT1CH'), 'Second component scaled to 422.81 with CH suffix');
  // Stopovers MUST remain unscaled: 1S57.59 and 1S34.00
  assert.ok(cnnFcs.includes('1S57.59'), 'Stopover 1S57.59 must remain identical/unscaled');
  assert.ok(cnnFcs.includes('1S34.00'), 'Stopover 1S34.00 must remain identical/unscaled');
  // Recomputed NUC: 288.69 + 422.81 + 57.59 + 34.00 = 803.09
  assert.ok(cnnFcs.includes('NUC803.09END'), 'Recomputed NUC must be 803.09 (288.69 + 422.81 + 57.59 + 34.00)');

  const cnnValidationText = await page.textContent('#nucValidation');
  assert.ok(cnnValidationText.includes('PASS'), 'Derived CNN string must PASS NUC validation');
  console.log('✓ TEST 2 passed: Stopovers remain 100% unscaled for Child/Auto-calc.');

  // -------------------------------------------------------------------------
  // TEST 3: Selective Fare Component Halving
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Selective Fare Component Halving ---');
  await page.click('#ptcTabADT');
  await page.waitForTimeout(150);

  // Check Halve Fare Components
  await page.check('#halveFareComponents');
  await page.waitForTimeout(150);

  // Selector should be visible with options
  const selectorVisible = await page.isVisible('#halveComponentSelector');
  assert.ok(selectorVisible, 'Halve component selector should be visible');

  // Verify option labels: All, Component 1, Component 2
  const optionLabels = await page.$$eval('#halveComponentOptions .halve-chip span', spans => spans.map(s => s.textContent.trim()));
  console.log('Halve Options:', optionLabels);
  assert.ok(optionLabels.some(l => l.includes('All Components')));
  assert.ok(optionLabels.some(l => l.includes('Component 1: 384.92')));
  assert.ok(optionLabels.some(l => l.includes('Component 2: 563.74')));

  // Case 3a: Select Component 1 only
  console.log('Selecting Component 1 only...');
  await page.click('input[name="halveComponentChoice"][value="0"]');
  await page.waitForTimeout(200);

  let compItems = await page.$$eval('#fareComponents li', lis => lis.map(l => l.textContent.trim()));
  console.log('Component 1 halved items:', compItems);
  assert.ok(compItems[0].includes('192.46') && compItems[0].includes('1/2 Halved'), 'Component 1 should be halved (192.46)');
  assert.ok(compItems[1].includes('563.74') && !compItems[1].includes('Halved'), 'Component 2 should remain full (563.74)');
  // NUC = 192.46 + 563.74 + 57.59 + 34.00 = 847.79
  let nucVal3a = await page.textContent('#calculatedNuc');
  console.log('NUC for Component 1 halved:', nucVal3a);
  assert.ok(nucVal3a.includes('847.79'), 'Calculated NUC should be 847.79');
  let corrected3a = await page.textContent('#nucValidation');
  assert.ok(corrected3a.includes('PRI192.46TLEEPIT1'), 'Corrected string should halve Component 1');
  assert.ok(corrected3a.includes('VCE563.74KLEESIT1'), 'Corrected string should keep Component 2 full');
  assert.ok(corrected3a.includes('NUC847.79END'), 'Corrected string should have NUC847.79END');

  // Case 3b: Select Component 2 only
  console.log('Selecting Component 2 only...');
  await page.click('input[name="halveComponentChoice"][value="1"]');
  await page.waitForTimeout(200);

  compItems = await page.$$eval('#fareComponents li', lis => lis.map(l => l.textContent.trim()));
  console.log('Component 2 halved items:', compItems);
  assert.ok(compItems[0].includes('384.92') && !compItems[0].includes('Halved'), 'Component 1 should remain full (384.92)');
  assert.ok(compItems[1].includes('281.87') && compItems[1].includes('1/2 Halved'), 'Component 2 should be halved (281.87)');
  // NUC = 384.92 + 281.87 + 57.59 + 34.00 = 758.38
  let nucVal3b = await page.textContent('#calculatedNuc');
  console.log('NUC for Component 2 halved:', nucVal3b);
  assert.ok(nucVal3b.includes('758.38'), 'Calculated NUC should be 758.38');

  // Verify raw textarea remains pristine
  const pristineInput = await page.inputValue('#fareCalcString');
  assert.strictEqual(pristineInput, userFcs, 'Raw input string in textarea must remain 100% pristine');
  console.log('✓ TEST 3 passed: Selective fare component halving works with pristine input retention.');

  // -------------------------------------------------------------------------
  // TEST 4: K3 on Change Fee Routing & Balance
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: K3 on Change Fee Routing ---');
  // Clear and setup fresh calculation on ADT
  await page.selectOption('#currency', 'INR');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '2000'); // Diff = 1000
  await page.fill('#changeFee', '9000');
  await page.selectOption('#cabin', 'economy'); // 5% K3
  await page.check('#applyK3OnChangeFee'); // K3 on fee = 450
  await page.uncheck('#applyK3OnFareDiff');
  await page.fill('#oldTax', '');
  await page.fill('#newTax', '');

  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  // Verify Add Taxes does NOT contain Change Fee K3 (INR450K3)
  const addTaxesVal = await page.inputValue('#addTaxes');
  console.log('Add Taxes:', addTaxesVal);
  assert.ok(!addTaxesVal.includes('450K3'), 'Add Taxes must NOT contain change fee K3');

  // Tax Adj must be 0 (no taxes and no fare diff K3)
  const taxAdjVal = await page.inputValue('#taxAdj');
  console.log('Tax Adj:', taxAdjVal);
  assert.strictEqual(taxAdjVal, 'INR0', 'Tax Adj should be INR0');

  // Per Pax = Diff(1000) + FeeWithK3(9450) + TaxAdj(0) = 10450
  const perPaxVal = await page.inputValue('#perPax');
  console.log('Per Pax:', perPaxVal);
  assert.strictEqual(perPaxVal, 'INR10450', 'Per Pax should be INR10450');

  // Generate Summary and verify Change Fee row has (incl. of K3)
  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const changeFeeSummaryText = await page.$eval('#summary table tr:nth-child(4) td:nth-child(2)', el => el.textContent.trim());
  console.log('Summary Change Fee row:', changeFeeSummaryText);
  assert.strictEqual(changeFeeSummaryText, 'INR9450 (incl. of K3)');

  const gdsCommand = await page.inputValue('#gdsString');
  console.log('GDS Command String:', gdsCommand);
  assert.strictEqual(gdsCommand, 'FARE DIFF INR1000 + CHG FEE INR9450 + TAX INR0 = INR10450');
  console.log('✓ TEST 4 passed: K3 on Change Fee routed to fee amount and summary labeled (incl. of K3).');

  // -------------------------------------------------------------------------
  // TEST 5: Disclaimer Row Centered Inside Summary Table
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Disclaimer Row Centered Inside Summary Table ---');
  // Check that the disclaimer is a tr/td inside the table
  const disclaimerCell = await page.$('#summary table tbody tr.summary-disclaimer-cell, #summary table tbody tr td.summary-disclaimer-cell');
  assert.ok(disclaimerCell, 'Disclaimer must be inside the table');

  const disclaimerText = await page.textContent('.summary-disclaimer-cell');
  console.log('Disclaimer cell text:', disclaimerText);
  assert.ok(disclaimerText.includes('fares are not guaranteed until ticketed'));

  // Ensure NO separate disclaimer div outside the table
  const outsideDisclaimer = await page.$('#summary > div.summary-disclaimer');
  assert.strictEqual(outsideDisclaimer, null, 'No disclaimer div should exist outside the table');

  // Check clipboard HTML formatting includes table disclaimer
  const clipboardHtml = await page.evaluate(() => buildSummaryHtmlForClipboard(document.querySelectorAll('#summary table')));
  assert.ok(clipboardHtml.includes('fares are not guaranteed until ticketed'), 'Clipboard HTML must include centered table disclaimer row');
  console.log('✓ TEST 5 passed: Disclaimer row is centered inside the table.');

  console.log('\n========================================================================');
  console.log('ALL 5 TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');

  await browser.close();
})().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
