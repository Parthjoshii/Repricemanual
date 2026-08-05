const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  let dialogFired = false;
  page.on('dialog', async (d) => { dialogFired = true; await d.dismiss(); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- Malicious string that fails NUC validation, containing an XSS payload ---
  const malicious = '<img src=x onerror=window.__xss=1> 100.00TLEEPIN1/NDC2 NUC999.00 ROE1.0';
  await page.fill('#fareCalcString', malicious);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  const xssTriggered = await page.evaluate(() => window.__xss === 1);
  assert.strictEqual(xssTriggered, false, 'XSS payload must NOT execute in nucValidation display');

  const nucValidationHtml = await page.$eval('#nucValidation', el => el.innerHTML);
  console.log('nucValidation innerHTML (should show escaped tags, not real elements):', nucValidationHtml.slice(0, 200));
  assert.ok(/&lt;img/i.test(nucValidationHtml), 'Should show the escaped literal text, not an actual <img> tag');
  const hasRealImgTag = await page.$eval('#nucValidation', el => !!el.querySelector('img'));
  assert.strictEqual(hasRealImgTag, false, 'No real <img> element should be created inside nucValidation');
  console.log('CHECK1 OK: NUC-validation-FAIL display escapes malicious input, no script execution');

  // --- Same payload flowing through to the clipboard HTML builder ---
  await page.evaluate((str) => { window.__xss = undefined; }, malicious);
  // Give it a currency + fare too so a real summary renders
  await page.selectOption('#currency', 'AED');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const clipboardHtml = await page.evaluate(() => {
    const tables = document.querySelectorAll('#summary table');
    return buildSummaryHtmlForClipboard(tables);
  });
  console.log('Clipboard HTML snippet:', clipboardHtml.includes('&lt;img') ? 'contains escaped &lt;img (safe)' : 'does NOT contain escaped tag');
  assert.ok(!/<img[^&]/.test(clipboardHtml), 'Clipboard HTML must not contain a live <img> tag');
  console.log('CHECK2 OK: clipboard HTML builder escapes cell content, no injectable markup');

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
