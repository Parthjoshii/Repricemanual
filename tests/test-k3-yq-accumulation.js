const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  const oldTax = 'MUR12889YQ/MUR986AE/MUR1316F6/MUR567IN/MUR49JE/MUR1000MU/MUR1121OV/MUR684P2/MUR66TP/MUR198ZR/MUR10006A/MUR1506X';
  const newTax = 'MUR12999YQ/MUR986AE/MUR1316F6/MUR567IN/MUR49JE/MUR1000MU/MUR1121OV/MUR684P2/MUR66TP/MUR198ZR/MUR10006A/MUR1506X/MUR567K3';

  // Set cabin to Economy
  await page.selectOption('#cabin', 'economy');

  // Fill old tax
  await page.fill('#oldTax', oldTax);
  if (await page.isVisible('#errorModal.show')) {
    await page.click('.modal-close-btn');
  }

  // Fill new tax (has K3)
  await page.fill('#newTax', newTax);
  // Dismiss K3 warning modal
  if (await page.isVisible('#errorModal.show')) {
    await page.click('.modal-close-btn');
  }

  // Calculate taxes initially (without K3 on YQ checked)
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  const initialAddTaxes = await page.inputValue('#addTaxes');
  const initialTaxAdj = await page.inputValue('#taxAdj');
  console.log('Initial Add Taxes:', initialAddTaxes);
  console.log('Initial Tax Adj:', initialTaxAdj);

  // Now check 'Apply K3 on Positive YQ Tax'
  await page.check('#applyK3OnYQ');
  await page.waitForTimeout(500);

  const updatedAddTaxes = await page.inputValue('#addTaxes');
  const updatedTaxAdj = await page.inputValue('#taxAdj');
  const taxResultText = await page.innerText('#taxResult');

  console.log('Updated Add Taxes:', updatedAddTaxes);
  console.log('Updated Tax Adj:', updatedTaxAdj);
  console.log('Tax Result:', taxResultText);

  // Verify K3 on Positive YQ is calculated (110 * 0.05 = 5.5 -> 6.00 in MUR)
  assert(taxResultText.includes('K3 on YQ: MUR6.00'), 'K3 on YQ should be MUR6.00');

  // Verify Add Taxes has combined K3: 567 (tax diff) + 6 (YQ K3) = 573
  // Format: MUR110.00YQ/MUR573.00K3
  assert(updatedAddTaxes.includes('MUR573.00K3'), `Expected MUR573.00K3 in Add Taxes, but got: ${updatedAddTaxes}`);
  assert(updatedAddTaxes.includes('MUR110.00YQ'), `Expected MUR110.00YQ in Add Taxes, but got: ${updatedAddTaxes}`);

  // Verify Tax Adjustment (Net) equals 110 (YQ) + 573 (K3) = 683
  assert.strictEqual(updatedTaxAdj, 'MUR683.00', `Expected Tax Adjustment (Net) to be MUR683.00, but got: ${updatedTaxAdj}`);

  // Take screenshot of light mode
  await page.screenshot({ path: path.resolve(__dirname, '../k3-yq-reconciled.png') });
  console.log('Screenshot saved to k3-yq-reconciled.png');

  // Toggle theme to dark mode and screenshot
  await page.click('#themeToggle');
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.resolve(__dirname, '../k3-yq-reconciled-dark.png') });
  console.log('Screenshot saved to k3-yq-reconciled-dark.png');

  // Also test when fare difference with K3 is applied
  await page.fill('#oldFare', 'MUR1000');
  await page.fill('#newFare', 'MUR1500');
  await page.check('#applyK3OnFareDiff');
  await page.waitForTimeout(500);

  const fareAddTaxes = await page.inputValue('#addTaxes');
  const fareTaxAdj = await page.inputValue('#taxAdj');
  console.log('With Fare Diff Add Taxes:', fareAddTaxes);
  console.log('With Fare Diff Tax Adj:', fareTaxAdj);

  // K3: 567 (tax diff) + 6 (YQ) + 25 (fare diff 500 * 5%) = 598
  assert(fareAddTaxes.includes('MUR598.00K3'), `Expected MUR598.00K3 in Add Taxes, but got: ${fareAddTaxes}`);
  // Tax Adj: 110 (YQ) + 598 (K3) = 708
  assert.strictEqual(fareTaxAdj, 'MUR708.00', `Expected Tax Adjustment (Net) to be MUR708.00, but got: ${fareTaxAdj}`);

  console.log('✓ All assertions passed for K3 + YQ + Fare Diff accumulation!');
  await browser.close();
})();
