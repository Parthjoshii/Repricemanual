// Verifies generateGdsString() — the consolidated airline GDS string format,
// including passenger aggregation, K3 folding into change fee, and live UI match.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- Check 1: Single PTC positive tax with change fee K3 ---
  const singleData = {
    currency: 'USD',
    diff: 200,
    fee: 100,
    k3Fee: 18,
    taxAdj: 30,
    subTotal: 348,
    pax: 1
  };
  const gdsLine = await page.evaluate((d) => generateGdsString(d, [{ ptc: 'ADT', data: d }]), singleData);
  assert.strictEqual(
    gdsLine,
    'FARE DIFF USD200.00 + CHG FEE USD118.00 + TAX USD30.00 = USD348.00',
    'GDS string should fold K3 into change fee and format positive tax'
  );
  console.log('CHECK1 OK: single-PTC positive tax formats correctly');

  // --- Check 2: Single PTC negative tax (refund) ---
  const singleNegTax = {
    currency: 'USD',
    diff: 0,
    fee: 0,
    k3Fee: 0,
    taxAdj: -20,
    subTotal: -20,
    pax: 1
  };
  const gdsLineNeg = await page.evaluate((d) => generateGdsString(d, [{ ptc: 'ADT', data: d }]), singleNegTax);
  assert.strictEqual(
    gdsLineNeg,
    'FARE DIFF USD0.00 + CHG FEE USD0.00 - TAX USD20.00 = USD-20.00',
    'Negative tax adjustment should show "-" prefix with absolute value'
  );
  console.log('CHECK2 OK: negative tax adjustment correctly displays minus sign');

  // --- Check 3: Multi-PTC consolidated aggregation ---
  const dataADT = { currency: 'USD', diff: 200, fee: 50, k3Fee: 9, taxAdj: 25, subTotal: 284, pax: 1 };
  const dataCNN = { currency: 'USD', diff: 150, fee: 50, k3Fee: 9, taxAdj: 25, subTotal: 234, pax: 1 };
  const consolidated = { currency: 'USD', subTotal: 518 };
  const multiGds = await page.evaluate(({ dataADT, dataCNN, consolidated }) =>
    generateGdsString(consolidated, [{ ptc: 'ADT', data: dataADT }, { ptc: 'CNN', data: dataCNN }]),
    { dataADT, dataCNN, consolidated }
  );
  assert.strictEqual(
    multiGds,
    'FARE DIFF USD350.00 + CHG FEE USD118.00 + TAX USD50.00 = USD518.00',
    'Multi-PTC GDS string should sum fare diff, change fee, taxes, and total across all passengers'
  );
  console.log('CHECK3 OK: multi-PTC consolidated GDS string sums all passenger segments');

  // --- Check 4: Live UI-level #gdsString after Summarise ---
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  await page.click('#ptcTabCHD, #ptcTabCNN');
  await page.waitForTimeout(100);
  await page.selectOption('#currency', 'USD');
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

  assert.ok(gdsValue.includes('FARE DIFF USD250.00'), 'Live GDS string should reflect combined fare diff 200 + 50 = 250');
  assert.ok(gdsValue.endsWith(`= ${amountPayable}`), 'Live GDS string total should match summary table Amount Payable');
  console.log('CHECK4 OK: live #gdsString matches consolidated summary table');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK5 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
