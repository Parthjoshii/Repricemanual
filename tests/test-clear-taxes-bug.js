const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  const getSummaryRow = async (label) => page.$$eval('#summary tbody tr', (trs, label) => {
    const row = trs.find(tr => tr.cells[0].textContent.trim() === label);
    return row ? row.cells[1].textContent.trim() : null;
  }, label);

  console.log('--- Test 1: Single PTC with debounce, clear taxes, and re-summarise ---');
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '300');
  await page.fill('#newFare', '800');
  await page.waitForTimeout(400); // Debounce fires auto-calculate

  await page.fill('#oldTax', 'USD100US');
  await page.fill('#newTax', 'USD150US');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(100);

  // First summarise
  await page.click('#summariseButton');
  await page.waitForTimeout(100);

  assert.strictEqual(await getSummaryRow('Fare Difference'), 'USD500.00');
  assert.strictEqual(await getSummaryRow('Add Taxes'), 'USD50.00US');
  assert.strictEqual(await getSummaryRow('Tax Adjustment (Net)'), 'USD50.00');
  assert.strictEqual(await getSummaryRow('Amount Payable per Pax'), 'USD550.00');
  assert.strictEqual(await getSummaryRow('Sub Total'), 'USD550.00');
  console.log('✓ Summary 1 has expected fare difference and tax adjustment');

  // Clear taxes
  await page.click('#taxClearButton');
  await page.waitForTimeout(100);

  // Input fields check
  assert.strictEqual(await page.inputValue('#oldTax'), '');
  assert.strictEqual(await page.inputValue('#newTax'), '');
  assert.strictEqual(await page.inputValue('#addTaxes'), '');
  assert.strictEqual(await page.inputValue('#refundTaxes'), '');
  // Per pax and sub total should have reverted to 500
  assert.strictEqual(await page.inputValue('#perPax'), 'USD500.00');
  assert.strictEqual(await page.inputValue('#subTotal'), 'USD500.00');
  assert.strictEqual(await page.inputValue('#taxAdj'), 'USD0.00');
  console.log('✓ Input fields and fare totals updated after clear taxes');

  // Re-summarise
  await page.click('#summariseButton');
  await page.waitForTimeout(100);

  assert.strictEqual(await getSummaryRow('Fare Difference'), 'USD500.00');
  assert.strictEqual(await getSummaryRow('Add Taxes'), '-');
  assert.strictEqual(await getSummaryRow('Tax Adjustment (Net)'), 'USD0.00');
  assert.strictEqual(await getSummaryRow('Amount Payable per Pax'), 'USD500.00');
  assert.strictEqual(await getSummaryRow('Sub Total'), 'USD500.00');
  console.log('✓ Summary 2 after clear taxes has nil tax difference and correct totals!');

  console.log('--- Test 2: Tax-only scenario ---');
  await page.click('#fareClearButton');
  await page.waitForTimeout(100);
  await page.fill('#oldTax', 'USD50US');
  await page.fill('#newTax', 'USD90US');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(100);
  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await getSummaryRow('Tax Adjustment (Net)'), 'USD40.00');
  console.log('✓ Tax-only summary created');

  await page.click('#taxClearButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.inputValue('#perPax'), '');
  assert.strictEqual(await page.inputValue('#subTotal'), '');

  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  const modalVisible = await page.isVisible('#errorModal.show');
  assert.strictEqual(modalVisible, true);
  console.log('✓ Re-summarising with empty fare and cleared taxes properly prompts user');

  await browser.close();
  console.log('ALL TESTS PASSED!');
})();
