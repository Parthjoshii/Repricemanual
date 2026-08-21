const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

  page.on('console', msg => console.log('[BROWSER LOG]', msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message));

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.click('#errorModal .modal-close-btn');
  }

  console.log('--- TEST 1: Initial USD Auto-Calculation ---');
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '135');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  let fareDiffVal = await page.inputValue('#fareDiff');
  console.log('Auto Fare Diff in USD:', fareDiffVal);
  assert.strictEqual(fareDiffVal, 'USD35.00', 'Fare difference should auto-calculate as USD35.00');

  let perPaxVal = await page.inputValue('#perPax');
  console.log('Per Pax in USD:', perPaxVal);
  assert.strictEqual(perPaxVal, 'USD35.00', 'Per Pax should calculate in USD');

  console.log('--- TEST 2: Manual Fare Difference Overwrite with INR4277 ---');
  await page.fill('#fareDiff', 'INR4277');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  let inrPerPaxVal = await page.inputValue('#perPax');
  console.log('Per Pax after manual INR overwrite:', inrPerPaxVal);
  assert.strictEqual(inrPerPaxVal, 'INR4277', 'Downline settlement should switch to INR');

  let inrMsgVisible = await page.isVisible('#inrMessage:not(:empty)');
  console.log('Is INR notice visible:', inrMsgVisible);
  assert.strictEqual(inrMsgVisible, true, 'INR notice should be active');

  console.log('--- TEST 3: Change Fee & K3 Tax in INR ---');
  await page.selectOption('#cabin', 'economy');
  await page.check('#applyK3OnFareDiff');
  await page.fill('#changeFee', '3000');
  await page.check('#applyK3OnChangeFee');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  let k3Val = await page.inputValue('#k3Tax');
  console.log('Calculated K3 (5% of 4277 = 214 + 5% of 3000 = 150 -> INR364):', k3Val);
  assert.strictEqual(k3Val, 'INR364', 'K3 should calculate 5% on fare diff and change fee');

  let addTaxesVal = await page.inputValue('#addTaxes');
  console.log('Add Taxes value:', addTaxesVal);
  assert(addTaxesVal.includes('INR364K3'), 'Add Taxes should contain INR364K3');

  let perPaxWithK3 = await page.inputValue('#perPax');
  console.log('Per Pax with K3:', perPaxWithK3);
  assert.strictEqual(perPaxWithK3, 'INR7641', 'Per Pax should equal 7641 in INR');

  console.log('--- TEST 4: Summary Table & GDS String Dual Currency ---');
  await page.click('#summariseButton');
  await page.waitForTimeout(300);

  const errorVisible = await page.isVisible('#errorModal.show');
  if (errorVisible) {
    const errorText = await page.textContent('#errorMessage');
    console.error('Error modal shown:', errorText);
  }

  await page.waitForSelector('#summary table', { timeout: 3000 });

  const rows = await page.$$eval('#summary table tbody tr', trs =>
    trs.map(tr => {
      const label = tr.querySelector('td:first-child')?.textContent?.trim();
      const val = tr.querySelector('td:last-child')?.textContent?.trim();
      return { label, val };
    })
  );
  console.log('Summary Rows:', rows);

  const oldFareRow = rows.find(r => r.label === 'Old Fare');
  const newFareRow = rows.find(r => r.label === 'New Fare');
  const diffRow = rows.find(r => r.label === 'Fare Difference');
  const feeRow = rows.find(r => r.label === 'Change Fee');
  const totalRow = rows.find(r => r.label === 'Sub Total');

  assert.strictEqual(oldFareRow?.val, 'USD100.00', 'Old Fare should remain in USD');
  assert.strictEqual(newFareRow?.val, 'USD135.00', 'New Fare should remain in USD');
  assert.strictEqual(diffRow?.val, 'INR4277', 'Fare Difference should display as INR4277');
  assert(feeRow?.val.includes('INR3150') && feeRow?.val.includes('INR150'), 'Change Fee should display with K3 breakdown');
  assert.strictEqual(totalRow?.val, 'INR7641', 'Sub Total should be in INR');

  let gdsStr = await page.inputValue('#gdsString');
  console.log('GDS String:', gdsStr);
  assert(gdsStr.includes('FARE DIFF INR4277'), 'GDS string must include FARE DIFF INR4277');
  assert(gdsStr.includes('CHG FEE INR3150'), 'GDS string must include CHG FEE INR3150');
  assert(gdsStr.includes('= INR7641'), 'GDS string must output total in INR');

  console.log('--- TEST 5: Animated Bulb Tips Visibility & Hover Tooltips ---');
  const isFareDiffBulbVisible = await page.isVisible('#fareDiffBulb');
  const isChangeFeeBulbVisible = await page.isVisible('#changeFeeBulb');
  console.log('Is Fare Diff Bulb visible with old & new fare entered:', isFareDiffBulbVisible);
  console.log('Is Change Fee Bulb visible with old & new fare entered:', isChangeFeeBulbVisible);
  assert.strictEqual(isFareDiffBulbVisible, true, 'Fare Diff bulb should be visible next to title');
  assert.strictEqual(isChangeFeeBulbVisible, true, 'Change Fee bulb should be visible next to title');

  const fareDiffTooltip = await page.getAttribute('#fareDiffBulb', 'data-tooltip');
  const changeFeeTooltip = await page.getAttribute('#changeFeeBulb', 'data-tooltip');
  console.log('Fare Diff Bulb Tooltip:', fareDiffTooltip);
  console.log('Change Fee Bulb Tooltip:', changeFeeTooltip);
  assert(fareDiffTooltip.includes('converted settlement amount'), 'Fare Diff tooltip should prompt manual conversion');
  assert(changeFeeTooltip.includes('settlement currency'), 'Change Fee tooltip should prompt settlement currency');

  // Verify hiding on clear
  await page.click('#fareClearButton');
  await page.waitForTimeout(200);
  const isFareDiffBulbHidden = !(await page.isVisible('#fareDiffBulb'));
  const isChangeFeeBulbHidden = !(await page.isVisible('#changeFeeBulb'));
  console.log('Are animated bulbs hidden after clear:', isFareDiffBulbHidden && isChangeFeeBulbHidden);
  assert.strictEqual(isFareDiffBulbHidden && isChangeFeeBulbHidden, true, 'Animated bulbs should be hidden when fare is cleared');

  console.log('ALL MANUAL DUAL-CURRENCY TESTS PASSED 100%!');
  await browser.close();
})();
