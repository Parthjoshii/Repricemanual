const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Fill ADT fare data
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  // Add a custom tab
  await page.click('#ptcAddTabButton');
  await page.waitForTimeout(100);
  await page.fill('#ptcPromptInput', 'Group Fare');
  await page.click('#ptcPromptOkBtn');
  await page.waitForTimeout(150);
  await page.fill('#oldFare', '500');
  await page.fill('#newFare', '600');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  // Switch to CNN and leave a fare-calc string there
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  const cnnString = 'BOM EK DXB 300.00TLEEPIN1CH/NDC2 NUC300.00 ROE1.0';
  await page.fill('#fareCalcString', cnnString);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  // Stay on CNN as the active tab, then reload the page (new page, same storage/context)
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(200);

  const errorsAfterReload = [...errors];

  // Active tab should still be CNN
  const activeTab = await page.getAttribute('.ptc-tab[aria-selected="true"]', 'data-ptc');
  assert.strictEqual(activeTab, 'CNN', 'Active tab should be restored to CNN: ' + activeTab);
  const cnnFieldValue = await page.inputValue('#fareCalcString');
  assert.strictEqual(cnnFieldValue, cnnString, 'CNN fare calc string should survive reload');
  console.log('CHECK1 OK: active tab and its live field values restored after reload');

  // ADT tab data should be restored too
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  const adtOldFare = await page.inputValue('#oldFare');
  const adtNewFare = await page.inputValue('#newFare');
  assert.strictEqual(adtOldFare, '1000', 'ADT Old Fare should be restored: ' + adtOldFare);
  assert.strictEqual(adtNewFare, '1200', 'ADT New Fare should be restored: ' + adtNewFare);
  console.log('CHECK2 OK: ADT tab data restored after reload');

  // Custom tab should exist with its data and label
  const customTabExists = await page.isVisible('.ptc-tab[data-ptc="GROUPFARE"], .ptc-tab:has-text("Group Fare")');
  const allTabTexts = await page.$$eval('.ptc-tab .ptc-tab-label, .ptc-tab', els => els.map(e => e.textContent));
  console.log('Tabs after reload:', allTabTexts);
  const customBtn = await page.$('.ptc-tab.custom');
  assert.ok(customBtn, 'Custom tab should be re-created after reload');
  const customLabel = await customBtn.textContent();
  assert.ok(customLabel.includes('Group Fare'), 'Custom tab label should be restored: ' + customLabel);
  await customBtn.click();
  await page.waitForTimeout(100);
  const customOldFare = await page.inputValue('#oldFare');
  assert.strictEqual(customOldFare, '500', 'Custom tab data should be restored: ' + customOldFare);
  console.log('CHECK3 OK: custom tab (button + label + data) restored after reload');

  // Summarise should work correctly post-reload (data wasn't silently corrupted)
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const headers = await page.$$eval('#summary thead th', ths => ths.map(th => th.textContent));
  console.log('Summary headers after reload:', headers);
  assert.ok(headers.length >= 3, 'Expected multiple PTCs with data in summary after reload: ' + JSON.stringify(headers));
  console.log('CHECK4 OK: Summarise works correctly on restored data');

  console.log('CONSOLE_ERRORS (post-reload):', JSON.stringify(errorsAfterReload));
  assert.strictEqual(errorsAfterReload.length, 0, 'Expected zero console errors after reload');
  console.log('CHECK5 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
