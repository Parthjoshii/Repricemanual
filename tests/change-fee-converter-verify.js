const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  console.log('Testing Change Fee Conversion reading from main Change Fee input...');

  // 1. Setup Base Fares in USD
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '120');
  await page.fill('#newFare', '189');

  // Convert Fare Difference USD -> INR (ROE 95.477156 -> INR 6588)
  await page.selectOption('#targetCurrency', 'INR');
  await page.fill('#fareRoe', '95.477156');
  await page.waitForTimeout(100);

  // 2. Enter Change Fee in the main Fare Calculator field (#changeFee)
  await page.fill('#changeFee', '50');

  // 3. Configure Change Fee Converter
  await page.selectOption('#feeSourceCurrency', 'USD');
  await page.selectOption('#feeTargetCurrency', 'INR');
  await page.fill('#feeRoe', '85.00');
  await page.waitForTimeout(200);

  // Check converted change fee display
  const convertedFeeVal = await page.inputValue('#convertedChangeFee');
  console.log('Converted Change Fee display:', convertedFeeVal);
  assert.strictEqual(convertedFeeVal, 'INR4250', 'Converted Change Fee should be INR4250');

  // 4. Test K3 on Change Fee (economy = 5% on 4250 = 212.50 -> 213 in INR)
  await page.check('#applyK3OnChangeFee');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  const k3Val = await page.inputValue('#k3Tax');
  console.log('Calculated K3 (with Change Fee K3):', k3Val);
  assert.ok(k3Val.includes('INR'), 'Calculated K3 should be in INR');

  // 5. Click Summarise and verify Summary Table
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  const oldFareSummary = await page.locator('#summary table tr:has(td:has-text("Old Fare")) td:nth-child(2)').textContent();
  const newFareSummary = await page.locator('#summary table tr:has(td:has-text("New Fare")) td:nth-child(2)').textContent();
  const fareDiffSummary = await page.locator('#summary table tr:has(td:has-text("Fare Difference")) td:nth-child(2)').textContent();
  const changeFeeSummary = await page.locator('#summary table tr:has(td:has-text("Change Fee")) td:nth-child(2)').textContent();
  const perPaxSummary = await page.locator('#summary table tr:has(td:has-text("Amount Payable per Pax")) td:nth-child(2)').textContent();

  console.log('Summary Old Fare:', oldFareSummary);
  console.log('Summary New Fare:', newFareSummary);
  console.log('Summary Fare Diff:', fareDiffSummary);
  console.log('Summary Change Fee:', changeFeeSummary);
  console.log('Summary Per Pax:', perPaxSummary);

  assert.ok(oldFareSummary.startsWith('USD'), `Old Fare should be in USD, got ${oldFareSummary}`);
  assert.ok(newFareSummary.startsWith('USD'), `New Fare should be in USD, got ${newFareSummary}`);
  assert.ok(fareDiffSummary.startsWith('INR'), `Fare Diff should be in INR, got ${fareDiffSummary}`);
  assert.ok(changeFeeSummary.startsWith('INR'), `Change Fee should be in INR, got ${changeFeeSummary}`);
  assert.ok(changeFeeSummary.includes('incl. K3'), 'Change Fee should include K3 breakdown note');

  // 6. Verify GDS String
  const gdsVal = await page.inputValue('#gdsString');
  console.log('GDS String:', gdsVal);
  assert.ok(gdsVal.includes('FARE DIFF INR6588'), 'GDS String should contain converted FARE DIFF');
  assert.ok(gdsVal.includes('+ CHG FEE INR'), 'GDS String should contain converted CHG FEE');

  // 7. Test Multi-PTC Tab Switching & Persistence
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(150);

  // Switch back to ADT and verify all converter values are intact
  await page.click('#ptcTabADT');
  await page.waitForTimeout(150);

  assert.strictEqual(await page.inputValue('#changeFee'), '50', 'Main Change Fee should persist on tab switch');
  assert.strictEqual(await page.$eval('#feeSourceCurrency', el => el.value), 'USD', 'Fee Source Currency should persist');
  assert.strictEqual(await page.$eval('#feeTargetCurrency', el => el.value), 'INR', 'Fee Target Currency should persist');
  assert.strictEqual(await page.inputValue('#feeRoe'), '85.00', 'Fee ROE should persist');
  assert.strictEqual(await page.inputValue('#convertedChangeFee'), 'INR4250', 'Converted Fee should persist');

  console.log('ALL CHANGE FEE CONVERSION TESTS PASSED SUCCESSFULLY!');
  await browser.close();
})();
