const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  const parse = (str) => page.evaluate((s) => parseFareCalcStringInternal(s), str);

  // --- Exact repro string from the task/screenshot (full string, including both fare
  // components and the stated NUC1270.59 that only balances if 29.81 stays intact) ---
  const fullStr = 'YFC EK X/YMQ EK DXB Q YFCDXB37.00 371.30LLEIPCA1/NDC2 EK X/YMQ EK YFC Q DXBYFC50.00Q DXBYFC29.81Q DXBYFC37.00 745.48ULEESCA1/NDC2 NUC1270.59 END ROE1.388363';
  const r1 = await parse(fullStr);
  console.log('Q surcharges:', JSON.stringify(r1.qSurcharges));
  console.log('Fare components:', JSON.stringify(r1.fareComponents.map(c => c.amount)));
  assert.deepStrictEqual(r1.qSurcharges, [37.00, 50.00, 29.81, 37.00], 'Q surcharges must match exactly, with 29.81 as ONE value, not split into 29 and 81');
  assert.deepStrictEqual(r1.fareComponents.map(c => c.amount), [371.30, 745.48]);
  const qSum = r1.qSurcharges.reduce((a, b) => a + b, 0);
  const fareSum = r1.fareComponents.reduce((a, b) => a + b.amount, 0);
  console.log('Q sum:', qSum, 'Fare sum:', fareSum, 'Total NUC:', fareSum + qSum);
  assert.ok(r1.qSurcharges.every(v => Number.isFinite(v)), 'All surcharges must be finite numbers');
  assert.strictEqual(Math.round((fareSum + qSum) * 100) / 100, 1270.59, 'Total NUC must equal the stated NUC1270.59 exactly, matching the screenshot\'s expected-correct outcome');
  console.log('CHECK1 OK: exact repro string parses Q surcharges correctly, no decimal splitting');

  // --- UI-level check: run it through the real Convert button; must now PASS validation
  // (screenshot showed FAIL with a spurious +80 from the 29/81 split) ---
  await page.fill('#fareCalcString', fullStr);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const qSurchargesHtml = await page.$eval('#qSurcharges', el => el.innerHTML);
  console.log('Q Surcharges list HTML:', qSurchargesHtml);
  assert.ok(qSurchargesHtml.includes('29.81'), 'UI should show 29.81 as a single line item');
  assert.ok(!/<li>29\.00<\/li>\s*<li>81\.00<\/li>/.test(qSurchargesHtml), 'UI must not show 29.00 and 81.00 as two separate line items');
  const calculatedNuc = await page.$eval('#calculatedNuc', el => el.textContent);
  console.log('Calculated NUC (breakdown):', calculatedNuc);
  assert.ok(calculatedNuc.includes('29.81'), 'Calculated NUC breakdown should show 29.81, not 29.00 + 81.00');
  const nucValidation = await page.$eval('#nucValidation', el => el.textContent);
  console.log('NUC Validation:', nucValidation);
  assert.ok(nucValidation.includes('PASS'), 'NUC validation should now PASS (screenshot showed FAIL before the fix): ' + nucValidation);
  console.log('CHECK2 OK: Convert button / UI rendering shows the fix correctly, NUC validation now PASSes');

  // --- Regression: previously-fixed Q formats still work ---
  const otherFormats = 'Q5.00 QBOM5.00 Q BOM5.00 Q BOMCCU5.00 Q5 58.47QDUB 470.74QHAM DUBCOK18.82 NUC100 ROE1';
  const r2 = await parse(otherFormats);
  assert.deepStrictEqual(r2.qSurcharges, [5.00, 5.00, 5.00, 5.00, 5, 58.47, 470.74, 18.82]);
  console.log('CHECK3 OK: previously-documented Q surcharge formats unaffected');

  // --- Regression: consecutive no-space Q surcharges (Q3.13Q24.94) still work ---
  const consecutive = 'BOM EK DXB Q3.13Q24.94 623.52OAAOPIN1/NDC2 NUC651.59 ROE95.593911';
  const r3 = await parse(consecutive);
  assert.deepStrictEqual(r3.qSurcharges, [3.13, 24.94]);
  console.log('CHECK4 OK: consecutive Q3.13Q24.94 (qDirect, no airport code) still works');

  // --- Regression: fare-basis-code false positive still correctly rejected ---
  const falsePositive = '256.70QWEEPIN1/NDC2 NUC256.70 ROE90.123456';
  const r4 = await parse(falsePositive);
  assert.deepStrictEqual(r4.qSurcharges, [], 'Q embedded in a fare basis code (no space after Q) must still be ignored');
  assert.strictEqual(r4.fareComponents[0].amount, 256.70);
  console.log('CHECK5 OK: "256.70QWEEPIN1" fare-basis false positive still correctly rejected');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK6 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
