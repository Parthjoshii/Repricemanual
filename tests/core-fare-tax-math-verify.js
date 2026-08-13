// Numeric-correctness tests for calculateFare()/calculateTaxes()'s core arithmetic — the actual
// diff/K3/perPax/subTotal/net-tax formulas, not just UI plumbing. Formulas verified against the
// source (script.js getCurrentFareK3State/calculateFare/calculateTaxes):
//   k3Fare = diff * K3_RATES[cabin]           (only when diff > 0 and K3-on-fare-diff checked)
//   k3Fee  = changeFee * K3_RATES[cabin]      (only when changeFee != 0 and K3-on-change-fee checked)
//   perPax = diff + changeFee + k3Fee + (netTaxOnly + k3Fare + k3OnYQ)
//   subTotal = perPax * pax
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

  const val = (id) => page.inputValue('#' + id);

  // --- A: plain fare diff, no K3, no tax, no fee, pax=1 ---
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await val('fareDiff'), 'AED200.00', 'Fare Difference should be 200');
  assert.strictEqual(await val('perPax'), 'AED200.00', 'Per Pax should equal the plain fare diff with nothing else applied');
  assert.strictEqual(await val('subTotal'), 'AED200.00', 'Sub Total should equal Per Pax at pax=1');
  console.log('CHECK1 OK: plain fare-diff math with no K3/tax/fee');

  // --- B: K3 on fare diff, economy (5%) ---
  await page.check('#applyK3OnFareDiff');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await val('k3Tax'), 'AED10.00', 'K3 on a 200 fare diff at 5% (economy) should be 10.00');
  assert.strictEqual(await val('taxAdj'), 'AED10.00', 'Tax Adjustment should carry the 10.00 K3-on-fare-diff');
  assert.strictEqual(await val('perPax'), 'AED210.00', 'Per Pax should fold in the 10.00 K3 (200 + 10)');
  console.log('CHECK2 OK: K3-on-fare-diff at the economy rate (5%)');

  // --- C: switch to business cabin (18%) — K3 must recompute at the new rate ---
  await page.selectOption('#cabin', 'business');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await val('k3Tax'), 'AED36.00', 'K3 on a 200 fare diff at 18% (business) should be 36.00');
  assert.strictEqual(await val('perPax'), 'AED236.00', 'Per Pax should reflect the business-rate K3 (200 + 36)');
  console.log('CHECK3 OK: K3 rate correctly switches with cabin (business 18%)');

  // --- D: add a change fee with its own K3 (independent of the fare-diff K3 already applied) ---
  await page.fill('#changeFee', '100');
  await page.check('#applyK3OnChangeFee');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  // k3Fee = 100 * 0.18 = 18; perPax = diff(200) + fee(100) + k3Fee(18) + (netTax 0 + k3Fare 36 + k3OnYQ 0) = 354
  assert.strictEqual(await val('perPax'), 'AED354.00', 'Per Pax should include both the change fee and its own K3, on top of the fare-diff K3');
  console.log('CHECK4 OK: change-fee K3 combines correctly with fare-diff K3');

  // --- E: pax count multiplies the subtotal, not perPax ---
  await page.fill('#pax', '3');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await val('perPax'), 'AED354.00', 'Per Pax should be unaffected by passenger count');
  assert.strictEqual(await val('subTotal'), 'AED1062.00', 'Sub Total should be Per Pax * 3 pax (354 * 3 = 1062)');
  console.log('CHECK5 OK: passenger count multiplies Sub Total, not Per Pax');

  // --- F: fresh tab — tax diff math, including PD-prefix merging ---
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await page.selectOption('#currency', 'AED');
  // Old: AED50YQ. New: a PD-restated AED50YQ plus a genuinely new AED30YQ -> merged new total 80,
  // diff = 80 - 50 = 30 (PD merge means the restated 50 nets out, only the extra 30 counts).
  await page.fill('#oldTax', 'AED50YQ');
  await page.fill('#newTax', 'PDAED50YQ/AED30YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await val('taxAdj'), 'AED30.00', 'PD-restated amount should net out, leaving only the genuinely new 30 as the diff');
  console.log('CHECK6 OK: PD-prefixed tax entries merge correctly instead of double counting');

  // --- G: K3 on YQ — computed from the positive YQ diff, at the selected cabin's rate ---
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldTax', 'AED0YQ');
  await page.fill('#newTax', 'AED100YQ');
  await page.check('#applyK3OnYQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);
  // YQ diff = 100, K3 on YQ at economy 5% = 5; taxAdj = netTax(100) + k3OnYQ(5) = 105
  assert.strictEqual(await val('taxAdj'), 'AED105.00', 'Tax Adjustment should include K3 on the positive YQ diff (100 + 5)');
  console.log('CHECK7 OK: K3-on-YQ correctly computed from the positive YQ diff');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK8 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
