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

  // --- 1. Embedded NUC inside an earlier fare-basis code must not fool the boundary/value ---
  const embeddedNuc = 'BOM EK X/DXB EK NYC 102.21TLNUC123/NDC2 Q5.00 NUC511.77 ROE90.33';
  const r1 = await parse(embeddedNuc);
  console.log('Embedded-NUC parse:', JSON.stringify(r1));
  assert.strictEqual(r1.fareComponents.length, 1, 'Real fare component must not be dropped');
  assert.strictEqual(r1.fareComponents[0].amount, 102.21);
  assert.strictEqual(r1.nuc, 511.77, 'Must read the real NUC, not the embedded "123"');
  assert.strictEqual(r1.roe, 90.33);
  console.log('CHECK1 OK: embedded NUC inside a fare basis code no longer fools boundary/value detection');

  // --- 2. Embedded ROE inside an earlier fare-basis code ---
  const embeddedRoe = 'BOM EK X/DXB EK NYC 102.21XXROE123/NDC2 Q5.00 NUC511.77 ROE90.33';
  const r2 = await parse(embeddedRoe);
  console.log('Embedded-ROE parse:', JSON.stringify(r2));
  assert.strictEqual(r2.roe, 90.33, 'Must read the real ROE, not the embedded "123"');
  assert.strictEqual(r2.nuc, 511.77);
  console.log('CHECK2 OK: embedded ROE inside a fare basis code no longer fools value detection');

  // --- 3. Whitespace tolerance: "NUC 511.77" / "ROE 90.33" (stray space) ---
  const spaced = 'BOM EK DXB 102.21TLEEPIN1/NDC2 NUC 511.77 ROE 90.33';
  const r3 = await parse(spaced);
  console.log('Spaced NUC/ROE parse:', JSON.stringify(r3));
  assert.strictEqual(r3.nuc, 511.77, 'NUC with a stray space before its digits should still parse');
  assert.strictEqual(r3.roe, 90.33, 'ROE with a stray space before its digits should still parse');
  console.log('CHECK3 OK: stray space between NUC/ROE keyword and digits no longer breaks parsing');

  // --- 4. Lowercase input normalizes to uppercase and parses identically ---
  await page.fill('#fareCalcString', 'bom ek dxb q3.13q24.94 623.52oaaopin1/ndc2 nuc651.59 roe95.593911');
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const fieldValueAfterParse = await page.inputValue('#fareCalcString');
  console.log('Field value after parsing lowercase input:', fieldValueAfterParse);
  assert.strictEqual(fieldValueAfterParse, 'BOM EK DXB Q3.13Q24.94 623.52OAAOPIN1/NDC2 NUC651.59 ROE95.593911', 'Field should reflect the uppercase-normalized string');
  const nucValidationLower = await page.$eval('#nucValidation', el => el.textContent);
  console.log('NUC validation (lowercase input):', nucValidationLower);
  assert.ok(nucValidationLower.includes('PASS'), 'Lowercase-typed but otherwise well-formed string should still validate correctly');
  console.log('CHECK4 OK: lowercase input is uppercase-normalized and parses identically to its uppercase form');

  // --- 5a. Silent-corruption warning: extra decimal point ---
  await page.fill('#fareCalcString', 'BOM EK DXB 102.21.33TLEEPIN1/NDC2 NUC102.21 ROE90');
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const warningModalVisible1 = await page.isVisible('#errorModal.show');
  const warningText1 = await page.textContent('#modalMessage');
  console.log('Warning modal (extra decimal point):', warningModalVisible1, '|', warningText1);
  assert.ok(warningModalVisible1, 'Expected a warning modal for the extra-decimal-point input');
  assert.ok(warningText1.includes('decimal point'), 'Warning should mention the decimal point issue: ' + warningText1);
  await page.click('.modal-close-btn');
  const resultsVisibleAfterWarning1 = await page.isVisible('#parserResults');
  assert.ok(resultsVisibleAfterWarning1, 'Results should still be rendered underneath (non-blocking)');
  console.log('CHECK5a OK: extra-decimal-point input surfaces a warning but still calculates and shows results');

  // --- 5b. Silent-corruption warning: negative amount ---
  await page.fill('#fareCalcString', 'BOM EK DXB -102.21TLEEPIN1/NDC2 NUC102.21 ROE90');
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const warningModalVisible2 = await page.isVisible('#errorModal.show');
  const warningText2 = await page.textContent('#modalMessage');
  console.log('Warning modal (negative amount):', warningModalVisible2, '|', warningText2);
  assert.ok(warningModalVisible2, 'Expected a warning modal for the negative-amount input');
  assert.ok(warningText2.includes('negative') || warningText2.includes('minus'), 'Warning should mention the negative-sign issue: ' + warningText2);
  await page.click('.modal-close-btn');
  console.log('CHECK5b OK: negative-amount input surfaces a warning');

  // --- 6. Full regression: previously-fixed cases still work ---
  const consecutiveQ = 'BOM EK DXB Q3.13Q24.94 623.52OAAOPIN1/NDC2 NUC651.59 ROE95.593911';
  const r6 = await parse(consecutiveQ);
  assert.deepStrictEqual(r6.qSurcharges, [3.13, 24.94]);
  assert.strictEqual(r6.fareComponents.length, 1);
  assert.strictEqual(r6.fareComponents[0].amount, 623.52);
  console.log('CHECK6a OK: consecutive Q3.13Q24.94 still parses correctly');

  const falsePositive = '256.70QWEEPIN1/NDC2 NUC256.70 ROE90.123456';
  const r6b = await parse(falsePositive);
  assert.deepStrictEqual(r6b.qSurcharges, [], 'Q embedded in fare basis code must still be ignored');
  assert.strictEqual(r6b.fareComponents[0].amount, 256.70);
  console.log('CHECK6b OK: fare-basis-code Q false-positive guard still works');

  const noSpaceBeforeRoe = 'BOM EK DXB Q3.13Q24.94 623.52OAAOPIN1/NDC2 NUC651.59ENDROE95.593911';
  const r6c = await parse(noSpaceBeforeRoe);
  assert.strictEqual(r6c.fareComponents.length, 1);
  assert.strictEqual(r6c.nuc, 651.59);
  assert.strictEqual(r6c.roe, 95.593911);
  console.log('CHECK6c OK: original NUC-boundary fix (no space before ROE) still works');

  const otherFormats = 'Q5.00 QBOM5.00 Q BOM5.00 Q BOMCCU5.00 Q5 58.47QDUB 470.74QHAM DUBCOK18.82 NUC100 ROE1';
  const r6d = await parse(otherFormats);
  assert.deepStrictEqual(r6d.qSurcharges, [5.00, 5.00, 5.00, 5.00, 5, 58.47, 470.74, 18.82]);
  console.log('CHECK6d OK: all previously-documented Q surcharge formats still parse correctly');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK7 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
