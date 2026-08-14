const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Test 1: Enter USD fares and convert to INR
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '120');
  await page.fill('#newFare', '189');
  await page.selectOption('#targetCurrency', 'INR');
  await page.fill('#fareRoe', '95.477156');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  // Click Summarise
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  // Check Summary table rows
  const oldFareSummary = await page.locator('#summary table tr:has(td:has-text("Old Fare")) td:nth-child(2)').textContent();
  const newFareSummary = await page.locator('#summary table tr:has(td:has-text("New Fare")) td:nth-child(2)').textContent();
  const fareDiffSummary = await page.locator('#summary table tr:has(td:has-text("Fare Difference")) td:nth-child(2)').textContent();
  const perPaxSummary = await page.locator('#summary table tr:has(td:has-text("Amount Payable per Pax")) td:nth-child(2)').textContent();

  console.log('Old Fare Summary:', oldFareSummary);
  console.log('New Fare Summary:', newFareSummary);
  console.log('Fare Diff Summary:', fareDiffSummary);
  console.log('Per Pax Summary:', perPaxSummary);

  assert.ok(oldFareSummary.startsWith('USD'), `Old fare should be in USD, got ${oldFareSummary}`);
  assert.ok(newFareSummary.startsWith('USD'), `New fare should be in USD, got ${newFareSummary}`);
  assert.ok(fareDiffSummary.startsWith('INR'), `Fare difference should be in INR, got ${fareDiffSummary}`);
  assert.ok(perPaxSummary.startsWith('INR'), `Per pax amount should be in INR, got ${perPaxSummary}`);

  const modalVisible = await page.locator('#errorModal').isVisible();
  if (modalVisible) {
    const msg = await page.textContent('#modalMessage');
    console.log('Error Modal was shown with message:', msg);
    await page.click('#errorModal .modal-close-btn');
    await page.waitForTimeout(100);
  }

  page.on('pageerror', e => console.error('PAGE ERROR:', e));
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));

  // Test 2: Calculate Taxes in INR and verify Fare Calculator currency (#currency) remains USD
  await page.fill('#oldTax', 'INR500YQ/INR200YR');
  await page.fill('#newTax', 'INR700YQ/INR300YR');
  await page.waitForTimeout(100);
  
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  const fareCurrencyVal = await page.$eval('#currency', el => el.value);
  console.log('Fare Calculator currency after tax calculation:', fareCurrencyVal);
  assert.strictEqual(fareCurrencyVal, 'USD', 'Fare Calculator currency must remain USD and not be overwritten by tax currency');

  console.log('ALL DUAL CURRENCY & INDEPENDENT TAX CURRENCY TESTS PASSED!');
  await browser.close();
})();
