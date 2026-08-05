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

  // --- Exact repro from the bug report: two back-to-back Q surcharges, no separator ---
  const input1 = 'BOM EK DXB Q3.13Q24.94 623.52OAAOPIN1/NDC2 NUC651.59END ROE95.593911';
  const qSurcharges1 = await page.evaluate((str) => {
    const parsed = parseFareCalcStringInternal(str);
    return parsed.qSurcharges;
  }, input1);
  console.log('Q surcharges parsed:', qSurcharges1);
  assert.deepStrictEqual(qSurcharges1, [3.13, 24.94], 'Expected both Q surcharges (3.13 and 24.94) to be captured');
  console.log('CHECK1 OK: consecutive Q3.13Q24.94 both parsed');

  // Drive it through the actual UI too, check NUC validation passes.
  await page.fill('#fareCalcString', input1);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const nucValidationText = await page.$eval('#nucValidation', el => el.textContent);
  console.log('NUC validation:', nucValidationText);
  assert.ok(nucValidationText.includes('PASS'), 'Expected NUC validation to PASS: ' + nucValidationText);
  console.log('CHECK2 OK: NUC validation passes via the UI (623.52 + 3.13 + 24.94 = 651.59)');

  // --- Regression: the original false-positive this lookbehind was added to prevent ---
  const falsePositiveInput = '256.70QWEEPIN1/NDC2 NUC256.70 ROE90.123456';
  const qSurcharges2 = await page.evaluate((str) => {
    const parsed = parseFareCalcStringInternal(str);
    return parsed.qSurcharges;
  }, falsePositiveInput);
  console.log('Q surcharges for fare-basis-code string:', qSurcharges2);
  assert.deepStrictEqual(qSurcharges2, [], 'The Q inside a fare basis code (256.70QWEEPIN1) must NOT be read as a surcharge');
  console.log('CHECK3 OK: Q embedded in an 8-char fare basis code is still correctly ignored (no regression)');

  // --- Other documented formats still work ---
  const otherFormats = 'Q5.00 QBOM5.00 Q BOM5.00 Q BOMCCU5.00 Q5 58.47QDUB 470.74QHAM DUBCOK18.82';
  const qSurcharges3 = await page.evaluate((str) => parseFareCalcStringInternal(str).qSurcharges, otherFormats);
  console.log('Other documented Q formats:', qSurcharges3);
  assert.deepStrictEqual(qSurcharges3, [5.00, 5.00, 5.00, 5.00, 5, 58.47, 470.74, 18.82], 'All previously-documented Q surcharge formats should still parse identically');
  console.log('CHECK4 OK: all previously-supported Q surcharge formats still parse correctly (no regression)');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK5 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
