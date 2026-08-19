const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.click('#errorModal .modal-close-btn');
  }

  console.log('Testing IATA Standard Round-Off Rules in Currency Converter...');

  // Open currency converter
  await page.click('#converterToggleBtn');
  await page.waitForTimeout(200);

  // 1. AED: 0 decimals, Round UP to 10
  // USD 50 * 3.6725 = 183.625 -> UP to next 10 = AED190
  await page.fill('#oldFare', 'USD 100');
  await page.fill('#newFare', 'USD 150');
  await page.selectOption('#targetCurrency', 'AED');
  await page.fill('#fareRoe', '3.6725');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  let aedVal = await page.inputValue('#convertedFareDiff');
  console.log('AED Converted Fare Diff (50 * 3.6725 = 183.625 -> AED 190):', aedVal);
  assert.strictEqual(aedVal, 'AED190', 'AED must round up to the next 10 with 0 decimals');

  // 2. THB: 0 decimals, Round UP to 5
  // USD 10 * 36.82 = 368.2 -> UP to next 5 = THB370
  await page.fill('#newFare', 'USD 110');
  await page.selectOption('#targetCurrency', 'THB');
  await page.fill('#fareRoe', '36.82');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  let thbVal = await page.inputValue('#convertedFareDiff');
  console.log('THB Converted Fare Diff (10 * 36.82 = 368.2 -> THB 370):', thbVal);
  assert.strictEqual(thbVal, 'THB370', 'THB must round up to the next 5 with 0 decimals');

  // 3. KWD: 3 decimals, Round UP to 0.001
  // USD 50 * 0.307123 = 15.35615 -> UP to next 0.001 = KWD15.357
  await page.fill('#newFare', 'USD 150');
  await page.selectOption('#targetCurrency', 'KWD');
  await page.fill('#fareRoe', '0.307123');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  let kwdVal = await page.inputValue('#convertedFareDiff');
  console.log('KWD Converted Fare Diff (50 * 0.307123 = 15.35615 -> KWD 15.357):', kwdVal);
  assert.strictEqual(kwdVal, 'KWD15.357', 'KWD must round up to 3 decimal places');

  // 4. INR: 0 decimals, Round UP to 1
  // USD 130 * 86.50 = 11245 -> INR11245
  await page.fill('#newFare', 'USD 230');
  await page.selectOption('#targetCurrency', 'INR');
  await page.fill('#fareRoe', '86.50');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  let inrVal = await page.inputValue('#convertedFareDiff');
  console.log('INR Converted Fare Diff (130 * 86.50 = 11245 -> INR 11245):', inrVal);
  assert.strictEqual(inrVal, 'INR11245', 'INR must round up to integer with 0 decimals');

  // 5. Change Fee Converter AED Rounding
  // Fee USD 50 * 3.6725 = 183.625 -> AED190
  await page.fill('#changeFee', '50');
  await page.selectOption('#feeSourceCurrency', 'USD');
  await page.selectOption('#feeTargetCurrency', 'AED');
  await page.fill('#feeRoe', '3.6725');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  let feeAedVal = await page.inputValue('#convertedChangeFee');
  console.log('AED Converted Change Fee (50 * 3.6725 -> AED 190):', feeAedVal);
  assert.strictEqual(feeAedVal, 'AED190', 'Change Fee in AED must round up to next 10');

  console.log('ALL IATA ROUNDING RULES TESTS PASSED 100%!');
  await browser.close();
})();
