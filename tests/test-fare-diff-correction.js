const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('Testing Fare Difference field live updates on correction and currency change...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Dismiss any modal
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => {
      const m = document.getElementById('errorModal');
      if (m) m.classList.remove('show');
    });
  }

  console.log('--- Step 1: Initial Entry (Old: 190, New: 1000) ---');
  await page.fill('#oldFare', '190');
  await page.fill('#newFare', '1000');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  let fareDiffVal = await page.inputValue('#fareDiff');
  let badgeText = await page.textContent('#baseFareDiffBadge');
  console.log('Initial Fare Diff input:', fareDiffVal);
  console.log('Initial Base Badge text:', badgeText);
  assert.ok(fareDiffVal.includes('810'), `Fare Diff input should contain 810, got ${fareDiffVal}`);
  assert.ok(badgeText.includes('810'), `Badge text should contain 810, got ${badgeText}`);

  console.log('--- Step 2: Correct New Base Fare to 1009 ---');
  await page.fill('#newFare', '1009');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  fareDiffVal = await page.inputValue('#fareDiff');
  badgeText = await page.textContent('#baseFareDiffBadge');
  console.log('After New Fare Correction - Fare Diff input:', fareDiffVal);
  console.log('After New Fare Correction - Base Badge text:', badgeText);
  assert.ok(fareDiffVal.includes('819'), `Fare Diff input MUST be updated to 819, got ${fareDiffVal}`);
  assert.ok(badgeText.includes('819'), `Badge text MUST be updated to 819, got ${badgeText}`);

  console.log('--- Step 3: Change Currency Dropdown to UAH ---');
  await page.selectOption('#currency', 'UAH');
  await page.waitForTimeout(400);

  fareDiffVal = await page.inputValue('#fareDiff');
  badgeText = await page.textContent('#baseFareDiffBadge');
  console.log('After Currency Change to UAH - Fare Diff input:', fareDiffVal);
  console.log('After Currency Change to UAH - Base Badge text:', badgeText);
  assert.strictEqual(fareDiffVal, 'UAH819.00', `Fare Diff input MUST be UAH819.00, got ${fareDiffVal}`);
  assert.strictEqual(badgeText, 'Base: UAH819.00', `Badge text MUST be Base: UAH819.00, got ${badgeText}`);

  console.log('--- Step 4: Correct Old Base Fare to 200 ---');
  await page.fill('#oldFare', '200');
  await page.waitForTimeout(400);

  fareDiffVal = await page.inputValue('#fareDiff');
  badgeText = await page.textContent('#baseFareDiffBadge');
  console.log('After Old Fare Correction (200) - Fare Diff input:', fareDiffVal);
  console.log('After Old Fare Correction (200) - Base Badge text:', badgeText);
  assert.strictEqual(fareDiffVal, 'UAH809.00', `Fare Diff input MUST be UAH809.00, got ${fareDiffVal}`);
  assert.strictEqual(badgeText, 'Base: UAH809.00', `Badge text MUST be Base: UAH809.00, got ${badgeText}`);

  console.log('--- Step 5: Manual Dual-Currency Entry (INR 1999) ---');
  await page.fill('#fareDiff', 'INR1999');
  await page.waitForTimeout(400);

  fareDiffVal = await page.inputValue('#fareDiff');
  badgeText = await page.textContent('#baseFareDiffBadge');
  console.log('After Manual INR entry - Fare Diff input:', fareDiffVal);
  console.log('After Manual INR entry - Base Badge text:', badgeText);
  assert.strictEqual(fareDiffVal, 'INR1999', 'Fare Diff input must retain manual INR entry');
  assert.strictEqual(badgeText, 'Base: UAH809.00', 'Badge text must preserve base UAH calculation');

  console.log('\nALL FARE DIFFERENCE CORRECTION TESTS PASSED 100%!');
  await browser.close();
})();
