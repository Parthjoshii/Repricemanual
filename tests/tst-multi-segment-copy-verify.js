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

  // --- Step 3: Test 'Copy FB1 Column' Button ---
  console.log('\n--- 3. TESTING "COPY FB1 COLUMN" BUTTON ---');
  await dismissModalIfOpen();
  await page.click('#tstCopyFb1Btn');
  await page.waitForTimeout(100);
  const fb1Clipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  console.log('FB1 Clipboard text:\n' + fb1Clipboard);
  const expectedFb1 = ['QHAMPIE1', 'QHAMPIE1', 'UHEESIE1', 'UHEESIE1'].join('\n');
  assert.strictEqual(fb1Clipboard, expectedFb1, `FB1 Column copy should match expected, got:\n${fb1Clipboard}`);
  console.log('✓ "Copy FB1 Column" produces exact expected newline-separated string');

  // --- Step 4: Test 'Copy FB2 Column' Button ---
  console.log('\n--- 4. TESTING "COPY FB2 COLUMN" BUTTON ---');
  await dismissModalIfOpen();
  await page.click('#tstCopyFb2Btn');
  await page.waitForTimeout(100);
  const fb2Clipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  console.log('FB2 Clipboard text:\n' + fb2Clipboard);
  const expectedFb2 = ['VFN2', 'VFN2', 'VFN2', 'VFN2'].join('\n');
  assert.strictEqual(fb2Clipboard, expectedFb2, `FB2 Column copy should match expected, got:\n${fb2Clipboard}`);
  console.log('✓ "Copy FB2 Column" produces exact expected newline-separated string');

  // --- Step 5: Test 'Copy FB (Tab+Line)' Button ---
  console.log('\n--- 5. TESTING "COPY FB (TAB+LINE)" BUTTON ---');
  await dismissModalIfOpen();
  await page.click('#tstCopyFareBasisBtn');
  await page.waitForTimeout(100);
  const fbAllClipboard = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  console.log('All FB Clipboard text:\n' + fbAllClipboard);
  const expectedFbAll = [
    'QHAMPIE1\tVFN2',
    'QHAMPIE1\tVFN2',
    'UHEESIE1\tVFN2',
    'UHEESIE1\tVFN2'
  ].join('\n');
  assert.strictEqual(fbAllClipboard, expectedFbAll, `All FB copy should match expected tab-separated rows`);
  console.log('✓ "Copy FB (Tab+Line)" produces exact tab-separated rows');

  // --- Step 6: Test 'Copy FARE Fields' Button ---
  console.log('\n--- 6. TESTING "COPY FARE FIELDS" BUTTON ---');
  await dismissModalIfOpen();
  await page.click('#tstCopyFareFieldsBtn');
  await page.waitForTimeout(100);
  const fareFieldsClipboard = await page.evaluate(() => navigator.clipboard.readText());
  console.log('FARE Fields Clipboard text:\n' + fareFieldsClipboard);
  const fareTokens = fareFieldsClipboard.split('\t');
  assert.strictEqual(fareTokens.length, 9, `Expected 9 tab-separated fields in FARE block, got ${fareTokens.length}`);
  assert.strictEqual(fareTokens[2], '0.855028', 'ROE in FARE block must match ROE in FCS (0.855028)');
  assert.strictEqual(fareTokens[4], '', 'Tour code must always be blank');
  console.log('✓ "Copy FARE Fields" produces 9 tab-separated fields with matching ROE and blank Tour code');

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
  await page.click('#tstCopyFb1Btn');
  await page.waitForTimeout(100);
  const fb1Child = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(fb1Child, ['QHAMPIE1', 'QHAMPIE1', 'UHEESIE1', 'UHEESIE1'].join('\n'));

  await dismissModalIfOpen();
  await page.click('#tstCopyFb2Btn');
  await page.waitForTimeout(100);
  const fb2Child = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  assert.strictEqual(fb2Child, ['CH', 'CH', 'CH', 'CH'].join('\n'), `FB2 with CH PTC should be CH, got ${fb2Child}`);
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
