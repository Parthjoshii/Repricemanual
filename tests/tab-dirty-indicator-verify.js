// Verifies the "unsummarised data" tab indicator: a `.dirty` class (distinct from the existing
// `.has-data` class, which only tracks "this tab has ever had a completed calculation") that lights
// up the moment a field is edited, and clears once that edit has actually been folded into the
// tab's summary (via Calculate, Summarise, or a tab switch that flushes it).
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

  const isDirty = (ptc) => page.evaluate((id) => document.getElementById(id).classList.contains('dirty'), `ptcTab${ptc}`);
  const hasData = (ptc) => page.evaluate((id) => document.getElementById(id).classList.contains('has-data'), `ptcTab${ptc}`);

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- Fresh tab: neither class present ---
  assert.strictEqual(await isDirty('ADT'), false, 'A fresh tab should not start dirty');
  assert.strictEqual(await hasData('ADT'), false, 'A fresh tab should not start has-data');
  console.log('CHECK1 OK: fresh tab has neither indicator');

  // --- Typing marks dirty immediately, before any Calculate click ---
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  assert.strictEqual(await isDirty('ADT'), true, 'Typing into a field should mark the tab dirty immediately');
  assert.strictEqual(await hasData('ADT'), false, 'Typing alone should not yet count as has-data (no calculation done)');
  console.log('CHECK2 OK: dirty lights up the instant data is entered, before any calculation');

  // --- Clicking Calculate clears dirty and sets has-data ---
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await isDirty('ADT'), false, 'Calculating should clear the dirty flag (summary now reflects the fields)');
  assert.strictEqual(await hasData('ADT'), true, 'Calculating should set has-data');
  console.log('CHECK3 OK: Calculate clears dirty and sets has-data');

  // --- Editing again after a calculation re-lights dirty (both classes coexist) ---
  await page.fill('#newFare', '1300');
  assert.strictEqual(await isDirty('ADT'), true, 'Editing after a completed calculation should mark dirty again');
  assert.strictEqual(await hasData('ADT'), true, 'has-data should remain true — the tab still has a (now-stale) summary');
  console.log('CHECK4 OK: editing after a calculation re-marks dirty without clearing has-data');

  // --- Summarise clears dirty ---
  await page.click('#summariseButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('ADT'), false, 'Summarise should clear dirty once the summary is rebuilt from current fields');
  console.log('CHECK5 OK: Summarise clears dirty');

  // --- Switching tabs flushes and clears dirty on the tab being left ---
  await page.fill('#newFare', '1400');
  assert.strictEqual(await isDirty('ADT'), true, 'Edit before switching should mark dirty');
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('ADT'), false, 'Switching away should flush the pending edit and clear dirty on the tab just left');
  console.log('CHECK6 OK: switching tabs flushes and clears dirty on the tab being left');

  // --- Dirty is per-tab, not global ---
  await page.fill('#oldFare', '500'); // now editing CNN
  assert.strictEqual(await isDirty('CNN'), true, 'CNN should be dirty after its own edit');
  assert.strictEqual(await isDirty('ADT'), false, 'ADT should remain clean — dirty is per-tab');
  console.log('CHECK7 OK: dirty state is tracked independently per tab');

  // --- Clearing a tab's fare resets dirty ---
  await page.click('#fareClearButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('CNN'), false, 'Clearing the fare fields should reset dirty on an emptied tab');
  console.log('CHECK8 OK: clearing a tab resets its dirty flag');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK9 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
