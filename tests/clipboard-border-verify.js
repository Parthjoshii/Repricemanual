const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- Border weight check ---
  const tableBorder = await page.evaluate(() => {
    const table = document.createElement('table');
    document.body.appendChild(table);
    const style = getComputedStyle(table).borderTopWidth;
    table.remove();
    return style;
  });
  console.log('table border width:', tableBorder);
  assert.strictEqual(tableBorder, '3px', 'Expected 3px table border');

  // --- Fill fare data and summarise so a summary table exists ---
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const thBorder = await page.$eval('#summary th', el => getComputedStyle(el).borderTopWidth);
  const tdBorder = await page.$eval('#summary td', el => getComputedStyle(el).borderTopWidth);
  console.log('th border:', thBorder, '| td border:', tdBorder);
  assert.strictEqual(thBorder, '3px');
  assert.strictEqual(tdBorder, '3px');
  console.log('CHECK1 OK: summary table borders are 3px (bold)');

  // --- Copy Summary and inspect clipboard for both text/plain and text/html ---
  await page.click('#copySummaryButton');
  await page.waitForTimeout(200);

  const clipboardHtml = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        return await blob.text();
      }
    }
    return null;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  console.log('Clipboard HTML (first 300 chars):', (clipboardHtml || '').slice(0, 300));
  console.log('Clipboard plain text (first 200 chars):', (clipboardText || '').slice(0, 200));

  assert.ok(clipboardHtml, 'Expected text/html to be present on the clipboard');
  assert.ok(clipboardHtml.includes('<table'), 'Clipboard HTML should contain a <table> element');
  assert.ok(clipboardHtml.includes('border:3px solid'), 'Clipboard HTML table should have inline 3px border styling');
  assert.ok(clipboardHtml.includes('Old Fare'), 'Clipboard HTML should contain the row labels');
  assert.ok(clipboardText.includes('Old Fare\tAED1000.00'), 'Clipboard plain-text fallback should still be tab-separated');
  console.log('CHECK2 OK: clipboard has both rich HTML (table survives paste) and plain-text fallback');

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
