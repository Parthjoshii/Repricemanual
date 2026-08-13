// Verifies findHybridBoundary()'s fallback path: when an ADT source string doesn't have exactly
// 2 primary fare components (a one-way fare with 1, or a multi-stop fare with 3+), the split
// can't be confidently determined. Per the documented behavior, deriveHybridFareCalcString()
// should then scale the WHOLE string at the outbound rate and applyAutoCalc() should surface a
// warning naming the actual component count found. Normal (exactly-2-component) hybrid splitting
// is already covered by hybrid-tabs-verify.js / hybrid-q-directional-verify.js — this file is
// specifically the "count != 2" fallback path.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function setAdtString(str) {
    await page.click('#ptcTabADT');
    await page.waitForTimeout(100);
    await page.fill('#fareCalcString', str);
    await page.click('#parseButton');
    await page.waitForTimeout(150);
    assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'ADT source string should validate PASS: ' + str);
  }

  // --- One-way fare (1 primary fare component) -> fallback to whole-string-at-outbound-rate ---
  await setAdtString('BOM EK DXB 300.00TLEEPIN1/NDC2 NUC300.00 ROE1.0');
  await page.click('#ptcTabCNN_ADT'); // CNN/ADT hybrid tab: outbound 75% (CH), inbound 100% (no suffix)
  await page.waitForTimeout(100);
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(150);

  const warningVisible1 = await page.isVisible('#errorModal.show');
  assert.ok(warningVisible1, 'A one-way (1-component) source string should trigger the fallback warning');
  const warningText1 = await page.textContent('#modalMessage');
  console.log('One-way warning:', warningText1);
  assert.ok(warningText1.includes('found 1 primary fare component'), 'Warning should name the actual component count found (1): ' + warningText1);
  assert.ok(warningText1.includes('expected 2'), 'Warning should state 2 was expected: ' + warningText1);
  await page.click('.modal-close-btn');

  const derived1 = await page.inputValue('#fareCalcString');
  console.log('One-way derived string:', derived1);
  // CNN_ADT outbound ratio = 0.75, outbound suffix = 'CH' -> 300.00 * 0.75 = 225.00
  assert.ok(derived1.includes('225.00TLEEPIN1CH/NDC2'), 'The single component should be scaled at the OUTBOUND rate (75%), not left unscaled or split: ' + derived1);
  assert.ok(derived1.includes('NUC225.00'), 'Recomputed NUC should match the single outbound-scaled component: ' + derived1);
  console.log('CHECK1 OK: a one-way (1-component) source string falls back to whole-string-at-outbound-rate with a warning naming the count');

  // --- Three-leg fare (3 primary fare components) -> same fallback ---
  await setAdtString('BOM EK DXB 300.00TLEEPIN1/NDC2 EK DXB 100.00TLEEPIN1/NDC2 EK BOM 50.00TLEEPIN1/NDC2 NUC450.00 ROE1.0');
  await page.click('#ptcTabCNN_ADT');
  await page.waitForTimeout(100);
  // autoCalcFromAdult is already checked from before switching away — switching tabs re-derives
  // automatically (applyAutoCalc silent re-run), so no need to re-check it here.
  await page.waitForTimeout(150);

  const derived2 = await page.inputValue('#fareCalcString');
  console.log('3-leg derived string:', derived2);
  assert.ok(derived2.includes('225.00TLEEPIN1CH/NDC2'), 'First of 3 components (300) scaled at outbound 75% = 225.00: ' + derived2);
  assert.ok(derived2.includes('75.00TLEEPIN1CH/NDC2'), 'Second of 3 components (100) scaled at outbound 75% = 75.00: ' + derived2);
  assert.ok(derived2.includes('37.50TLEEPIN1CH/NDC2'), 'Third of 3 components (50) scaled at outbound 75% = 37.50: ' + derived2);
  assert.ok(derived2.includes('NUC337.50'), 'Recomputed NUC should sum all 3 outbound-scaled components (225+75+37.5=337.5): ' + derived2);
  console.log('CHECK2 OK: a 3-component source string also falls back to whole-string-at-outbound-rate, scaling every component');
  if (await page.isVisible('#errorModal.show')) await page.click('.modal-close-btn');

  // --- A normal exactly-2-component string should NOT trigger the fallback warning ---
  await setAdtString('BOM EK DXB 300.00TLEEPIN1/NDC2 EK BOM 200.00TLEEPIN1/NDC2 NUC500.00 ROE1.0');
  await page.click('#ptcTabCNN_ADT');
  await page.waitForTimeout(150);
  const warningVisible3 = await page.isVisible('#errorModal.show');
  assert.strictEqual(warningVisible3, false, 'A normal 2-component round-trip string should NOT trigger the fallback warning');
  console.log('CHECK3 OK: a normal 2-component string does not spuriously trigger the fallback warning');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK4 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
