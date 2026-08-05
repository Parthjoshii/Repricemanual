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

  const adtString = 'BOM EK DXB Q3.13Q24.94 623.52OAAOPIN1/NDC2 NUC651.59 ROE95.593911';
  await page.fill('#fareCalcString', adtString);
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  const nucValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(nucValidation.includes('PASS'), 'ADT consecutive-Q string should validate PASS: ' + nucValidation);

  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  await page.click('#autoCalcFromAdult');
  await page.waitForTimeout(150);
  const cnnValue = await page.inputValue('#fareCalcString');
  console.log('CNN derived (consecutive Q):', cnnValue);
  // 3.13*0.75=2.3475->2.35, 24.94*0.75=18.705->18.71(round-half-up), 623.52*0.75=467.64
  assert.ok(cnnValue.includes('Q2.35'), 'first Q scaled: ' + cnnValue);
  assert.ok(cnnValue.includes('Q18.71') || cnnValue.includes('Q18.70'), 'second Q scaled: ' + cnnValue);
  assert.ok(cnnValue.includes('467.64'), 'fare component scaled: ' + cnnValue);
  const cnnNucValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(cnnNucValidation.includes('PASS'), 'derived consecutive-Q string should self-validate PASS: ' + cnnNucValidation);
  console.log('CHECK OK: consecutive Q-surcharges both scaled correctly, derived string self-validates');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('ALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
