// Verifies the "unsummarised data" tab indicator: a `.dirty` class (distinct from the existing
// `.has-data` class, which only tracks "this tab has ever had a completed calculation") that lights
// up the moment a field is edited, and clears once that edit has actually been folded into the
// tab's summary (via Calculate, Summarise, or a tab switch that flushes it).
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
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('ADT'), false, 'Switching away should flush the pending edit and clear dirty on the tab just left');
  console.log('CHECK6 OK: switching tabs flushes and clears dirty on the tab being left');

  // --- Dirty is per-tab, not global ---
  await page.fill('#oldFare', '500'); // now editing CHD
  assert.strictEqual(await isDirty('CHD'), true, 'CHD should be dirty after its own edit');
  assert.strictEqual(await isDirty('ADT'), false, 'ADT should remain clean — dirty is per-tab');
  console.log('CHECK7 OK: dirty state is tracked independently per tab');

  // --- Clearing a tab's fare resets dirty ---
  await page.click('#fareClearButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('CHD'), false, 'Clearing the fare fields should reset dirty on an emptied tab');
  console.log('CHECK8 OK: clearing a tab resets its dirty flag');

  // --- State 3: .in-summary indicator dot ---
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);

  // Before Summarise: ADT has data flushed from calculation, but is NOT yet summarised
  const isInSummary = (ptc) => page.evaluate((id) => document.getElementById(id).classList.contains('in-summary'), `ptcTab${ptc}`);
  assert.strictEqual(await isInSummary('ADT'), false, 'ADT tab must not be in-summary before Summarise is clicked');

  // Verify switching tabs back and forth DOES NOT falsely turn ADT green or oscillate
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), false, 'ADT tab must remain NOT in-summary when switched away');
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), false, 'ADT tab must remain NOT in-summary when switched back');

  // Now click Summarise to fold it into summary
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT tab should have .in-summary class after Summarise');
  assert.strictEqual(await isDirty('ADT'), false, 'ADT tab should not be dirty after Summarise');

  // Switching tabs after Summarise must maintain in-summary (Emerald Green)
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT must stay in-summary when switched to CHD');
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT must stay in-summary when switched back');
  console.log('CHECK9 OK: .in-summary class is applied after clicking Summarise and remains stable across tab switches');

  // --- Dirty edit invalidates .in-summary and triggers popover on Copy Summary ---
  await page.fill('#newFare', '1500');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('ADT'), true, 'Editing field marks ADT dirty');
  assert.strictEqual(await isInSummary('ADT'), false, 'Dirty edit clears in-summary state');

  // Attempt to copy summary with dirty unsummarised data
  await page.click('#copySummaryButton');
  await page.waitForTimeout(100);

  const popoverVisible = await page.evaluate(() => {
    const pop = document.querySelector('.tab-pending-popover');
    return !!pop && pop.textContent.includes('Inputs modified');
  });
  assert.strictEqual(popoverVisible, true, 'Pending tab popover should appear when copying summary with dirty tab');

  const summarisePulsing = await page.evaluate(() => {
    return document.getElementById('summariseButton').classList.contains('summarise-highlight-pulse');
  });
  assert.strictEqual(summarisePulsing, true, 'Summarise button should have summarise-highlight-pulse class');
  console.log('CHECK10 OK: Copy Summary with unsummarised data displays pending popover and pulses Summarise button');

  // Re-summarise dismisses popover and clears pulse
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const popoverDismissed = await page.evaluate(() => document.querySelectorAll('.tab-pending-popover').length === 0);
  assert.strictEqual(popoverDismissed, true, 'Clicking Summarise should dismiss the pending popover');
  const pulseCleared = await page.evaluate(() => !document.getElementById('summariseButton').classList.contains('summarise-highlight-pulse'));
  assert.strictEqual(pulseCleared, true, 'Clicking Summarise should remove the pulse class');
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT should be back to .in-summary state');
  console.log('CHECK11 OK: Summarise dismisses popover, clears pulse, and restores in-summary state');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK12 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
