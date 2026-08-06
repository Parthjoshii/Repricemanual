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

  const setAdt = async (str) => {
    await page.click('#ptcTabADT');
    await page.waitForTimeout(80);
    await page.fill('#fareCalcString', str);
    await page.click('#parseButton');
    await page.waitForTimeout(120);
    const v = await page.$eval('#nucValidation', el => el.textContent);
    assert.ok(v.includes('PASS'), 'ADT string should validate PASS: ' + v);
  };

  const enableAutoCalc = async (ptc) => {
    await page.click(`#ptcTab${ptc}`);
    await page.waitForTimeout(120);
    const checked = await page.isChecked('#autoCalcFromAdult');
    if (!checked) {
      await page.click('#autoCalcFromAdult');
      await page.waitForTimeout(120);
    }
  };

  // Adult source: outbound leg (37.13 fare + Q3.70), return leg (559.11 fare + Q5.00+Q2.98+Q3.70)
  // — matches the shape of the target example, at 100% (Adult) amounts.
  const adtString = 'YFC EK X/YMQ EK DXB Q YFCDXB3.70 37.13LLEIPCA1/NDC2 EK X/YMQ EK YFC Q DXBYFC5.00Q DXBYFC2.98 Q DXBYFC3.70 559.11ULEESCA1/NDC2 NUC611.62 ROE1.388363';

  // --- Test Case 1: INF/CNN — outbound 10%, inbound 75% ---
  await setAdt(adtString);
  await enableAutoCalc('INF_CNN');
  const infCnnDerived = await page.inputValue('#fareCalcString');
  console.log('INF/CNN derived:', infCnnDerived);

  // Outbound (10%): fare 37.13*0.10=3.71, Q 3.70*0.10=0.37
  assert.ok(infCnnDerived.includes('0.37') , 'Outbound Q surcharge should scale at 10% (3.70 -> 0.37): ' + infCnnDerived);
  assert.ok(infCnnDerived.includes('3.71LLEIPCA1IN/NDC2'), 'Outbound fare should scale at 10% (37.13 -> 3.71): ' + infCnnDerived);
  // Inbound (75%): fare 559.11*0.75=419.33, Qs 5.00->3.75, 2.98->2.24 (round2), 3.70->2.78
  assert.ok(infCnnDerived.includes('3.75'), 'Inbound Q 5.00 should scale at 75% (-> 3.75), NOT 10%: ' + infCnnDerived);
  assert.ok(infCnnDerived.includes('2.24') || infCnnDerived.includes('2.23'), 'Inbound Q 2.98 should scale at 75% (~2.24), NOT 10% (0.30): ' + infCnnDerived);
  assert.ok(infCnnDerived.includes('2.78'), 'Inbound Q 3.70 should scale at 75% (-> 2.78), NOT 10% (0.37): ' + infCnnDerived);
  assert.ok(infCnnDerived.includes('419.33ULEESCA1CH/NDC2'), 'Inbound fare should scale at 75% (559.11 -> 419.33): ' + infCnnDerived);
  // Explicitly assert the WRONG (bug) values are absent for the return-leg surcharges
  assert.ok(!infCnnDerived.includes('0.50') , 'Inbound Q 5.00 must NOT be scaled at 10% (0.50): ' + infCnnDerived);
  const infCnnValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(infCnnValidation.includes('PASS'), 'Derived INF/CNN string should self-validate PASS: ' + infCnnValidation);
  console.log('CHECK1 OK: INF/CNN — outbound scaled at 10%, return (incl. its Q-surcharges) scaled at 75%');

  // --- Test Case 2: CNN/ADT — outbound 75%, inbound 100% ---
  await setAdt(adtString);
  await enableAutoCalc('CNN_ADT');
  const cnnAdtDerived = await page.inputValue('#fareCalcString');
  console.log('CNN/ADT derived:', cnnAdtDerived);

  // Outbound (75%): fare 37.13*0.75=27.85, Q 3.70*0.75=2.78
  assert.ok(cnnAdtDerived.includes('27.85LLEIPCA1CH/NDC2'), 'Outbound fare should scale at 75% (37.13 -> 27.85): ' + cnnAdtDerived);
  assert.ok(cnnAdtDerived.includes('2.78'), 'Outbound Q 3.70 should scale at 75% (-> 2.78): ' + cnnAdtDerived);
  // Inbound (100%, no suffix): fare stays 559.11, Qs stay 5.00/2.98/3.70 unscaled
  assert.ok(cnnAdtDerived.includes('559.11ULEESCA1/NDC2') && !cnnAdtDerived.includes('ULEESCA1CH') && !cnnAdtDerived.includes('ULEESCA1IN'), 'Inbound fare should remain at 100% with no suffix: ' + cnnAdtDerived);
  assert.ok(cnnAdtDerived.includes('DXBYFC5.00') && cnnAdtDerived.includes('DXBYFC2.98') && cnnAdtDerived.includes('DXBYFC3.70'), 'Inbound Q surcharges should remain unscaled at 100% (5.00/2.98/3.70): ' + cnnAdtDerived);
  const cnnAdtValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(cnnAdtValidation.includes('PASS'), 'Derived CNN/ADT string should self-validate PASS: ' + cnnAdtValidation);
  console.log('CHECK2 OK: CNN/ADT — outbound scaled at 75%, return (incl. its Q-surcharges) stays at 100%');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK3 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
