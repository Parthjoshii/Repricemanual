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
  const isInSummary = (ptc) => page.evaluate((id) => document.getElementById(id).classList.contains('in-summary'), `ptcTab${ptc}`);
  const getDotBg = (ptc) => page.evaluate((id) => {
    const dot = document.querySelector(`#${id} .ptc-tab-dot`);
    return dot ? window.getComputedStyle(dot).backgroundColor : null;
  }, `ptcTab${ptc}`);

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Step 1: Input fare calculation string on ADT and summarise
  const adtString = 'BOM EK DXB Q10.00 400.00TLEEPIN1/NDC2 NUC410.00 ROE1.0';
  await page.fill('#fareCalcString', adtString);
  await page.click('#parseButton');
  await page.waitForTimeout(100);
  await page.click('#summariseButton');
  await page.waitForTimeout(250);

  assert.strictEqual(await isInSummary('ADT'), true, 'ADT tab should have .in-summary (Green)');
  assert.strictEqual(await isDirty('ADT'), false, 'ADT tab should not be dirty');
  console.log('CHECK1 OK: ADT summarised and green');

  // Step 2: Switch to CHD tab
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('CHD'), false, 'CHD fresh tab should not be in summary');
  assert.strictEqual(await isDirty('CHD'), false, 'CHD fresh tab should not be dirty');
  console.log('CHECK2 OK: CHD fresh tab is clean');

  // Step 3: Toggle 'Auto Calculate from Adult'
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(250);

  assert.strictEqual(await isDirty('CHD'), true, 'CHD tab should be marked dirty after auto-calculate');
  assert.strictEqual(await isInSummary('CHD'), false, 'CHD tab should not be in summary yet');
  const chdDotColor = await getDotBg('CHD');
  console.log('CHD dot computed background:', chdDotColor);
  assert.ok(chdDotColor.includes('245, 158, 11'), 'CHD dot must be Amber (245, 158, 11)');
  console.log('CHECK3 OK: CHD dot turns Amber upon toggling Auto Calculate');

  // Step 4: Click Copy Summary -> must be blocked with popover pointing to CHD
  await page.click('#copySummaryButton');
  await page.waitForTimeout(100);

  let popoverVisible = await page.evaluate(() => {
    const pop = document.querySelector('.tab-pending-popover');
    return !!pop && pop.textContent.includes('Inputs modified');
  });
  assert.strictEqual(popoverVisible, true, 'Pending tab popover should appear on Copy Summary');

  let pulse = await page.evaluate(() => document.getElementById('summariseButton').classList.contains('summarise-highlight-pulse'));
  assert.strictEqual(pulse, true, 'Summarise button should pulse');
  console.log('CHECK4 OK: Copy Summary blocked with pending popover pointing to CHD');

  // Step 5: Switch back to ADT -> ADT is green, CHD remains amber!
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT must remain green');
  assert.strictEqual(await isDirty('CHD'), true, 'CHD must remain dirty (Amber) when switched away');
  console.log('CHECK5 OK: Tab switch preserves ADT green and CHD amber');

  // Step 6: Click Copy Summary from ADT -> should STILL block with popover pointing to CHD
  await page.click('#copySummaryButton');
  await page.waitForTimeout(100);

  popoverVisible = await page.evaluate(() => {
    const pop = document.querySelector('.tab-pending-popover');
    return !!pop && pop.textContent.includes('Inputs modified');
  });
  assert.strictEqual(popoverVisible, true, 'Pending tab popover should point to CHD even when on ADT');
  console.log('CHECK6 OK: Copy Summary blocked from ADT because CHD has unsummarised changes');

  // Step 7: Click Summarise (from ADT) -> folds both ADT and CHD into summary!
  await page.click('#summariseButton');
  await page.waitForTimeout(250);

  assert.strictEqual(await isInSummary('ADT'), true, 'ADT must be in summary (Green)');
  assert.strictEqual(await isDirty('ADT'), false, 'ADT must not be dirty');
  assert.strictEqual(await isInSummary('CHD'), true, 'CHD must now be in summary (Green)');
  assert.strictEqual(await isDirty('CHD'), false, 'CHD must no longer be dirty');

  const adtDotGreen = await getDotBg('ADT');
  const chdDotGreen = await getDotBg('CHD');
  console.log('Post-summarise ADT dot:', adtDotGreen, 'CHD dot:', chdDotGreen);
  assert.ok(adtDotGreen.includes('22, 163, 74') || adtDotGreen.includes('16, 185, 129'), 'ADT dot must be Green');
  assert.ok(chdDotGreen.includes('22, 163, 74') || chdDotGreen.includes('16, 185, 129'), 'CHD dot must be Green');

  popoverVisible = await page.evaluate(() => document.querySelectorAll('.tab-pending-popover').length > 0);
  assert.strictEqual(popoverVisible, false, 'Pending popover should be dismissed after Summarise');
  console.log('CHECK7 OK: Summarise turns both ADT and CHD Green and dismisses popover');

  // Step 8: Copy Summary now succeeds without any popover
  await page.click('#copySummaryButton');
  await page.waitForTimeout(100);
  popoverVisible = await page.evaluate(() => document.querySelectorAll('.tab-pending-popover').length > 0);
  assert.strictEqual(popoverVisible, false, 'Copy Summary succeeds with no pending popover');

  // Dismiss modal if present
  if (await page.isVisible('#errorModal.show')) {
    await page.click('#errorModal .modal-close-btn');
    await page.waitForTimeout(100);
  }
  console.log('CHECK8 OK: Copy Summary succeeds cleanly when all tabs are summarised');

  // Step 9: Switching tabs back and forth maintains Green state on both
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT remains green when switched to CHD');
  assert.strictEqual(await isInSummary('CHD'), true, 'CHD remains green when active');
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  assert.strictEqual(await isInSummary('ADT'), true, 'ADT remains green');
  assert.strictEqual(await isInSummary('CHD'), true, 'CHD remains green');
  console.log('CHECK9 OK: Tab switching maintains Green state on both tabs without oscillation');

  // Step 10: Modifying ADT FCS invalidates both ADT and dependent CHD tab!
  await page.fill('#fareCalcString', 'BOM EK DXB Q10.00 500.00TLEEPIN1/NDC2 NUC510.00 ROE1.0');
  await page.waitForTimeout(100);
  assert.strictEqual(await isDirty('ADT'), true, 'ADT marked dirty on edit');
  assert.strictEqual(await isDirty('CHD'), true, 'CHD marked dirty because ADT source changed');
  console.log('CHECK10 OK: Editing ADT invalidates both ADT and auto-calc dependent CHD');

  // Step 11: Verify zero console errors
  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK11 OK: Zero console errors');

  console.log('\nALL 11 CHECKS PASSED PERFECTLY!');
  await browser.close();
})().catch(async (err) => {
  console.error('ERROR in test:', err);
  process.exit(1);
});
