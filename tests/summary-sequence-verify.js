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

  const summaryTaxAdjRow = async () => {
    return page.$$eval('#summary tbody tr', trs => {
      const row = trs.find(tr => tr.cells[0].textContent.includes('Tax Adjustment'));
      return row ? row.cells[1].textContent : null;
    });
  };

  // --- Scenario A: tax entered before any fare, Summarise, THEN tax edited again ---
  // This is the exact bug: buildTaxOnlySummaryData() creates a summary object that only
  // calculateTaxes()'s old state.lastSummaryData-targeted sync-back could reach — since that
  // object was never assigned to state.lastSummaryData, a second tax recalculation silently
  // failed to update it, and a second Summarise click showed stale numbers.
  await page.fill('#oldTax', 'AED100YQ');
  await page.fill('#newTax', 'AED150YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const row1 = await summaryTaxAdjRow();
  console.log('Tax Adjustment row after first Summarise:', row1);
  assert.ok(row1.includes('50'), 'Expected AED50 net tax adjustment: ' + row1);

  // Now edit the tax and recalculate WITHOUT switching tabs or touching fare
  await page.fill('#newTax', 'AED200YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const row2 = await summaryTaxAdjRow();
  console.log('Tax Adjustment row after editing tax and re-Summarising:', row2);
  assert.ok(row2.includes('100'), 'Expected updated AED100 net tax adjustment, got stale value: ' + row2);
  assert.ok(!row2.includes('AED50.00'), 'Should not still show the old AED50.00 value: ' + row2);
  console.log('CHECK1 OK: tax-only summary refreshes correctly on repeated recalculation + Summarise');

  // --- Scenario B: same, but with K3 on YQ toggled after the fact ---
  await page.selectOption('#cabin', 'economy');
  await page.check('#applyK3OnYQ');
  await page.waitForTimeout(400); // debounced recalculation
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const row3 = await summaryTaxAdjRow();
  console.log('Tax Adjustment row after enabling K3 on YQ:', row3);
  assert.ok(!row3.includes('100.00') || row3 !== row2, 'Expected K3 on YQ to change the net tax adjustment: ' + row3);
  console.log('CHECK2 OK: K3-on-YQ toggle after a tax-only summary correctly updates on next Summarise');

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
