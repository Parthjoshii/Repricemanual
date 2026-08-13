// Verifies the Fare Calculation String parser's core NUC/ROE arithmetic:
//   calculatedNuc = sum(fareComponents) + sum(qSurcharges)
//   baseFare = calculatedNuc * roe
//   NUC validation PASS/FAIL boundary at |calculated - stated| < 0.01
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

  async function parse(str) {
    await page.fill('#fareCalcString', str);
    await page.click('#parseButton');
    await page.waitForTimeout(100);
  }

  // --- Simple single fare component + one Q surcharge, exact NUC match ---
  // Fare 300.00 + Q surcharge 50.00 = calculatedNuc 350.00, stated NUC350.00 -> PASS
  // baseFare = 350.00 * 1.5 = 525.00
  await parse('BOM EK DXB Q DXB50.00 300.00TLEEPIN1/NDC2 NUC350.00 ROE1.5');
  assert.strictEqual((await page.textContent('#calculatedNuc')).trim().startsWith('350.00'), true, 'Calculated NUC should be fare(300) + Q(50) = 350.00');
  assert.strictEqual((await page.textContent('#statedNuc')).trim(), '350.00', 'Stated NUC should be read verbatim from the string');
  assert.strictEqual((await page.textContent('#roe')).trim(), '1.5000000', 'ROE should be read and displayed to 7 decimals');
  assert.strictEqual((await page.textContent('#baseFare')).trim(), '525.00', 'Base Fare should be calculatedNuc * ROE (350.00 * 1.5 = 525.00)');
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'Exact NUC match should validate PASS');
  console.log('CHECK1 OK: single fare + Q surcharge NUC sum, and baseFare = calculatedNuc * ROE');

  // --- Multiple fare components (round-trip) ---
  // Two components 300.00 + 250.00 = 550.00, no Q surcharges
  await parse('BOM EK DXB 300.00TLEEPIN1/NDC2 EK BOM 250.00TLEEPIN1/NDC2 NUC550.00 ROE1.0');
  assert.strictEqual((await page.textContent('#statedNuc')).trim(), '550.00');
  assert.ok((await page.textContent('#calculatedNuc')).startsWith('550.00'), 'Two fare components should sum to 550.00');
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'));
  console.log('CHECK2 OK: multiple fare components sum correctly');

  // --- Validation tolerance boundary: just inside 0.01 should PASS, just outside should FAIL ---
  await parse('BOM EK DXB 300.00TLEEPIN1/NDC2 NUC300.005 ROE1.0'); // diff = 0.005, < 0.01
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'A 0.005 difference (within the 0.01 tolerance) should still PASS');
  console.log('CHECK3 OK: a difference just inside the 0.01 tolerance still PASSes');

  await parse('BOM EK DXB 300.00TLEEPIN1/NDC2 NUC300.02 ROE1.0'); // diff = 0.02, > 0.01
  const validationFail = await page.textContent('#nucValidation');
  assert.ok(validationFail.includes('FAIL'), 'A 0.02 difference (outside the 0.01 tolerance) should FAIL');
  assert.ok(validationFail.includes('NUC300.00'), 'The FAIL branch should suggest a corrected string with the actually-calculated NUC (300.00)');
  console.log('CHECK4 OK: a difference outside the 0.01 tolerance correctly FAILs with a corrected NUC suggestion');

  // --- Consecutive Q surcharges all get summed into calculatedNuc ---
  await parse('BOM EK DXB Q DXB10.00Q DXB20.00Q DXB5.00 100.00TLEEPIN1/NDC2 NUC135.00 ROE1.0');
  assert.ok((await page.textContent('#calculatedNuc')).startsWith('135.00'), 'Three consecutive Q surcharges (10+20+5) plus fare (100) should sum to 135.00');
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'));
  console.log('CHECK5 OK: consecutive Q surcharges all contribute to the NUC sum');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK6 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
