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

  // ADT tab: checkbox row should be hidden
  const adtRowVisible = await page.isVisible('#autoCalcFromAdultRow');
  assert.strictEqual(adtRowVisible, false, 'Auto-calc row should be hidden on ADT tab');
  console.log('CHECK1 OK: auto-calc row hidden on ADT tab');

  // Toggle ON before ADT validated -> should error and revert
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  const cnnRowVisible = await page.isVisible('#autoCalcFromAdultRow');
  assert.strictEqual(cnnRowVisible, true, 'Auto-calc row should be visible on CNN tab');
  await page.click('#autoCalcFromAdult');
  await page.waitForTimeout(100);
  const errorVisible = await page.isVisible('#errorModal.show');
  assert.ok(errorVisible, 'Expected error when toggling ON before ADT validated');
  await page.click('.modal-close-btn');
  const checkedAfterError = await page.isChecked('#autoCalcFromAdult');
  assert.strictEqual(checkedAfterError, false, 'Checkbox should revert to unchecked');
  console.log('CHECK2 OK: toggling ON before ADT validated shows error and reverts');

  // Go to ADT, validate a fare calc string
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  const adtString = 'BOM EK DXB Q10.00 400.00TLEEPIN1/NDC2 NUC410.00 ROE1.0';
  await page.fill('#fareCalcString', adtString);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const nucValidationAdt = await page.$eval('#nucValidation', el => el.textContent);
  console.log('ADT NUC validation:', nucValidationAdt);
  assert.ok(nucValidationAdt.includes('PASS'), 'ADT string should validate PASS');

  // Switch to CNN, toggle ON
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(150);
  const cnnFieldValue = await page.inputValue('#fareCalcString');
  console.log('CNN derived string:', cnnFieldValue);
  assert.ok(cnnFieldValue.includes('Q7.50'), 'Expected Q surcharge scaled to 75%: ' + cnnFieldValue);
  assert.ok(cnnFieldValue.includes('300.00TLEEPIN1CH/NDC2'), 'Expected fare scaled to 75% with CH suffix: ' + cnnFieldValue);
  assert.ok(cnnFieldValue.includes('NUC307.50'), 'Expected recomputed NUC: ' + cnnFieldValue);
  assert.ok(cnnFieldValue.includes('ROE1.0'), 'Expected ROE unchanged: ' + cnnFieldValue);
  const cnnNucValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(cnnNucValidation.includes('PASS'), 'Derived CNN string should self-validate PASS: ' + cnnNucValidation);
  const cnnReadOnly = await page.$eval('#fareCalcString', el => el.readOnly);
  const cnnParseDisabled = await page.$eval('#parseButton', el => el.disabled);
  assert.ok(cnnReadOnly, 'Field should be readonly while auto-calc is ON');
  assert.ok(cnnParseDisabled, 'Convert button should be disabled while auto-calc is ON');
  console.log('CHECK3 OK: CNN auto-derives 75% scaled string, validates PASS, field locked');

  // Switch to INF, toggle ON
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  await page.check('#autoCalcFromAdult');
  await page.waitForTimeout(150);
  const infFieldValue = await page.inputValue('#fareCalcString');
  console.log('INF derived string:', infFieldValue);
  assert.ok(infFieldValue.includes('Q1.00'), 'Expected Q surcharge scaled to 10%: ' + infFieldValue);
  assert.ok(infFieldValue.includes('40.00TLEEPIN1IN/NDC2'), 'Expected fare scaled to 10% with IN suffix: ' + infFieldValue);
  assert.ok(infFieldValue.includes('NUC41.00'), 'Expected recomputed NUC: ' + infFieldValue);
  console.log('CHECK4 OK: INF auto-derives 10% scaled string');

  // Toggle OFF on INF -> field editable again, value retained
  await page.uncheck('#autoCalcFromAdult');
  await page.waitForTimeout(100);
  const infReadOnlyAfterOff = await page.$eval('#fareCalcString', el => el.readOnly);
  assert.strictEqual(infReadOnlyAfterOff, false, 'Field should be editable after toggling OFF');
  const infValueAfterOff = await page.inputValue('#fareCalcString');
  assert.strictEqual(infValueAfterOff, infFieldValue, 'Value should be retained after toggling OFF');
  console.log('CHECK5 OK: toggling OFF re-enables editing, retains last derived value');

  // Switch back to CNN -> should still show its own derived value (per-tab state preserved)
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  const cnnFieldValueAgain = await page.inputValue('#fareCalcString');
  assert.strictEqual(cnnFieldValueAgain, cnnFieldValue, 'CNN tab should retain its own derived value on switch-back');
  const cnnCheckedAgain = await page.isChecked('#autoCalcFromAdult');
  assert.ok(cnnCheckedAgain, 'CNN auto-calc checkbox should stay ON (per-tab state)');
  console.log('CHECK6 OK: per-tab auto-calc state preserved across tab switches');

  // Edit ADT string without reconverting -> invalidates source; switching to CNN (still ON) should not crash
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  await page.fill('#fareCalcString', 'BOM EK DXB Q10.00 500.00TLEEPIN1/NDC2 NUC510.00 ROE1.0');
  await page.waitForTimeout(100);
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(150);
  const cnnFieldAfterStaleAdtEdit = await page.inputValue('#fareCalcString');
  console.log('CNN field after ADT edited-but-not-reconverted, then switched to CNN:', cnnFieldAfterStaleAdtEdit);
  assert.strictEqual(cnnFieldAfterStaleAdtEdit, cnnFieldValue, 'Should keep last-derived value untouched since ADT source was invalidated');
  console.log('CHECK7 OK: unvalidated ADT edit does not corrupt CNN derived value, no crash');

  // Now reconvert ADT with the new amount, switch to CNN again -> should re-derive with new numbers
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(150);
  const cnnFieldAfterReconvert = await page.inputValue('#fareCalcString');
  console.log('CNN field after ADT reconverted to 500 and switching back:', cnnFieldAfterReconvert);
  assert.ok(cnnFieldAfterReconvert.includes('375.00'), 'Expected re-derivation with new 75% of 500: ' + cnnFieldAfterReconvert);
  console.log('CHECK8 OK: switching into CNN re-derives from freshly revalidated ADT data');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK9 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
