// Numeric-correctness tests for the consolidated-summary math: mergeSummaryData()'s sums and
// perPax recompute (unit-style, called directly), plus buildTaxOnlySummaryData()/
// buildFareCalcOnlySummaryData()'s exact field values and the Amount Payable row's UI-level sum
// across 1/2/3 active PTCs (layout itself is already covered by ptc-single-table.js).
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

  // --- mergeSummaryData: numeric sums, perPax recompute, currency-mismatch guard ---
  const mergeOk = await page.evaluate(() => mergeSummaryData([
    { currency: 'AED', oldFare: 1000, newFare: 1200, diff: 200, k3Fare: 10, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 10, subTotal: 210, pax: 1, addTaxes: 'AED10K3', refundTaxes: '', convertedFareCalcString: 'STR-A' },
    { currency: 'AED', oldFare: 500, newFare: 550, diff: 50, k3Fare: 0, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 0, subTotal: 50, pax: 2, addTaxes: '', refundTaxes: 'AED5RF', convertedFareCalcString: 'STR-B' },
  ]));
  assert.strictEqual(mergeOk.subTotal, 260, 'Sub Total should sum both PTCs (210 + 50)');
  assert.strictEqual(mergeOk.pax, 3, 'Pax should sum both PTCs (1 + 2)');
  assert.ok(Math.abs(mergeOk.perPax - (260 / 3)) < 1e-9, 'Merged perPax should be recomputed as subTotal / total pax, not summed');
  assert.strictEqual(mergeOk.addTaxes, 'AED10K3', 'addTaxes should join only the non-empty entries');
  assert.strictEqual(mergeOk.refundTaxes, 'AED5RF', 'refundTaxes should join only the non-empty entries');
  assert.strictEqual(mergeOk.convertedFareCalcString, 'STR-A // STR-B', 'Fare Calc Strings should join with " // "');
  console.log('CHECK1 OK: mergeSummaryData sums fields correctly and recomputes perPax from the totals');

  const mergeCurrencyLess = await page.evaluate(() => mergeSummaryData([
    { currency: '', oldFare: 0, newFare: 0, diff: 0, k3Fare: 0, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 0, subTotal: 0, pax: 1, addTaxes: '', refundTaxes: '', convertedFareCalcString: 'FCS-ONLY' },
    { currency: 'AED', oldFare: 500, newFare: 550, diff: 50, k3Fare: 0, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 0, subTotal: 50, pax: 1, addTaxes: '', refundTaxes: '', convertedFareCalcString: '' },
  ]));
  assert.strictEqual(mergeCurrencyLess.currency, 'AED', 'A currency-less (fare-calc-only) PTC listed first should not blank out the real currency from the other PTC');
  console.log('CHECK2 OK: mergeSummaryData picks a real currency even when the first PTC has none');

  const mergeMismatch = await page.evaluate(() => mergeSummaryData([
    { currency: 'AED', oldFare: 0, newFare: 0, diff: 0, k3Fare: 0, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 0, subTotal: 0, pax: 1, addTaxes: '', refundTaxes: '', convertedFareCalcString: '' },
    { currency: 'USD', oldFare: 0, newFare: 0, diff: 0, k3Fare: 0, k3Fee: 0, k3OnYQ: 0, fee: 0, taxAdj: 0, subTotal: 0, pax: 1, addTaxes: '', refundTaxes: '', convertedFareCalcString: '' },
  ]));
  assert.ok(mergeMismatch.error, 'Mixed currencies across PTCs should return an error object instead of a bogus merge');
  console.log('CHECK3 OK: mergeSummaryData rejects mixed currencies with an error');

  // --- buildTaxOnlySummaryData / buildFareCalcOnlySummaryData: exact field values ---
  const taxOnly = await page.evaluate(() => buildTaxOnlySummaryData({ currency: 'AED', netTax: 45, k3OnYQ: 5, negativeTaxes: [] }, 'AED5K3', 'ADT-STRING'));
  assert.strictEqual(taxOnly.taxAdj, 50, 'Tax-only summary taxAdj should be netTax + k3OnYQ (45 + 5)');
  assert.strictEqual(taxOnly.perPax, 50, 'Tax-only summary perPax should equal taxAdj when there is no fare component');
  assert.strictEqual(taxOnly.subTotal, 50, 'Tax-only summary subTotal should equal perPax at pax=1');
  assert.strictEqual(taxOnly.oldFare, 0, 'Tax-only summary should have zero fare fields');
  assert.strictEqual(taxOnly.convertedFareCalcString, 'ADT-STRING', 'Tax-only summary should still carry the converted Fare Calc String if one exists');
  console.log('CHECK4 OK: buildTaxOnlySummaryData computes exact netTax+k3OnYQ fields');

  const fcsOnly = await page.evaluate(() => buildFareCalcOnlySummaryData('SOME-STRING'));
  assert.strictEqual(fcsOnly.currency, '', 'Fare-calc-only summary should have no currency');
  assert.strictEqual(fcsOnly.subTotal, 0, 'Fare-calc-only summary should contribute zero to any sum it is merged into');
  assert.strictEqual(fcsOnly.convertedFareCalcString, 'SOME-STRING', 'Fare-calc-only summary should carry the string');
  console.log('CHECK5 OK: buildFareCalcOnlySummaryData is an all-zero shape carrying only the string');

  // --- UI-level: Amount Payable across 3 PTCs sums each PTC's own perPax*pax correctly ---
  async function fillPtc(oldFare, newFare, pax) {
    await page.selectOption('#currency', 'AED');
    await page.fill('#oldFare', oldFare);
    await page.fill('#newFare', newFare);
    await page.fill('#pax', pax);
    await page.click('#fareCalcButton');
    await page.waitForTimeout(150);
  }
  await fillPtc('1000', '1300', '1'); // ADT: diff 300
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await fillPtc('500', '650', '2'); // CNN: diff 150 * 2 pax = 300
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  await fillPtc('100', '140', '1'); // INF: diff 40
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const amountPayable = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent === 'Amount Payable');
    return row ? row.cells[1].textContent : null;
  });
  assert.strictEqual(amountPayable, 'AED640.00', 'Amount Payable should be 300 (ADT) + 300 (CNN, 150*2 pax) + 40 (INF) = 640');
  console.log('CHECK6 OK: Amount Payable correctly sums each PTC\'s own subTotal (fare diff * its own pax) across 3 PTCs');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK7 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
