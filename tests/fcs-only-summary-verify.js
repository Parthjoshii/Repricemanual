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

  // Checkbox label check
  const labelText = await page.$eval('label[for="autoCalcFromAdult"]', el => el.textContent);
  assert.strictEqual(labelText, 'Auto-calculate from Adult', 'Label should just say "Auto-calculate from Adult": ' + labelText);
  console.log('CHECK0 OK: toggle label text updated');

  // ADT: full fare data
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  // CNN: only a fare calc string, no fare/tax calculated
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  const cnnString = 'BOM EK DXB 300.00TLEEPIN1CH/NDC2 NUC300.00 ROE1.0';
  await page.fill('#fareCalcString', cnnString);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const cnnNucValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(cnnNucValidation.includes('PASS'), 'CNN string should validate PASS: ' + cnnNucValidation);

  // INF: only a fare calc string, no fare/tax calculated
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  const infString = 'BOM EK DXB 40.00TLEEPIN1IN/NDC2 NUC40.00 ROE1.0';
  await page.fill('#fareCalcString', infString);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  // Back to ADT (active tab) and Summarise
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const headers = await page.$$eval('#summary thead th', ths => ths.map(th => th.textContent));
  console.log('Summary headers:', headers);
  assert.deepStrictEqual(headers, ['', 'Adult', 'Child', 'Infant'], 'Expected all 3 PTCs in summary: ' + JSON.stringify(headers));

  const fcsRows = await page.$$eval('#summary tbody tr', trs => {
    return trs
      .filter(tr => tr.cells[0].textContent.includes('Fare Calculation String'))
      .map(tr => ({ label: tr.cells[0].textContent, value: tr.cells[1] ? tr.cells[1].textContent : null }));
  });
  console.log('FCS rows:', fcsRows);
  const cnnRow = fcsRows.find(r => r.label.includes('Child'));
  const infRow = fcsRows.find(r => r.label.includes('Infant'));
  assert.ok(cnnRow, 'Expected a Fare Calculation String row for Child');
  assert.ok(infRow, 'Expected a Fare Calculation String row for Infant');
  assert.strictEqual(cnnRow.value, cnnString, 'CNN FCS row should match the converted string');
  assert.strictEqual(infRow.value, infString, 'INF FCS row should match the converted string');
  console.log('CHECK1 OK: CNN and INF Fare Calculation Strings appear in the summary despite no fare/tax data');

  // Old Fare row: ADT should show real amount, CNN/INF should show 0 (not "null" or crash)
  const oldFareRow = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent.includes('Old Fare'));
    return row ? Array.from(row.cells).map(c => c.textContent) : null;
  });
  console.log('Old Fare row:', oldFareRow);
  assert.strictEqual(oldFareRow[1], 'AED1000.00', 'ADT Old Fare should be correct');
  assert.ok(!oldFareRow[2].includes('null') && !oldFareRow[3].includes('null'), 'CNN/INF Old Fare should not show "null": ' + oldFareRow);
  console.log('CHECK2 OK: zero-valued fare/tax fields render cleanly for fare-calc-only PTCs, no "null" leakage');

  // Amount Payable should reflect only ADT's real subtotal (CNN/INF contribute 0)
  const amountPayableRow = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent.includes('Amount Payable') && !tr.cells[0].textContent.includes('per Pax'));
    return row ? row.cells[1].textContent : null;
  });
  console.log('Amount Payable row:', amountPayableRow);
  assert.strictEqual(amountPayableRow, 'AED200.00', 'Amount Payable should equal ADT-only subtotal since CNN/INF contribute 0');
  console.log('CHECK3 OK: Amount Payable correctly sums with fare-calc-only PTCs contributing zero');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK4 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
