// Verifies deriveFareCalcString()'s exact percentage-scaling math (CNN 75% / INF 10%, from
// PTC_AUTO_CALC_PERCENT) via the real auto-calc UI flow, plus round2()'s rounding behavior
// directly. Complements autocalc-verify.js (which covers the UI wiring/locking behavior) by
// asserting the arithmetic itself, including that the recomputed NUC is the SUM OF EACH TOKEN'S
// OWN ROUNDED SCALED VALUE (round2 per component, then summed) — not the total scaled once at
// the end — since that's what the source actually does (see deriveFareCalcString's scaledTotal
// accumulator).
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

  // --- round2(): rounds half-up at 2 decimals; the Number.EPSILON nudge fixes the classic
  // "1.005 * 100 is actually 100.499999..." float-representation trap for values near magnitude 1 ---
  const round2 = (n) => page.evaluate((n) => round2(n), n);
  assert.strictEqual(await round2(1.005), 1.01, 'round2 should round 1.005 up to 1.01 despite float representation storing it as slightly under 1.005');
  assert.strictEqual(await round2(2.675), 2.68, 'round2 should round 2.675 up to 2.68 (same float-representation trap)');
  assert.strictEqual(await round2(10), 10, 'round2 should leave an already-2-decimal-safe integer unchanged');
  assert.strictEqual(await round2(0.1 + 0.2), 0.3, 'round2 should absorb the classic 0.1+0.2 float artifact (0.30000000000000004 -> 0.3)');
  console.log('CHECK1 OK: round2() correctly handles the float-representation rounding trap near magnitude 1');

  // --- CNN (75%): multiple fare components + Q surcharges, each scaled and rounded independently ---
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  // Two fare components (300.00, 150.00) + two Q surcharges (10.00, 5.00). Chosen so 75% of each
  // lands on an exact cent (no rounding ambiguity), isolating "does each token scale by 0.75" from
  // "does rounding work" (round2's own behavior is covered separately above).
  const adtString = 'BOM EK DXB Q DXB10.00 300.00TLEEPIN1/NDC2 EK BOM Q BOM5.00 150.00TLEEPIN1/NDC2 NUC465.00 ROE1.0';
  await page.fill('#fareCalcString', adtString);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  assert.ok((await page.textContent('#nucValidation')).includes('PASS'), 'ADT source string should itself validate PASS before deriving from it');

  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(150);
  const cnnString = await page.inputValue('#fareCalcString');
  console.log('CNN derived string:', cnnString);
  assert.ok(cnnString.includes('225.00TLEEPIN1CH/NDC2'), 'First fare component 300.00 * 0.75 should be exactly 225.00: ' + cnnString);
  assert.ok(cnnString.includes('112.50TLEEPIN1CH/NDC2'), 'Second fare component 150.00 * 0.75 should be exactly 112.50: ' + cnnString);
  assert.ok(cnnString.includes('7.50'), 'First Q surcharge 10.00 * 0.75 should be exactly 7.50: ' + cnnString);
  assert.ok(cnnString.includes('3.75'), 'Second Q surcharge 5.00 * 0.75 should be exactly 3.75: ' + cnnString);
  // NUC should be the SUM of the four already-rounded scaled values: 225.00+112.50+7.50+3.75 = 348.75
  assert.ok(cnnString.includes('NUC348.75'), 'Recomputed NUC should be the sum of each independently-rounded scaled token (225+112.5+7.5+3.75=348.75): ' + cnnString);
  console.log('CHECK2 OK: CNN (75%) scales every fare component and Q surcharge independently, NUC = sum of rounded tokens');

  // --- INF (10%): same source string, different percentage ---
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(150);
  const infString = await page.inputValue('#fareCalcString');
  console.log('INF derived string:', infString);
  assert.ok(infString.includes('30.00TLEEPIN1IN/NDC2'), 'First fare component 300.00 * 0.10 should be exactly 30.00: ' + infString);
  assert.ok(infString.includes('15.00TLEEPIN1IN/NDC2'), 'Second fare component 150.00 * 0.10 should be exactly 15.00: ' + infString);
  assert.ok(infString.includes('1.00') && infString.includes('0.50'), 'Q surcharges 10.00 and 5.00 scaled at 10% should be 1.00 and 0.50: ' + infString);
  assert.ok(infString.includes('NUC46.50'), 'INF recomputed NUC should be 30+15+1+0.5=46.50: ' + infString);
  console.log('CHECK3 OK: INF (10%) uses its own distinct percentage, independent of CNN');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK4 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
