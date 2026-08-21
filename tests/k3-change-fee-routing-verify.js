const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');

(async () => {
  console.log('========================================================================');
  console.log('VERIFYING CHANGE FEE K3 ROUTING INTO ADD TAXES & NON-DUPLICATED SUB TOTAL');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = `file:///${path.resolve(__dirname, '../index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function closeModalIfOpen() {
    if (await page.isVisible('#errorModal.show')) {
      const msg = await page.textContent('#modalMessage');
      console.log('Dismissed modal message:', msg);
      await page.evaluate(() => closeErrorModal());
      await page.waitForTimeout(100);
    }
  }

  await closeModalIfOpen();

  // --- TEST 1: Change Fee only with K3 enabled ---
  console.log('--- TEST 1: Change Fee K3 alone ---');
  await page.selectOption('#currency', 'INR');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '200');
  await page.fill('#changeFee', '9000');
  await page.selectOption('#cabin', 'economy'); // 5% K3
  await page.evaluate(() => {
    const el = document.getElementById('applyK3OnChangeFee');
    el.checked = true;
    el.dispatchEvent(new Event('change'));
  });

  // Trigger fare calculation
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  // Verify K3 tax label
  const k3Label = await page.inputValue('#k3Tax');
  console.log('K3 Tax Input:', k3Label);
  assert.strictEqual(k3Label, 'INR450');

  // Verify Add Taxes contains INR450K3
  const addTaxesVal = await page.inputValue('#addTaxes');
  console.log('Add Taxes:', addTaxesVal);
  assert.ok(addTaxesVal.includes('INR450K3'), `Expected Add Taxes to contain INR450K3, got ${addTaxesVal}`);

  // Verify Tax Adjustment Net contains INR450
  const taxAdjVal = await page.inputValue('#taxAdj');
  console.log('Tax Adj:', taxAdjVal);
  assert.strictEqual(taxAdjVal, 'INR450');

  // Verify Per Pax = Fare Diff (100) + Base Change Fee (9000) + Add Taxes (450) = 9550
  const perPaxVal = await page.inputValue('#perPax');
  console.log('Per Pax:', perPaxVal);
  assert.strictEqual(perPaxVal, 'INR9550');

  // Click Summarise and verify Summary Table rendering
  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const summaryRows = await page.$$eval('#summary table tr', trs =>
    trs.map(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) {
        return { label: cells[0].textContent.trim(), val: cells[1].textContent.trim() };
      }
      return null;
    }).filter(Boolean)
  );
  console.log('Summary Rows:', summaryRows);

  const changeFeeRow = summaryRows.find(r => r.label === 'Change Fee')?.val;
  console.log('Summary Change Fee:', changeFeeRow);
  assert.strictEqual(changeFeeRow, 'INR9450 (incl. K3 INR450)');

  const addTaxesRow = summaryRows.find(r => r.label === 'Add Taxes')?.val;
  console.log('Summary Add Taxes:', addTaxesRow);
  assert.ok(addTaxesRow.includes('INR450K3'));

  const perPaxRow = summaryRows.find(r => r.label === 'Amount Payable per Pax')?.val;
  console.log('Summary Per Pax:', perPaxRow);
  assert.strictEqual(perPaxRow, 'INR9550');

  // Verify GDS Command String
  const gdsString = await page.inputValue('#gdsString');
  console.log('GDS String:', gdsString);
  assert.strictEqual(gdsString, 'FARE DIFF INR100 + CHG FEE INR9450 + TAX INR0 = INR9550');

  // --- TEST 2: 3-Way Combined K3 (Fare Diff + Change Fee + YQ Tax) ---
  console.log('\n--- TEST 2: Combined 3-Way K3 (Fare Diff + Change Fee + YQ Tax) ---');
  await closeModalIfOpen();

  await page.evaluate(() => {
    const el = document.getElementById('applyK3OnFareDiff');
    el.checked = true;
    el.dispatchEvent(new Event('change'));
  });

  await page.fill('#oldTax', 'INR1000YQ');
  await page.fill('#newTax', 'INR2000YQ'); // 1000 positive YQ
  
  await page.evaluate(() => {
    const el = document.getElementById('applyK3OnYQ');
    el.checked = true;
    el.dispatchEvent(new Event('change'));
  });

  // Trigger tax calculation
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  // Total K3 = 5 (Fare) + 450 (Fee) + 50 (YQ) = 505 K3
  const addTaxes3Way = await page.inputValue('#addTaxes');
  console.log('Combined Add Taxes:', addTaxes3Way);
  assert.ok(addTaxes3Way.includes('INR505K3'), `Expected Add Taxes to contain INR505K3, got ${addTaxes3Way}`);

  // Re-calculate fare and summary
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);
  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const perPax3Way = await page.inputValue('#perPax');
  console.log('3-Way Per Pax:', perPax3Way);
  // 100 (diff) + 9000 (base fee) + 1000 (net YQ) + 505 (all K3) = 10605
  assert.strictEqual(perPax3Way, 'INR10605');

  const gdsString3Way = await page.inputValue('#gdsString');
  console.log('3-Way GDS String:', gdsString3Way);
  assert.strictEqual(gdsString3Way, 'FARE DIFF INR100 + CHG FEE INR9450 + TAX INR1055 = INR10605');

  console.log('\n========================================================================');
  console.log('ALL CHANGE FEE K3 ROUTING TESTS PASSED 100%!');
  console.log('========================================================================');

  await browser.close();
})();
