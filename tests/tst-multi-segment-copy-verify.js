const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2] || 'index.html').replace(/\\/g, '/');

let browser;
(async () => {
  console.log('================================================================');
  console.log('VERIFYING TST MULTI-SEGMENT ROUTING, COLUMN COPY & BOOKMARKLET');
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

  // --- Step 1: Input Multi-Segment FCS with Transit (X/DXB) ---
  console.log('\n--- 1. ENTERING MULTI-SEGMENT FCS (4 FLIGHTS TOTAL) ---');
  const userFcs = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC0END ROE0.855028';
  
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '300');
  await page.fill('#newFare', '800');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  await page.fill('#fareCalcString', userFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(100);

  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  // Click Create TST
  await page.click('#createTstButton');
  await page.waitForTimeout(250);

  // --- Step 2: Verify 4 Flight Coupon Rows Generated ---
  console.log('\n--- 2. VERIFYING 4 FLIGHT ROWS GENERATED (DUB-DXB, DXB-COK, COK-DXB, DXB-DUB) ---');
  const rows = await page.locator('.tst-coupon-row').all();
  console.log('Generated flight coupon rows count:', rows.length);
  assert.strictEqual(rows.length, 4, `Expected 4 flight rows for transit routing, got ${rows.length}`);

  const row1Flight = await page.locator('.tst-coupon-row').nth(0).locator('.tst-flight').inputValue();
  const row1Stopover = await page.locator('.tst-coupon-row').nth(0).locator('.tst-stopover').inputValue();
  const row1Fb = await page.locator('.tst-coupon-row').nth(0).locator('.tst-fare-basis').inputValue();
  console.log(`Row 1: Flight=${row1Flight}, Stopover=${row1Stopover}, FB=${row1Fb}`);
  assert.ok(row1Flight.includes('DUB-DXB'), `Row 1 flight should be DUB-DXB, got ${row1Flight}`);
  assert.strictEqual(row1Stopover, 'NO', 'Row 1 should be transit (stopover NO)');
  assert.strictEqual(row1Fb, 'QHAMPIE1/VFN2', `Row 1 FB should be QHAMPIE1/VFN2, got ${row1Fb}`);

  const row2Flight = await page.locator('.tst-coupon-row').nth(1).locator('.tst-flight').inputValue();
  const row2Stopover = await page.locator('.tst-coupon-row').nth(1).locator('.tst-stopover').inputValue();
  const row2Fb = await page.locator('.tst-coupon-row').nth(1).locator('.tst-fare-basis').inputValue();
  console.log(`Row 2: Flight=${row2Flight}, Stopover=${row2Stopover}, FB=${row2Fb}`);
  assert.ok(row2Flight.includes('DXB-COK'), `Row 2 flight should be DXB-COK, got ${row2Flight}`);
  assert.strictEqual(row2Stopover, 'YES', 'Row 2 should be destination (stopover YES)');
  assert.strictEqual(row2Fb, 'QHAMPIE1/VFN2', `Row 2 FB should be QHAMPIE1/VFN2, got ${row2Fb}`);

  const row3Flight = await page.locator('.tst-coupon-row').nth(2).locator('.tst-flight').inputValue();
  const row3Stopover = await page.locator('.tst-coupon-row').nth(2).locator('.tst-stopover').inputValue();
  const row3Fb = await page.locator('.tst-coupon-row').nth(2).locator('.tst-fare-basis').inputValue();
  console.log(`Row 3: Flight=${row3Flight}, Stopover=${row3Stopover}, FB=${row3Fb}`);
  assert.ok(row3Flight.includes('COK-DXB'), `Row 3 flight should be COK-DXB, got ${row3Flight}`);
  assert.strictEqual(row3Stopover, 'NO', 'Row 3 should be transit (stopover NO)');
  assert.strictEqual(row3Fb, 'UHEESIE1/VFN2', `Row 3 FB should be UHEESIE1/VFN2, got ${row3Fb}`);

  const row4Flight = await page.locator('.tst-coupon-row').nth(3).locator('.tst-flight').inputValue();
  const row4Stopover = await page.locator('.tst-coupon-row').nth(3).locator('.tst-stopover').inputValue();
  const row4Fb = await page.locator('.tst-coupon-row').nth(3).locator('.tst-fare-basis').inputValue();
  console.log(`Row 4: Flight=${row4Flight}, Stopover=${row4Stopover}, FB=${row4Fb}`);
  assert.ok(row4Flight.includes('DXB-DUB'), `Row 4 flight should be DXB-DUB, got ${row4Flight}`);
  assert.strictEqual(row4Stopover, 'YES', 'Row 4 should be destination (stopover YES)');
  assert.strictEqual(row4Fb, 'UHEESIE1/VFN2', `Row 4 FB should be UHEESIE1/VFN2, got ${row4Fb}`);
  console.log('✓ All 4 flight segments and Fare Bases correctly expanded from FCS routing');

  async function dismissModalIfOpen() {
    if (await page.isVisible('#errorModal.show')) {
      await page.evaluate(() => closeErrorModal());
      await page.waitForTimeout(60);
    }
  }

  // --- Step 3: Test 'Copy Coupons' Button ---
  console.log('\n--- 3. TESTING "COPY COUPONS" BUTTON ---');
  await dismissModalIfOpen();
  await page.click('#tstCopyCouponsBtn');
  await page.waitForTimeout(100);
  const couponsClipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  console.log('Coupons Clipboard text:\n' + couponsClipboard);
  assert.ok(couponsClipboard.includes('DUB-DXB'), 'Coupons copy should include DUB-DXB');
  assert.ok(couponsClipboard.includes('DXB-COK'), 'Coupons copy should include DXB-COK');
  assert.ok(couponsClipboard.includes('COK-DXB'), 'Coupons copy should include COK-DXB');
  assert.ok(couponsClipboard.includes('DXB-DUB'), 'Coupons copy should include DXB-DUB');
  console.log('✓ "Copy Coupons" produces complete flight segment matrix');

  // --- Step 4: Test Per-Row Fare Basis Copy Button ---
  console.log('\n--- 4. TESTING PER-ROW FARE BASIS COPY BUTTON ---');
  await dismissModalIfOpen();
  const firstRowCopyBtn = page.locator('.tst-coupon-row').nth(0).locator('.tst-copy-row-fb-btn');
  await firstRowCopyBtn.click();
  await page.waitForTimeout(100);
  const row1FbClipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  console.log('Row 1 FB Clipboard:\n' + row1FbClipboard);
  assert.strictEqual(row1FbClipboard, 'QHAMPIE1\tVFN2', 'Row 1 copy must be tab-separated QHAMPIE1\\tVFN2');
  console.log('✓ Per-row Fare Basis copy verified');

  // --- Step 5: Test Dedicated Fare Transfer Assistant (FTA) Section ---
  console.log('\n--- 5. TESTING DEDICATED FARE TRANSFER ASSISTANT (FTA) SECTION ---');
  assert.ok(await page.isVisible('#ftaSection'), '#ftaSection must be visible');
  const baseSummary = await page.textContent('#ftaSummaryBase');
  const roeSummary = await page.textContent('#ftaSummaryRoe');
  assert.strictEqual(baseSummary, 'USD800.00', 'Base fare should be USD800.00');
  assert.strictEqual(roeSummary, '0.855028', 'ROE should match FCS ROE 0.855028');
  console.log('✓ Dedicated FTA Section cards validated');

  // --- Step 7: Test 'Copy TST (For Tool & Bookmarklet)' Button ---
  console.log('\n--- 7. TESTING "COPY TST (FOR TOOL & BOOKMARKLET)" BUTTON ---');
  await dismissModalIfOpen();
  await page.click('#tstCopyBtn');
  await page.waitForTimeout(100);
  const tstPayloadClipboard = await page.evaluate(() => navigator.clipboard.readText());
  const parsedPayload = JSON.parse(tstPayloadClipboard);
  assert.strictEqual(parsedPayload.__tstPayload, true, '__tstPayload flag must be true');
  assert.strictEqual(parsedPayload.coupons.length, 4, 'Payload must contain 4 coupons');
  assert.strictEqual(parsedPayload.coupons[0].fb1, 'QHAMPIE1');
  assert.strictEqual(parsedPayload.coupons[0].fb2, 'VFN2');
  assert.strictEqual(parsedPayload.coupons[2].fb1, 'UHEESIE1');
  assert.strictEqual(parsedPayload.coupons[2].fb2, 'VFN2');
  assert.strictEqual(parsedPayload.fare.roe, '0.855028');
  console.log('✓ "Copy TST" produces structured payload with all 4 flight segments and fare fields');

  // --- Step 8: Test Bookmarklet Elements & Link ---
  console.log('\n--- 8. TESTING BOOKMARKLET BAR AND INSTRUCTIONS ---');
  await dismissModalIfOpen();
  const bookmarkletHref = await page.getAttribute('#tstBookmarkletLink', 'href');
  assert.ok(bookmarkletHref.startsWith('javascript:'), `Bookmarklet href must start with javascript:, got ${bookmarkletHref.slice(0, 30)}`);
  assert.ok(bookmarkletHref.includes('setVal'), 'Bookmarklet script must contain setVal helper');
  assert.ok(bookmarkletHref.includes('__tstPayload'), 'Bookmarklet script must handle __tstPayload');

  // Test Instructions Toggle
  const helpBox = page.locator('#tstBookmarkletHelp');
  assert.ok(!await helpBox.isVisible(), 'Help box should initially be hidden');
  await page.click('#tstBookmarkletHelpBtn');
  await page.waitForTimeout(100);
  assert.ok(await helpBox.isVisible(), 'Help box should be visible after clicking help button');
  console.log('✓ Bookmarklet link valid and instructions toggle correctly');

  // --- Step 9: Test Scenario 2 with Child PTC (CH) ---
  console.log('\n--- 9. TESTING SCENARIO 2 WITH PTC (CH) ---');
  await dismissModalIfOpen();
  const childFcs = 'DUB EK X/DXB EK COK 353.05QHAMPIE1CH/VFN2 EK X/DXB EK DUB 439.02UHEESIE1CH/VFN2 NUC0END ROE0.855028';
  await page.fill('#fareCalcString', childFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(100);
  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  await page.click('#tstUpdateValuesBtn');
  await page.waitForTimeout(200);

  await dismissModalIfOpen();
  const row1Fb1 = await page.locator('.tst-coupon-row').nth(0).locator('.tst-fb1').inputValue();
  const row1Fb2 = await page.locator('.tst-coupon-row').nth(0).locator('.tst-fb2').inputValue();
  const row1Fb3 = await page.locator('.tst-coupon-row').nth(0).locator('.tst-fb3').inputValue();
  assert.strictEqual(row1Fb1, 'QHAMPIE1', 'Row 1 FB1 should be QHAMPIE1');
  assert.strictEqual(row1Fb2, 'CH', 'Row 1 FB2 should be CH');
  assert.strictEqual(row1Fb3, 'VFN2', 'Row 1 FB3 should be VFN2');

  const row1CopyBtn = page.locator('.tst-coupon-row').nth(0).locator('.tst-copy-row-fb-btn');
  await row1CopyBtn.click();
  await page.waitForTimeout(100);
  const row1FbSplit = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(row1FbSplit, 'QHAMPIE1\tCH\tVFN2', 'Row 1 split must be QHAMPIE1\\tCH\\tVFN2');
  console.log('✓ Scenario 2 PTC test passed: FB1=QHAMPIE1, FB2=CH, FB3=VFN2');

  console.log('\n================================================================');
  console.log('ALL TST COPY & HARD PASTE TESTS PASSED SUCCESSFULLY! (9/9)');
  console.log('================================================================');

  await browser.close();
  process.exit(0);
})().catch(async (err) => {
  console.error('\n❌ TEST FAILED:', err);
  if (browser) await browser.close();
  process.exit(1);
});
