const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');

(async () => {
  console.log('========================================================================');
  console.log('VERIFYING CONSOLIDATED MULTI-PTC GDS STRING CALCULATION');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = `file:///${path.resolve(__dirname, '../index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function closeModalIfOpen() {
    if (await page.isVisible('#errorModal.show')) {
      await page.evaluate(() => closeErrorModal());
      await page.waitForTimeout(100);
    }
  }

  // --- 1. SET UP ADT TAB ---
  console.log('Setting up ADT tab (Fare Diff 100, Change Fee 9000, 5% K3)...');
  await page.selectOption('#currency', 'INR');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '200'); // Diff = 100
  await page.fill('#changeFee', '9000');
  await page.selectOption('#cabin', 'economy');
  await page.evaluate(() => {
    const el = document.getElementById('applyK3OnChangeFee');
    el.checked = true;
    el.dispatchEvent(new Event('change'));
  });
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const adtGds = await page.inputValue('#gdsString');
  console.log('Single ADT GDS String:', adtGds);
  assert.strictEqual(adtGds, 'FARE DIFF INR100 + CHG FEE INR9450 + TAX INR0 = INR9550');

  // --- 2. SET UP CNN TAB ---
  console.log('\nSwitching to CNN tab...');
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);

  console.log('Setting up CNN tab (Fare Diff 70, Change Fee 4500, 5% K3)...');
  await page.selectOption('#currency', 'INR');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '170'); // Diff = 70
  await page.fill('#changeFee', '4500');
  await page.selectOption('#cabin', 'economy');
  await page.evaluate(() => {
    const el = document.getElementById('applyK3OnChangeFee');
    el.checked = true;
    el.dispatchEvent(new Event('change'));
  });
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  // --- 3. GENERATE CONSOLIDATED MULTI-PTC SUMMARY ---
  console.log('\nClicking Summarise to generate Multi-PTC Consolidated Summary...');
  await page.click('#summariseButton');
  await page.waitForTimeout(300);
  await closeModalIfOpen();

  const consolidatedGds = await page.inputValue('#gdsString');
  console.log('Consolidated Multi-PTC GDS String:', consolidatedGds);

  // ADT: Diff 100, Fee 9000, Fee K3 450 (Fee with K3 = 9450), TaxAdj 450, SubTotal 9550
  // CNN: Diff 70, Fee 4500, Fee K3 225 (Fee with K3 = 4725), TaxAdj 225, SubTotal 4795
  // Sums: Total Diff = 170, Total Fee with K3 = 14175, Total Tax = 0, Total SubTotal = 14345
  const expectedConsolidatedGds = 'FARE DIFF INR170 + CHG FEE INR14175 + TAX INR0 = INR14345';

  assert.strictEqual(
    consolidatedGds,
    expectedConsolidatedGds,
    `Expected "${expectedConsolidatedGds}", got "${consolidatedGds}"`
  );

  console.log('\n========================================================================');
  console.log('CONSOLIDATED MULTI-PTC GDS STRING VERIFICATION PASSED 100%!');
  console.log('========================================================================');

  await browser.close();
})();
