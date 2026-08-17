const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForLoadState('domcontentloaded');

  console.log('Testing Currency Converter & Manual Fare Difference...');

  // 1. Verify Converter UI elements exist
  const converterToggleBtn = page.locator('#converterToggleBtn');
  const converterCollapsible = page.locator('#converterCollapsible');
  const targetCurrency = page.locator('#targetCurrency');
  const fareRoe = page.locator('#fareRoe');
  const convertedFareDiff = page.locator('#convertedFareDiff');
  const fareDiff = page.locator('#fareDiff');

  await assert.doesNotReject(async () => {
    await converterToggleBtn.waitFor({ state: 'visible' });
    await targetCurrency.waitFor({ state: 'visible' });
    await fareRoe.waitFor({ state: 'visible' });
    await convertedFareDiff.waitFor({ state: 'visible' });
    await fareDiff.waitFor({ state: 'visible' });
  }, 'All converter and fareDiff inputs must exist in DOM');

  // Verify fareDiff is NOT readonly
  const isReadOnly = await fareDiff.getAttribute('readonly');
  assert.strictEqual(isReadOnly, null, 'Fare Difference input must be editable (not readonly)');

  // 2. Test Hide/Show toggle (starts collapsed by default)
  let isCollapsed = await converterCollapsible.evaluate(el => el.classList.contains('collapsed'));
  assert.strictEqual(isCollapsed, true, 'Collapsible content should be collapsed by default');
  let btnText = await converterToggleBtn.textContent();
  assert.strictEqual(btnText.trim(), 'Show', 'Button text should be Show by default');

  // Click Show to expand
  await converterToggleBtn.click();
  isCollapsed = await converterCollapsible.evaluate(el => el.classList.contains('collapsed'));
  assert.strictEqual(isCollapsed, false, 'Collapsible content should expand after clicking Show');
  btnText = await converterToggleBtn.textContent();
  assert.strictEqual(btnText.trim(), 'Hide', 'Button text should be Hide when expanded');

  // Click Hide to collapse
  await converterToggleBtn.click();
  isCollapsed = await converterCollapsible.evaluate(el => el.classList.contains('collapsed'));
  assert.strictEqual(isCollapsed, true, 'Collapsible content should collapse after clicking Hide');
  btnText = await converterToggleBtn.textContent();
  assert.strictEqual(btnText.trim(), 'Show', 'Button text should be Show when collapsed');

  // Re-expand for remaining conversion tests
  await converterToggleBtn.click();

  // 3. Test Automated Currency Conversion (USD 50 -> USD 80, convert to INR)
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', 'USD 50');
  await page.fill('#newFare', 'USD 80');
  await page.selectOption('#cabin', 'economy');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(350);

  // Before conversion, fareDiff is USD 30.00
  let fareDiffVal = await fareDiff.inputValue();
  assert.strictEqual(fareDiffVal, 'USD30.00', 'Initial fare difference should be USD30.00');

  // Select Target Currency: INR
  await page.selectOption('#targetCurrency', 'INR');
  await page.waitForTimeout(350);

  const autoRoe = await fareRoe.inputValue();
  assert.ok(parseFloat(autoRoe) > 80, `Exchange rate for USD->INR should be auto-populated (> 80), got ${autoRoe}`);

  const convDiffVal = await convertedFareDiff.inputValue();
  assert.ok(convDiffVal.startsWith('INR'), `Converted fare diff should start with INR, got ${convDiffVal}`);

  fareDiffVal = await fareDiff.inputValue();
  assert.strictEqual(fareDiffVal, convDiffVal, 'Fare Difference field should be updated with converted amount');

  // 4. Test Summarise button grabs the value from Fare Difference field
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  const summaryVisible = await page.locator('#summaryContent').isVisible();
  assert.strictEqual(summaryVisible, true, 'Summary content should be visible');

  // Check Fare Difference row in summary table
  const summaryFareDiffText = await page.locator('#summary table tr:has(td:has-text("Fare Difference")) td:nth-child(2)').textContent();
  assert.ok(summaryFareDiffText.includes('INR'), `Summary Fare Difference should display the converted INR amount from fareDiff field, got ${summaryFareDiffText}`);
  assert.strictEqual(summaryFareDiffText.trim(), fareDiffVal.trim(), 'Summary Fare Difference must exactly match Fare Difference input value');

  // 5. Test Manually Editable Fare Difference override (e.g. typing INR 12400)
  await page.fill('#fareDiff', 'INR 12400');
  await page.waitForTimeout(350);

  const perPaxVal = await page.locator('#perPax').inputValue();
  assert.strictEqual(perPaxVal, 'INR12400', 'Amount payable per pax should reflect manual INR 12400 fare diff');

  // Click Summarise and verify summary table grabs the manual override value
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  const updatedSummaryFareDiff = await page.locator('#summary table tr:has(td:has-text("Fare Difference")) td:nth-child(2)').textContent();
  assert.strictEqual(updatedSummaryFareDiff.trim(), 'INR12400', 'Summary Fare Difference must grab the manual override INR 12400 value');

  console.log('All Currency Converter & Manual Fare Difference tests passed successfully!');

  await browser.close();
})();
