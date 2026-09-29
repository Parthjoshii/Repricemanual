const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2] || 'index.html').replace(/\\/g, '/');

let browser;
(async () => {
  console.log('================================================================');
  console.log('VERIFYING TST CREATOR (TRANSACTIONAL STORED TICKET) SUITE');
  console.log('================================================================');

  browser = await chromium.launch();
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Dismiss error modal if open
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  // --- Step 1: Perform Calculation & Summarise ---
  console.log('\n--- 1. CALCULATING FARE AND GENERATING SUMMARY ---');
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '150');
  await page.fill('#newFare', '350');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  const fcsInput = 'BOM EK DXB350.00TLEIPCA1/NDC2 NUC350.00END ROE1.000000';
  await page.fill('#fareCalcString', fcsInput);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  await page.click('#summariseButton');
  await page.waitForTimeout(250);

  // Check Create TST button is visible
  const createTstBtn = page.locator('#createTstButton');
  assert.ok(await createTstBtn.isVisible(), 'Create TST button must be visible after summarise');
  console.log('✓ Create TST button is present and visible');

  // --- Step 2: Click Create TST & Verify Automated Population ---
  console.log('\n--- 2. CLICKING CREATE TST AND VERIFYING DATA POPULATION ---');
  await createTstBtn.click();
  await page.waitForTimeout(250);

  const tstSection = page.locator('#tstSection');
  assert.ok(await tstSection.isVisible(), 'TST Creator section must be displayed');
  console.log('✓ TST Creator section displayed successfully');

  // Rule: Remove title 'OLD TICKET COUPON'
  const htmlContent = await page.content();
  assert.ok(!htmlContent.includes('OLD TICKET COUPON'), 'Title "OLD TICKET COUPON" must NOT appear in the page');
  console.log('✓ "OLD TICKET COUPON" title is confirmed absent');

  // Rule: Tourcode should be blank always
  const tourCodeVal = await page.inputValue('#tstTourCode');
  assert.strictEqual(tourCodeVal, '', 'Tour code must be blank always');
  console.log('✓ Tour code is verified blank');

  // Rule: Rate of exchange should be the same as ROE in FCS
  const roeVal = await page.inputValue('#tstRoe');
  console.log('TST ROE:', roeVal);
  assert.strictEqual(roeVal, '1.000000', `ROE should be 1.000000 matching FCS, got ${roeVal}`);
  console.log('✓ ROE matches Fare Calculation String ROE exactly');

  // Verify Base Fare populated
  const baseFareVal = await page.inputValue('#tstBaseFare');
  console.log('TST Base Fare:', baseFareVal);
  assert.ok(baseFareVal.includes('350.00'), `Base fare should be populated with 350.00, got ${baseFareVal}`);

  // Verify Total Amount populated
  const totalVal = await page.inputValue('#tstTotalAmount');
  console.log('TST Total Amount:', totalVal);
  assert.ok(totalVal.includes('200.00'), `Total amount should be populated, got ${totalVal}`);

  // Verify Fare Calc String populated
  const tstFcsVal = await page.inputValue('#tstFareCalcString');
  console.log('TST FCS:', tstFcsVal);
  assert.ok(tstFcsVal.includes('BOM EK DXB350.00'), `FCS should match calculation input, got ${tstFcsVal}`);

  // --- Step 3: Test Dynamic FCS ROE Synchronization ---
  console.log('\n--- 3. TESTING DYNAMIC FCS ROE SYNCHRONIZATION ---');
  await page.fill('#tstFareCalcString', 'LON BA NYC500.00 NUC500.00END ROE1.361492');
  await page.waitForTimeout(100);
  const updatedRoe = await page.inputValue('#tstRoe');
  assert.strictEqual(updatedRoe, '1.361492', `ROE should dynamically synchronize to 1.361492, got ${updatedRoe}`);
  console.log('✓ Dynamic FCS ROE synchronization verified');

  // --- Step 4: Test 'Copy Taxes' Button & PD Formatting Rule ---
  console.log('\n--- 4. TESTING COPY TAXES BUTTON AND PAID "PD" RULE ---');
  // Scenario: Old tax has Paid 'PD' tax values & in new taxes there is no difference in the values
  await page.fill('#oldTax', 'PD123YA PD456AE');
  await page.fill('#newTax', '123YA 456AE 50ZR');
  await page.waitForTimeout(100);

  // Check getTstTaxesList evaluates correctly
  const evaluatedTaxes = await page.evaluate(() => getTstTaxesList());
  console.log('Evaluated TST Taxes:', evaluatedTaxes);
  assert.deepStrictEqual(evaluatedTaxes, ['PD123YA', 'PD456AE', '50ZR'],
    'Unchanged taxes with old PD must format as PD123YA, new/different taxes format without PD');

  // Click Copy Taxes button
  await page.click('#tstCopyTaxesBtn');
  await page.waitForTimeout(200);

  // Close modal if appeared
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  // Verify copied taxes for column pasting
  const copiedTaxes = await page.evaluate(() => state.lastCopiedTstTaxes);
  console.log('Copied Taxes in Clipboard:\n', copiedTaxes);
  assert.strictEqual(copiedTaxes, 'PD123YA\nPD456AE\n50ZR', 'Copied taxes should be newline-separated for TST tax column');
  console.log('✓ Copy Taxes newline formatting for TST column verified');

  // Also verify #tstTaxes input field contains space-separated preview
  const tstTaxesPreview = await page.inputValue('#tstTaxes');
  assert.strictEqual(tstTaxesPreview, 'PD123YA PD456AE 50ZR', 'TST Taxes input should contain formatted list');
  console.log('✓ TST Taxes input preview verified');

  // --- Step 5: Test Hard Copy-Paste Rule for Form Fields ---
  console.log('\n--- 5. TESTING HARD COPY-PASTE RULE FOR IN-HOUSE TOOL ---');
  await page.fill('#tstTourCode', 'SHOULD_STAY_BLANK'); // verify tour code isolation
  await page.click('#tstCopyBtn');
  await page.waitForTimeout(200);

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  const copiedTstRecord = await page.evaluate(() => state.lastCopiedTstRecord);
  console.log('Copied TST Record (TSV):\n', JSON.stringify(copiedTstRecord));

  const tsvFields = copiedTstRecord.split('\t');
  console.log('TSV Fields count:', tsvFields.length);
  assert.strictEqual(tsvFields.length, 9, 'Must have exactly 9 tab-separated fields');

  // Fields: [baseFare, equivFare, roe, total, tourCode, milesPoints, orgDest, fcs, fe]
  console.log('Field 1 (BASE FARE):', tsvFields[0]);
  console.log('Field 2 (EQUIV FARE):', tsvFields[1]);
  console.log('Field 3 (ROE):', tsvFields[2]);
  console.log('Field 4 (TOTAL):', tsvFields[3]);
  console.log('Field 5 (TOUR CODE):', JSON.stringify(tsvFields[4]));
  console.log('Field 6 (MILES/POINTS):', tsvFields[5]);
  console.log('Field 7 (ORG/DEST):', tsvFields[6]);
  console.log('Field 8 (FCS):', tsvFields[7]);
  console.log('Field 9 (ENDORSEMENTS):', tsvFields[8]);

  assert.ok(tsvFields[0].includes('350.00'), 'Field 1 must be Base Fare');
  assert.strictEqual(tsvFields[2], '1.361492', 'Field 3 must match FCS ROE');
  assert.strictEqual(tsvFields[4], '', 'Field 5 (Tour Code) must be blank always');
  assert.strictEqual(tsvFields[6], 'BOM/DXB', 'Field 7 must be Org/Dest');
  assert.ok(tsvFields[7].includes('ROE1.361492'), 'Field 8 must be FCS');
  assert.ok(tsvFields[8].includes('NON-REF'), 'Field 9 must be Endorsements');
  console.log('✓ Hard copy-paste rule for external tool verified with 9 tab-separated fields');

  // --- Step 6: Test Fare Basis Splitting Logic & Copy Buttons ---
  console.log('\n--- 6. TESTING FARE BASIS SPLITTING & COPY (SCENARIOS 1 & 2) ---');
  // Scenario 1: QHAMPIE1/VFN2 -> FB1=QHAMPIE1, FB2=VFN2
  const s1 = await page.evaluate(() => splitFareBasis('QHAMPIE1/VFN2'));
  console.log('Scenario 1 split:', s1);
  assert.strictEqual(s1.fb1, 'QHAMPIE1', 'FB1 must be QHAMPIE1');
  assert.strictEqual(s1.fb2, 'VFN2', 'FB2 must be VFN2');
  assert.strictEqual(s1.fb3, '', 'FB3 must be empty');
  assert.strictEqual(s1.tsv, 'QHAMPIE1\tVFN2', 'TSV must be QHAMPIE1\\tVFN2');
  console.log('✓ Scenario 1 (QHAMPIE1/VFN2) verified');

  // Scenario 2: QHAMPIE1CH/VFN2 -> FB1=QHAMPIE1, FB2=CH, FB3=VFN2
  const s2 = await page.evaluate(() => splitFareBasis('QHAMPIE1CH/VFN2'));
  console.log('Scenario 2 split:', s2);
  assert.strictEqual(s2.fb1, 'QHAMPIE1', 'FB1 must be QHAMPIE1');
  assert.strictEqual(s2.fb2, 'CH', 'FB2 must be CH');
  assert.strictEqual(s2.fb3, 'VFN2', 'FB3 must be VFN2');
  assert.strictEqual(s2.tsv, 'QHAMPIE1\tCH\tVFN2', 'TSV must be QHAMPIE1\\tCH\\tVFN2');
  console.log('✓ Scenario 2 (QHAMPIE1CH/VFN2) verified');

  // Test Row 1 button click
  await page.fill('.tst-coupon-row:nth-child(1) .tst-fb1', 'QHAMPIE1');
  await page.fill('.tst-coupon-row:nth-child(1) .tst-fb2', 'CH');
  await page.fill('.tst-coupon-row:nth-child(1) .tst-fb3', 'VFN2');
  await page.click('.tst-coupon-row:nth-child(1) .tst-copy-row-fb-btn');
  await page.waitForTimeout(100);
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }
  const copiedRowFb = await page.evaluate(() => state.lastCopiedFareBasis);
  assert.strictEqual(copiedRowFb, 'QHAMPIE1\tCH\tVFN2', 'Row 1 copy button must copy split Fare Basis');
  console.log('✓ Per-coupon row Copy Fare Basis button verified');

  // Test Copy All Fare Basis button
  if (await page.locator('.tst-coupon-row').count() < 2) {
    await page.click('#tstAddCouponBtn');
    await page.waitForTimeout(50);
  }
  await page.fill('.tst-coupon-row:nth-child(2) .tst-fb1', 'QHAMPIE1');
  await page.fill('.tst-coupon-row:nth-child(2) .tst-fb2', 'VFN2');
  await page.click('#tstCopyFareBasisBtn');
  await page.waitForTimeout(100);
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }
  const copiedAllFb = await page.evaluate(() => state.lastCopiedFareBasis);
  assert.ok(copiedAllFb.includes('QHAMPIE1\tCH\tVFN2'), 'Copy All must include Coupon 1');
  assert.ok(copiedAllFb.includes('QHAMPIE1\tVFN2'), 'Copy All must include Coupon 2');
  console.log('✓ Copy All Fare Basis button verified');

  // --- Step 7: Coupon Table and Manipulations ---
  console.log('\n--- 7. TESTING FLIGHT COUPONS AND GDS OUTPUT ---');
  await page.click('#tstAddCouponBtn');
  await page.waitForTimeout(100);
  const rowCountAfterAdd = await page.locator('.tst-coupon-row').count();
  assert.strictEqual(rowCountAfterAdd, 3, 'Row count should increase to 3');

  await page.click('#tstGenerateBtn');
  await page.waitForTimeout(200);
  const tstText = await page.inputValue('#tstOutput');
  assert.ok(tstText.includes('TRANSACTIONAL STORED TICKET'), 'GDS text contains header');
  assert.ok(tstText.includes('ROE  : 1.361492'), 'GDS text contains synchronized ROE');
  console.log('✓ GDS formatted record verified');

  // --- Step 8: Theme Compatibility ---
  console.log('\n--- 8. TESTING THEME COMPATIBILITY ---');
  await page.click('#themeToggle'); // Switch to light
  await page.waitForTimeout(150);
  const tstCardBgLight = await page.evaluate(() => getComputedStyle(document.querySelector('.tst-card')).backgroundColor);
  console.log('Light Mode TST Card BG:', tstCardBgLight);

  await page.click('#themeToggle'); // Switch back to dark
  await page.waitForTimeout(150);
  const tstCardBgDark = await page.evaluate(() => getComputedStyle(document.querySelector('.tst-card')).backgroundColor);
  console.log('Dark Mode TST Card BG:', tstCardBgDark);

  console.log('\nCONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Zero console errors expected');

  console.log('\n================================================================');
  console.log('ALL TST CREATOR TESTS PASSED 100%!');
  console.log('================================================================');

  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
