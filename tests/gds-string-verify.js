// Verifies buildGdsLine()/generateGdsString() — the GDS-format output's math, not just its
// presence: per-PTC line totals must actually equal perPax, and the multi-PTC TOTAL line must
// equal the consolidated subTotal shown in the summary table.
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

  // --- buildGdsLine: unit-style, exact line composition including K3-in-change-fee folding ---
  const line = await page.evaluate(() => buildGdsLine({
    currency: 'AED', diff: 200, fee: 100, k3Fee: 18, taxAdj: 30, perPax: 348,
  }));
  assert.strictEqual(
    line,
    'FARE DIFF AED200.00 + CHG FEE AED118.00 + TAX AED30.00 = AED348.00',
    'GDS line should fold K3 into the displayed Change Fee (100+18=118) and show a "+" for positive tax'
  );
  console.log('CHECK1 OK: buildGdsLine composes the correct line with K3 folded into Change Fee');

  const lineNegTax = await page.evaluate(() => buildGdsLine({
    currency: 'AED', diff: 0, fee: 0, k3Fee: 0, taxAdj: -20, perPax: -20,
  }));
  assert.strictEqual(
    lineNegTax,
    'FARE DIFF AED0 + CHG FEE AED0 - TAX AED20.00 = AED-20.00',
    'A negative tax adjustment should show a "-" prefix with the absolute value, not a raw negative number'
  );
  console.log('CHECK2 OK: buildGdsLine shows "-" for a negative tax adjustment (refund)');

  // --- generateGdsString: single PTC == just the line; multi-PTC == pipe-separated + TOTAL ---
  const singleData = { currency: 'AED', diff: 200, fee: 0, k3Fee: 0, taxAdj: 0, perPax: 200 };
  const single = await page.evaluate((d) => generateGdsString(d, [{ ptc: 'ADT', data: d }]), singleData);
  assert.strictEqual(single, await page.evaluate((d) => buildGdsLine(d), singleData), 'A single-PTC breakdown should produce exactly buildGdsLine\'s output, no TOTAL suffix');
  console.log('CHECK3 OK: generateGdsString with one PTC returns a plain single line');

  const dataADT = { currency: 'AED', diff: 200, fee: 0, k3Fee: 0, taxAdj: 0, perPax: 200 };
  const dataCNN = { currency: 'AED', diff: 150, fee: 0, k3Fee: 0, taxAdj: 0, perPax: 150 };
  const consolidated = { currency: 'AED', subTotal: 350 };
  const multi = await page.evaluate(({ dataADT, dataCNN, consolidated }) =>
    generateGdsString(consolidated, [{ ptc: 'ADT', data: dataADT }, { ptc: 'CNN', data: dataCNN }]),
    { dataADT, dataCNN, consolidated });
  assert.ok(multi.includes('Adult'), 'Multi-PTC GDS string should prefix each line with the PTC label');
  assert.ok(multi.includes('Child'), 'Multi-PTC GDS string should include every PTC in the breakdown');
  assert.ok(multi.endsWith('TOTAL = AED350.00'), 'Multi-PTC GDS string should end with a TOTAL line equal to the consolidated subTotal');
  assert.ok(multi.includes('  |  '), 'Multi-PTC lines should be pipe-separated (an <input> value cannot hold newlines)');
  console.log('CHECK4 OK: generateGdsString with multiple PTCs produces labeled lines + a correct TOTAL');

  // --- UI-level: the actual #gdsString field after Summarise matches the summary table's numbers ---
  await page.selectOption('#currency', 'AED');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await page.selectOption('#currency', 'AED');
  await page.fill('#oldFare', '500');
  await page.fill('#newFare', '550');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const gdsValue = await page.inputValue('#gdsString');
  const amountPayable = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent === 'Amount Payable');
    return row ? row.cells[1].textContent : null;
  });
  assert.ok(gdsValue.endsWith(`TOTAL = ${amountPayable}`), 'The live GDS string\'s TOTAL should match the summary table\'s Amount Payable exactly');
  console.log('CHECK5 OK: the live #gdsString TOTAL matches the rendered Amount Payable');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK6 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
