const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

let browser;

(async () => {
  console.log('================================================================');
  console.log('VERIFYING WORKAROUND 4: FARE TRANSFER ASSISTANT (FTA) BRIDGE');
  console.log('================================================================\n');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  const filePath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(filePath);
  await page.waitForLoadState('domcontentloaded');

  async function dismissModalIfOpen() {
    await page.evaluate(() => {
      document.getElementById('errorModal')?.classList.remove('show');
      document.getElementById('ftaReviewModal')?.classList.remove('show');
    });
    await page.waitForTimeout(50);
  }

  // --- 1. Populate multi-segment FCS with 4 flights ---
  console.log('--- 1. ENTERING MULTI-SEGMENT FCS WITH 4 FLIGHTS ---');
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

  await page.click('#createTstButton');
  await page.waitForTimeout(250);

  // --- 2. Switch to Workaround 4 Tab ---
  console.log('\n--- 2. SWITCHING TO WORKAROUND 4: FTA FORM BRIDGE TAB ---');
  await dismissModalIfOpen();
  await page.click('#tabWorkaround4');
  await page.waitForTimeout(100);
  assert.ok(await page.isVisible('#panelWorkaround4'), 'Panel Workaround 4 must be visible');
  console.log('✓ Tab 4 and Panel 4 displayed successfully');

  // --- 3. Verify FTA Summary Cards ---
  console.log('\n--- 3. VERIFYING FTA SUMMARY CARDS ---');
  const baseSummary = await page.textContent('#ftaSummaryBase');
  const roeSummary = await page.textContent('#ftaSummaryRoe');
  const totalSummary = await page.textContent('#ftaSummaryTotal');
  const couponsSummary = await page.textContent('#ftaSummaryCoupons');

  console.log(`Summary Base: "${baseSummary}", ROE: "${roeSummary}", Total: "${totalSummary}"`);
  console.log(`Summary Coupons:\n${couponsSummary}`);

  assert.strictEqual(baseSummary, 'USD800.00', 'Base Fare must match calculated base fare');
  assert.strictEqual(roeSummary, '0.855028', 'ROE must match extracted ROE from FCS');
  assert.ok(couponsSummary.includes('QHAMPIE1'), 'Coupons summary must contain QHAMPIE1');
  assert.ok(couponsSummary.includes('UHEESIE1'), 'Coupons summary must contain UHEESIE1');
  console.log('✓ FTA summary cards rendered accurately');

  // --- 4. Test Pre-Transfer Selective Review Modal ---
  console.log('\n--- 4. TESTING PRE-TRANSFER SELECTIVE REVIEW MODAL ---');
  await page.click('#ftaOpenReviewModalBtn');
  await page.waitForTimeout(100);
  assert.ok(await page.isVisible('#ftaReviewModal'), 'Review modal must become visible');

  // Verify preview fields inside modal
  const modalBase = await page.textContent('#ftaPreviewBaseFare');
  const modalFcs = await page.textContent('#ftaPreviewFcs');
  console.log(`Modal preview base: "${modalBase}"`);
  console.log(`Modal preview FCS: "${modalFcs.substring(0, 40)}..."`);
  assert.ok(modalBase.includes('USD800.00') && modalBase.includes('0.855028'), 'Modal preview must show Base and ROE');
  assert.ok(modalFcs.includes('DUB EK X/DXB'), 'Modal preview must show FCS');

  // Test Escape key closes modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const isModalOpenAfterEsc = await page.evaluate(() => document.getElementById('ftaReviewModal')?.classList.contains('show'));
  assert.strictEqual(isModalOpenAfterEsc, false, 'Modal must close on Escape key');
  console.log('✓ Review modal opening, data preview, and Escape dismissal verified');

  // --- 5. Test Copy Structured Package (JSON) ---
  console.log('\n--- 5. TESTING STRUCTURED FARE PACKAGE (JSON) EXPORT ---');
  await dismissModalIfOpen();
  await page.click('#ftaExportJsonBtn');
  await page.waitForTimeout(100);

  const copiedJsonText = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copiedJsonText.startsWith('{'), 'Copied payload must be valid JSON object');
  const pkg = JSON.parse(copiedJsonText);
  assert.strictEqual(pkg.header.baseFare, 'USD800.00', 'Package header baseFare must be USD800.00');
  assert.strictEqual(pkg.header.rateOfExchange, '0.855028', 'Package header ROE must be 0.855028');
  assert.strictEqual(pkg.couponFareBases.length, 4, 'Package must contain 4 flight coupons');
  assert.strictEqual(pkg.couponFareBases[0].fareBasis1, 'QHAMPIE1', 'Coupon 1 FB1 must be QHAMPIE1');
  assert.strictEqual(pkg.couponFareBases[0].fareBasis2, 'VFN2', 'Coupon 1 FB2 must be VFN2');
  assert.strictEqual(pkg.couponFareBases[2].fareBasis1, 'UHEESIE1', 'Coupon 3 FB1 must be UHEESIE1');
  console.log('✓ Structured Fare Package (JSON) validated against enterprise schema');

  // --- 6. Test Form Bridge Snippet Generation ---
  console.log('\n--- 6. TESTING FORM BRIDGE SNIPPET GENERATION ---');
  await dismissModalIfOpen();
  await page.click('#ftaCopyBridgeSnippetBtn');
  await page.waitForTimeout(100);

  const copiedSnippet = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copiedSnippet.includes('FARE TRANSFER ASSISTANT (FTA) - UNIVERSAL FORM BRIDGE'), 'Snippet must have header');
  assert.ok(copiedSnippet.includes('Object.getOwnPropertyDescriptor'), 'Snippet must include native prototype setter for React/Angular');
  assert.ok(copiedSnippet.includes('dispatchEvent(new Event(\'input\''), 'Snippet must dispatch input events');
  assert.ok(copiedSnippet.includes('QHAMPIE1'), 'Snippet must embed active coupon fare bases');
  console.log('✓ Universal Form Bridge script generation verified');

  // --- 7. Test Dual TSV Export from Modal ---
  console.log('\n--- 7. TESTING DUAL TSV EXPORT FROM REVIEW MODAL ---');
  await dismissModalIfOpen();
  await page.click('#tstFtaReviewBtn'); // Bottom action row button
  await page.waitForTimeout(100);
  assert.ok(await page.isVisible('#ftaReviewModal'), 'Bottom action row button must open review modal');

  await page.click('#ftaCopyTsvPackageBtn');
  await page.waitForTimeout(100);

  const copiedTsv = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copiedTsv.includes('BASE FARE\tEQUIV FARE\tROE'), 'Dual TSV must contain header row');
  assert.ok(copiedTsv.includes('USD800.00\tUSD800.00\t0.855028'), 'Dual TSV must contain values');
  assert.ok(copiedTsv.includes('QHAMPIE1\tVFN2'), 'Dual TSV must contain coupon fare bases');
  console.log('✓ Dual TSV export verified');

  // --- 8. Test Bridge Simulation ---
  console.log('\n--- 8. TESTING BRIDGE SIMULATION ---');
  await dismissModalIfOpen();
  await page.click('#ftaQuickTestBridgeBtn');
  await page.waitForTimeout(100);

  const simModalMsg = await page.textContent('#modalMessage');
  console.log(`Simulation modal message: "${simModalMsg}"`);
  assert.ok(simModalMsg.includes('Simulation Passed'), 'Simulation must report passed status');
  console.log('✓ Bridge simulation verified');

  await browser.close();
  console.log('\n================================================================');
  console.log('ALL WORKAROUND 4 (FARE TRANSFER ASSISTANT) TESTS PASSED 100%!');
  console.log('================================================================');
  process.exit(0);
})().catch(async (err) => {
  console.error('\n❌ TEST FAILED:', err);
  if (browser) await browser.close();
  process.exit(1);
});
