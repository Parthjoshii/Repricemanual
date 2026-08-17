const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.click('#errorModal .modal-close-btn');
  }

  console.log('Testing Change Fee main input synchronization on currency conversion...');

  // 1. Enter Change Fee in foreign currency
  await page.fill('#oldFare', 'USD 100');
  await page.fill('#newFare', 'USD 150');
  await page.fill('#changeFee', '50');

  // Open converter
  await page.click('#converterToggleBtn');
  await page.waitForTimeout(300);

  // 2. Select Source USD, Target INR, ROE 85.00
  await page.selectOption('#feeSourceCurrency', 'USD');
  await page.selectOption('#feeTargetCurrency', 'INR');
  await page.fill('#feeRoe', '85.00');
  await page.waitForTimeout(200);

  const feeInputVal = await page.inputValue('#changeFee');
  const convFeeVal = await page.inputValue('#convertedChangeFee');

  console.log('Change Fee input after conversion:', feeInputVal);
  console.log('Converted Change Fee display:', convFeeVal);

  assert.strictEqual(feeInputVal, 'INR4250', 'Main Change Fee field must auto-update to INR4250');
  assert.strictEqual(convFeeVal, 'INR4250', 'Converted Fee box must display INR4250');

  // 3. Update ROE to 86.50 and check if it converts from the original raw fee (50)
  await page.fill('#feeRoe', '86.50');
  await page.waitForTimeout(200);

  const feeInputVal2 = await page.inputValue('#changeFee');
  console.log('Change Fee input after ROE change to 86.50:', feeInputVal2);
  assert.strictEqual(feeInputVal2, 'INR4325', 'Main Change Fee field must recalculate from raw amount to INR4325');

  // 4. Clear Target Currency and verify field reverts to original raw fee
  await page.selectOption('#feeTargetCurrency', '');
  await page.waitForTimeout(200);

  const feeInputValRevert = await page.inputValue('#changeFee');
  console.log('Change Fee input after clearing conversion:', feeInputValRevert);
  assert.strictEqual(feeInputValRevert, '50', 'Main Change Fee field must revert back to raw input 50');

  console.log('ALL CHANGE FEE INPUT SYNC TESTS PASSED SUCCESSFULLY!');
  await browser.close();
})();
