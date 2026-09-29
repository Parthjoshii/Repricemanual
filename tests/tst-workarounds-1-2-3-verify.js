const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2] || 'index.html').replace(/\\/g, '/');

let browser;
(async () => {
  console.log('================================================================');
  console.log('VERIFYING TST WORKAROUNDS 1, 2 & 3 AND SIMPLIFIED COUPONS');
  console.log('================================================================\n');

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

  async function dismissModalIfOpen() {
    if (await page.isVisible('#errorModal.show')) {
      await page.evaluate(() => closeErrorModal());
      await page.waitForTimeout(60);
    }
  }

  // --- Step 1: Input Multi-Segment FCS with 4 Flights ---
  console.log('--- 1. ENTERING MULTI-SEGMENT FCS WITH 4 FLIGHTS ---');
  await dismissModalIfOpen();
  const multiFlightFcs = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC0END ROE0.855028';
  
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '300');
  await page.fill('#newFare', '800');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  await page.fill('#fareCalcString', multiFlightFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(100);

  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  // Click Create TST
  await page.click('#createTstButton');
  await page.waitForTimeout(250);

  // --- Step 2: Verify Simplified Coupon Rows (Only FB1, FB2, FB3 Displayed) ---
  console.log('\n--- 2. VERIFYING SIMPLIFIED COUPON TABLE (ONLY FB1, FB2, FB3 DISPLAYED) ---');
  const rows = await page.locator('.tst-coupon-row').all();
  assert.strictEqual(rows.length, 4, `Expected 4 flight rows, got ${rows.length}`);

  // Verify fictitious flight details (date, baggage, validity, brand, emd) are NOT visible inputs in table
  const hasEmdInput = await page.locator('.tst-coupon-table input.tst-emd').count();
  assert.strictEqual(hasEmdInput, 0, 'EMD input must NOT be present in simplified coupon table');
  const hasBaggageInput = await page.locator('.tst-coupon-table input.tst-baggage').count();
  assert.strictEqual(hasBaggageInput, 0, 'Baggage input must NOT be present in simplified coupon table');
  const hasValidityInput = await page.locator('.tst-coupon-table input.tst-validity').count();
  assert.strictEqual(hasValidityInput, 0, 'Validity input must NOT be present in simplified coupon table');

  // Verify visible columns: CPN, Flight Route, FB1, FB2, FB3
  for (let i = 0; i < 4; i++) {
    const row = rows[i];
    const fb1Val = await row.locator('.tst-fb1').inputValue();
    const fb2Val = await row.locator('.tst-fb2').inputValue();
    const fb3Val = await row.locator('.tst-fb3').inputValue();
    console.log(`Coupon ${i + 1}: FB1="${fb1Val}", FB2="${fb2Val}", FB3="${fb3Val}"`);

    if (i < 2) {
      assert.strictEqual(fb1Val, 'QHAMPIE1', `Coupon ${i + 1} FB1 must be QHAMPIE1`);
      assert.strictEqual(fb2Val, 'VFN2', `Coupon ${i + 1} FB2 must be VFN2`);
    } else {
      assert.strictEqual(fb1Val, 'UHEESIE1', `Coupon ${i + 1} FB1 must be UHEESIE1`);
      assert.strictEqual(fb2Val, 'VFN2', `Coupon ${i + 1} FB2 must be VFN2`);
    }
  }
  console.log('✓ All 4 coupons only display FB1, FB2, FB3 cleanly without fictitious details');

  // --- Step 3: Test Workaround 1 (Column & Grid Copy) ---
  console.log('\n--- 3. TESTING WORKAROUND 1: COLUMN / GRID COPY ---');
  await dismissModalIfOpen();
  // Copy FB1 Column
  await page.click('#w1CopyFb1Btn');
  await page.waitForTimeout(60);
  const fb1Col = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(fb1Col, 'QHAMPIE1\nQHAMPIE1\nUHEESIE1\nUHEESIE1', 'FB1 Column copy must match');
  console.log('✓ W1 Copy FB1 Column passed');

  // Copy FB2 Column
  await dismissModalIfOpen();
  await page.click('#w1CopyFb2Btn');
  await page.waitForTimeout(60);
  const fb2Col = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(fb2Col, 'VFN2\nVFN2\nVFN2\nVFN2', 'FB2 Column copy must match');
  console.log('✓ W1 Copy FB2 Column passed');

  // Copy FB (Tab+Line)
  await dismissModalIfOpen();
  await page.click('#w1CopyFbTabLineBtn');
  await page.waitForTimeout(60);
  const fbTabCol = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(fbTabCol, 'QHAMPIE1\tVFN2\nQHAMPIE1\tVFN2\nUHEESIE1\tVFN2\nUHEESIE1\tVFN2', 'FB Tab+Line copy must match');
  console.log('✓ W1 Copy FB (Tab+Line) passed');

  // Copy FARE Fields
  await dismissModalIfOpen();
  await page.click('#w1CopyFareFieldsBtn');
  await page.waitForTimeout(60);
  const fareFields = (await page.evaluate(() => navigator.clipboard.readText()));
  const fTokens = fareFields.split('\t');
  assert.strictEqual(fTokens.length, 9, `Expected 9 fields in FARE block, got ${fTokens.length}`);
  assert.strictEqual(fTokens[2], '0.855028', 'ROE must match FCS');
  assert.strictEqual(fTokens[6], 'DUB/COK', 'Org/Dest must match');
  console.log('✓ W1 Copy FARE Fields passed');

  // --- Step 4: Test Workaround 2 (Win + V Clipboard History Auto-Prep) ---
  console.log('\n--- 4. TESTING WORKAROUND 2: WIN + V HISTORY AUTO-PREP ---');
  await dismissModalIfOpen();
  // Switch to Workaround 2 Tab
  await page.click('#tabWorkaround2');
  await page.waitForTimeout(100);
  assert.ok(await page.isVisible('#panelWorkaround2'), 'Panel Workaround 2 must be visible');

  // Verify preview items list
  const previewItemsCount = await page.locator('#tstWinVPreviewList .tst-winv-item').count();
  console.log(`Win+V preview items count: ${previewItemsCount}`);
  assert.ok(previewItemsCount >= 10, 'Expected at least 10 items queued for Win+V clipboard history');

  // Click Auto-Prep Win + V button
  await dismissModalIfOpen();
  await page.click('#tstPrepWinVBtn');
  await page.waitForTimeout(200);

  // Verify progress wrapper is displayed
  assert.ok(await page.isVisible('#tstWinVProgressWrapper'), 'Win+V progress wrapper must display during prep');

  // Wait for prep completion (queue finishes in ~3s)
  await page.waitForFunction(() => {
    const txt = document.getElementById('tstWinVProgressText')?.textContent || '';
    return txt.includes('All') && txt.includes('loaded');
  }, { timeout: 10000 });

  const progressStatus = await page.textContent('#tstWinVProgressText');
  console.log(`Progress status: "${progressStatus}"`);
  assert.ok(progressStatus.includes('All') && progressStatus.includes('loaded'), 'Win+V prep must complete 100%');

  // Verify success modal displayed without error
  await page.waitForTimeout(200);
  const modalMsg = await page.textContent('#modalMessage');
  console.log(`Modal message after Win+V prep: "${modalMsg}"`);
  assert.ok(modalMsg.includes('Windows Clipboard History ready'), 'Success modal must be displayed without errors');
  const isSuccessModal = await page.evaluate(() => document.querySelector('#errorModal .modal-box')?.classList.contains('success'));
  assert.ok(isSuccessModal, 'Modal must have success class');

  // In reverse order, top item written last to clipboard is FB1 (QHAMPIE1)
  const lastCopiedItem = await page.evaluate(() => navigator.clipboard.readText());
  console.log(`Top item in clipboard for Win+V: "${lastCopiedItem}"`);
  assert.strictEqual(lastCopiedItem, 'QHAMPIE1', 'Top item in clipboard for Win+V should be FB1');
  console.log('✓ W2 Auto-Prep Win + V Clipboard History verified');

  // --- Step 5: Test Workaround 3 (Rapid Click-to-Copy Assistant) ---
  console.log('\n--- 5. TESTING WORKAROUND 3: RAPID CLICK-TO-COPY ASSISTANT ---');
  await dismissModalIfOpen();
  // Switch to Workaround 3 Tab
  await page.click('#tabWorkaround3');
  await page.waitForTimeout(100);
  assert.ok(await page.isVisible('#panelWorkaround3'), 'Panel Workaround 3 must be visible');

  // Check coupon chips count (4 flights * 2 fare basis = 8 chips)
  const couponChipsCount = await page.locator('#tstRapidCouponChips .tst-chip').count();
  console.log(`Rapid coupon chips count: ${couponChipsCount}`);
  assert.strictEqual(couponChipsCount, 8, 'Expected 8 flight coupon chips (4 segments * 2 FB)');

  // Check FARE chips count (Base, ROE, Total, Org/Dest, FCS, Endorsements, Taxes etc.)
  const fareChipsCount = await page.locator('#tstRapidFareChips .tst-chip').count();
  console.log(`Rapid FARE chips count: ${fareChipsCount}`);
  assert.ok(fareChipsCount >= 6, `Expected at least 6 FARE detail chips, got ${fareChipsCount}`);

  // Verify first chip has next-in-line highlight
  const firstChip = page.locator('#tstRapidCouponChips .tst-chip').first();
  const firstChipClass = await firstChip.getAttribute('class');
  assert.ok(firstChipClass.includes('next-in-line'), 'First uncopied chip must have next-in-line class');

  // Click first chip
  await dismissModalIfOpen();
  await firstChip.click();
  await page.waitForTimeout(50);
  const firstChipAfterClick = await firstChip.getAttribute('class');
  assert.ok(firstChipAfterClick.includes('copied'), 'Clicked chip must have copied class');
  const chipCopiedVal = await page.evaluate(() => navigator.clipboard.readText());
  assert.strictEqual(chipCopiedVal, 'QHAMPIE1', 'Clicked chip must copy QHAMPIE1');
  console.log('✓ Chip click-to-copy and visual feedback verified');

  // Verify second chip now has next-in-line highlight
  const secondChip = page.locator('#tstRapidCouponChips .tst-chip').nth(1);
  const secondChipClass = await secondChip.getAttribute('class');
  assert.ok(secondChipClass.includes('next-in-line'), 'Second chip must now have next-in-line class');

  // Test "Copy Next Field" button
  await dismissModalIfOpen();
  await page.click('#tstCopyNextRapidChipBtn');
  await page.waitForTimeout(50);
  const secondChipAfterNext = await secondChip.getAttribute('class');
  assert.ok(secondChipAfterNext.includes('copied'), 'Second chip must be marked copied after Copy Next Field');
  const secondCopiedVal = await page.evaluate(() => navigator.clipboard.readText());
  assert.strictEqual(secondCopiedVal, 'VFN2', 'Second chip copied value must be VFN2');
  console.log('✓ Copy Next Field button verified');

  // Test "Reset Copied Status" button
  await dismissModalIfOpen();
  await page.click('#tstResetRapidChipsBtn');
  await page.waitForTimeout(50);
  const firstChipAfterReset = await firstChip.getAttribute('class');
  assert.ok(!firstChipAfterReset.includes('copied'), 'First chip should no longer be marked copied after reset');
  assert.ok(firstChipAfterReset.includes('next-in-line'), 'First chip should regain next-in-line after reset');
  console.log('✓ Reset Copied Status button verified');

  // --- Step 6: Test PTC Scenario (FB3 Child/Infant) ---
  console.log('\n--- 6. TESTING PTC (CH) WITH FB3 FIELD IN WORKAROUNDS ---');
  await dismissModalIfOpen();
  // Set coupon 1 FB2 to CH and FB3 to VFN2
  await page.fill('.tst-coupon-row:nth-child(1) .tst-fb2', 'CH');
  await page.fill('.tst-coupon-row:nth-child(1) .tst-fb3', 'VFN2');
  await page.waitForTimeout(50);

  // Test Row copy button on coupon 1
  await page.click('.tst-coupon-row:nth-child(1) .tst-copy-row-fb-btn');
  await page.waitForTimeout(50);
  const c1Copied = await page.evaluate(() => state.lastCopiedFareBasis);
  assert.strictEqual(c1Copied, 'QHAMPIE1\tCH\tVFN2', 'Coupon 1 row copy must produce FB1 [Tab] FB2 [Tab] FB3');

  // Test Copy FB3 Column
  await dismissModalIfOpen();
  await page.click('#tabWorkaround1');
  await page.waitForTimeout(50);
  await page.click('#w1CopyFb3Btn');
  await page.waitForTimeout(50);
  const fb3ColText = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(fb3ColText, 'VFN2\n\n\n', 'FB3 Column should contain VFN2 followed by blank lines for rows 2, 3, 4');
  console.log('✓ FB3 Child/Infant column and row copy verified');

  await browser.close();
  console.log('\n================================================================');
  console.log('ALL WORKAROUNDS 1, 2 & 3 AND SIMPLIFIED COUPONS TESTS PASSED!');
  console.log('================================================================');
  process.exit(0);
})().catch(async (err) => {
  console.error('\n❌ TEST FAILED:', err);
  if (browser) await browser.close();
  process.exit(1);
});
