// Regression test for: editing a field and immediately clicking Summarise (well inside the
// 300ms auto-recalc debounce window, with NO waitForTimeout after the edit) must still reflect
// the edit. Before the fix, handleSummarise() only read whatever summaryData the debounce had
// last committed — a fast Summarise click would show stale numbers. Also covers the same race in
// switchPtcTab() (a fast tab switch right after an edit).
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

  const summaryRow = async (label) => page.$$eval('#summary tbody tr', (trs, label) => {
    const row = trs.find(tr => tr.cells[0].textContent === label);
    return row ? row.cells[1].textContent : null;
  }, label);

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- Baseline: normal flow, waiting for debounce/calc to settle ---
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await summaryRow('New Fare'), 'AED1200.00', 'Baseline New Fare should be 1200');
  console.log('CHECK1 OK: baseline summary reflects the fare just calculated');

  // --- Fare field edited, Summarise clicked with ZERO wait (inside the 300ms debounce window) ---
  await page.fill('#newFare', '1500');
  await page.click('#summariseButton'); // no waitForTimeout — this is the whole point of the test
  await page.waitForTimeout(50);
  assert.strictEqual(await summaryRow('New Fare'), 'AED1500.00', 'Summarise must reflect the just-typed New Fare (1500) even with no wait');
  console.log('CHECK2 OK: Summarise clicked immediately after an edit still shows the new value (no debounce race)');

  // --- Tax field edited, Summarise clicked with ZERO wait ---
  await page.fill('#oldTax', 'AED50YQ');
  await page.fill('#newTax', 'AED50YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  const taxAdjBaseline = await summaryRow('Tax Adjustment (Net)');

  await page.fill('#newTax', 'AED150YQ');
  await page.click('#summariseButton'); // no wait
  await page.waitForTimeout(50);
  const taxAdjAfterEdit = await summaryRow('Tax Adjustment (Net)');
  assert.notStrictEqual(taxAdjAfterEdit, taxAdjBaseline, 'Tax Adjustment should change once the new tax value is folded in');
  assert.strictEqual(taxAdjAfterEdit, 'AED100.00', 'Tax Adjustment should reflect the just-typed newTax (100 net increase) with no wait');
  console.log('CHECK3 OK: a tax-field edit is also flushed before Summarise reads it, with no wait');

  // --- Same race, but via a tab switch instead of Summarise: switch away immediately after an
  // edit, switch back, and the edit should have made it into the tab's own stored data. ---
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '2000'); // no wait
  await page.click('#ptcTabCNN'); // switch away immediately — exercises the same flush in switchPtcTab()
  await page.waitForTimeout(100);
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  const adtNewFareAfterSwitch = await page.inputValue('#newFare');
  assert.strictEqual(adtNewFareAfterSwitch, '2000', 'ADT New Fare edited right before a tab switch should survive the switch');
  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await summaryRow('New Fare'), 'AED2000.00', 'Summary should show the fare edited right before switching tabs, not a stale value');
  console.log('CHECK4 OK: an edit made immediately before a tab switch is not lost/stale either');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK5 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
