const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  const shot = (name) => page.screenshot({ path: name, fullPage: true });

  async function fillPtc(oldFare, newFare, oldTax, newTax) {
    await page.selectOption('#currency', 'AED');
    await page.selectOption('#cabin', 'economy');
    await page.fill('#oldFare', oldFare);
    await page.fill('#newFare', newFare);
    await page.fill('#oldTax', oldTax);
    await page.fill('#newTax', newTax);
    await page.click('#taxCalcButton');
    await page.click('#fareCalcButton');
    await page.waitForTimeout(150);
  }

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- 1 PTC only ---
  await fillPtc('1000', '1200', 'AED50YQ', 'AED70YQ');
  await page.click('#summariseButton');
  await page.waitForTimeout(100);

  const tableCount1 = await page.$$eval('#summary table', ts => ts.length);
  assert.strictEqual(tableCount1, 1, 'Expected exactly one table');
  const headers1 = await page.$$eval('#summary thead th', ths => ths.map(th => th.textContent));
  console.log('1-PTC headers:', headers1);
  assert.deepStrictEqual(headers1, ['', 'Adult'], '1-PTC header should be blank + Adult only, no Total column');
  const breakdownLeftover = await page.$('.summary-breakdown, .summary-breakdown-heading, .summary-breakdown-tables');
  assert.strictEqual(breakdownLeftover, null, 'No leftover breakdown DOM should exist');
  console.log('CHECK1 OK: single PTC -> one table, columns [\'\', Adult], no Total column');
  await shot('single-1ptc.png');

  // --- 2 PTCs ---
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await fillPtc('500', '550', 'AED10YQ', 'AED15YQ');
  await page.click('#summariseButton');
  await page.waitForTimeout(100);

  const tableCount2 = await page.$$eval('#summary table', ts => ts.length);
  assert.strictEqual(tableCount2, 1, 'Expected exactly one table for 2 PTCs');
  const headers2 = await page.$$eval('#summary thead th', ths => ths.map(th => th.textContent));
  console.log('2-PTC headers:', headers2);
  assert.deepStrictEqual(headers2, ['', 'Adult', 'Child'], '2-PTC header should be [\'\', Adult, Child] -- no Total column');

  // Row-level sanity check: find the "Old Fare" row and check Adult/Child cells (no Total column)
  const oldFareRow = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent.includes('Old Fare'));
    return row ? Array.from(row.cells).map(c => c.textContent) : null;
  });
  console.log('Old Fare row:', oldFareRow);
  assert.deepStrictEqual(oldFareRow, ['Old Fare', 'AED1000.00', 'AED500.00'], 'Old Fare row values mismatch');

  const subTotalRow = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent.includes('Sub Total'));
    return row ? Array.from(row.cells).map(c => c.textContent) : null;
  });
  console.log('Sub Total row:', subTotalRow);
  assert.deepStrictEqual(subTotalRow, ['Sub Total', 'AED220.00', 'AED55.00'], 'Sub Total row values mismatch');

  // New "Amount Payable" row: single spanning cell = sum of both PTCs' Sub Total, positioned
  // right after Sub Total and before the Fare Calculation String rows.
  const rowLabelsInOrder = await page.$$eval('#summary tbody tr', trs => trs.map(tr => tr.cells[0].textContent));
  const subTotalIdx = rowLabelsInOrder.indexOf('Sub Total');
  const amountPayableIdx = rowLabelsInOrder.indexOf('Amount Payable');
  const firstFcsIdx = rowLabelsInOrder.findIndex(l => l.startsWith('Fare Calculation String'));
  console.log('Row order around Amount Payable:', rowLabelsInOrder.slice(subTotalIdx, firstFcsIdx + 1));
  assert.strictEqual(amountPayableIdx, subTotalIdx + 1, 'Amount Payable should be immediately after Sub Total');
  assert.strictEqual(firstFcsIdx, amountPayableIdx + 1, 'Fare Calculation String rows should be immediately after Amount Payable');

  const amountPayableRow = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent === 'Amount Payable');
    return { cellCount: row.cells.length, colSpan: row.cells[1].colSpan, value: row.cells[1].textContent };
  });
  console.log('Amount Payable row:', amountPayableRow);
  assert.strictEqual(amountPayableRow.cellCount, 2, 'Amount Payable should be label + one spanning value cell');
  assert.strictEqual(amountPayableRow.colSpan, 2, 'Amount Payable value cell should span both PTC columns');
  assert.strictEqual(amountPayableRow.value, 'AED275.00', 'Amount Payable should be the sum of both Sub Totals (220+55)');
  console.log('CHECK2 OK: 2 PTCs -> one table, [\'\', Adult, Child], no Total column, Amount Payable row correct & positioned');
  await shot('single-2ptc.png');

  // --- 3 PTCs (INF) ---
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  await fillPtc('200', '210', 'AED2YQ', 'AED3YQ');
  await page.click('#summariseButton');
  await page.waitForTimeout(100);

  const headers3 = await page.$$eval('#summary thead th', ths => ths.map(th => th.textContent));
  console.log('3-PTC headers:', headers3);
  assert.deepStrictEqual(headers3, ['', 'Adult', 'Child', 'Infant'], '3-PTC header mismatch -- no Total column');
  console.log('CHECK3 OK: 3 PTCs -> [\'\', Adult, Child, Infant], no Total column');

  const amountPayableRow3 = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent === 'Amount Payable');
    return { colSpan: row.cells[1].colSpan, value: row.cells[1].textContent };
  });
  console.log('3-PTC Amount Payable row:', amountPayableRow3);
  assert.strictEqual(amountPayableRow3.colSpan, 3, 'Amount Payable value cell should span all 3 PTC columns');
  assert.strictEqual(amountPayableRow3.value, 'AED286.00', 'Amount Payable should be 220+55+11');
  await shot('single-3ptc.png');

  // --- Copy Summary content sanity (read what would be copied, without relying on clipboard permissions) ---
  const copyText = await page.evaluate(() => {
    const tables = document.querySelectorAll('#summary table');
    return Array.from(tables).map(table =>
      Array.from(table.rows).map(row =>
        Array.from(row.cells).map(cell => cell.textContent).join('\t')
      ).join('\n')
    ).join('\n\n');
  });
  console.log('Copy text first 2 lines:\n' + copyText.split('\n').slice(0, 2).join('\n'));
  assert.ok(copyText.includes('Adult\tChild\tInfant'), 'Copy text should include the header row');
  assert.ok(!copyText.includes('\tTotal'), 'Copy text should not include a Total column header');
  console.log('CHECK4 OK: copy text matches visible table, no Total column');

  // --- Fare Calculation String rows: one full-width row per PTC, positioned after Amount Payable ---
  const fcsRows = await page.$$eval('#summary tbody tr', trs =>
    trs.filter(tr => tr.cells[0].textContent.includes('Fare Calculation String'))
      .map(tr => ({ label: tr.cells[0].textContent, cellCount: tr.cells.length, colSpan: tr.cells[1]?.colSpan }))
  );
  console.log('Fare Calc String rows:', fcsRows);
  assert.strictEqual(fcsRows.length, 3, 'Expected one Fare Calculation String row per PTC (3 total)');
  assert.deepStrictEqual(fcsRows.map(r => r.label), ['Fare Calculation String Adult', 'Fare Calculation String Child', 'Fare Calculation String Infant']);
  fcsRows.forEach(r => assert.strictEqual(r.cellCount, 2, 'Each Fare Calc String row should be label + one spanning value cell'));
  fcsRows.forEach(r => assert.strictEqual(r.colSpan, 3, 'Value cell should span all 3 PTC columns (no Total column)'));
  console.log('CHECK6 OK: Fare Calculation String rendered as one full-width row per PTC');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK5 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
