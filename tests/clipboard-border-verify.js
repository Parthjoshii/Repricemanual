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
  const thBg = await page.$eval('#summary th', el => getComputedStyle(el).backgroundColor);
  console.log('th border:', thBorder, '| td border:', tdBorder, '| th bg:', thBg);
  assert.strictEqual(thBorder, '3px');
  assert.strictEqual(tdBorder, '3px');
  assert.strictEqual(thBg, 'rgb(255, 255, 0)', 'Summary header should have yellow background');
  const disclaimerTextDom = await page.$eval('#summary .summary-disclaimer', el => el.textContent.trim());
  assert.strictEqual(disclaimerTextDom, 'Please note that the fares are not guaranteed until ticketed and are subject to change as per availability');
  console.log('CHECK1 OK: summary table borders are 3px (bold), yellow header, and disclaimer rendered');

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
  assert.ok(clipboardHtml.includes('#ffff00') || clipboardHtml.includes('#FFFF00'), 'Clipboard HTML table should have yellow header');
  assert.ok(clipboardHtml.includes('Please note that the fares are not guaranteed until ticketed and are subject to change as per availability'), 'Clipboard HTML should include disclaimer note');
  assert.ok(clipboardHtml.includes('Old Fare'), 'Clipboard HTML should contain the row labels');
  assert.ok(clipboardText.includes('Old Fare\tAED1000.00'), 'Clipboard plain-text fallback should still be tab-separated');
  assert.ok(clipboardText.includes('Please note that the fares are not guaranteed until ticketed and are subject to change as per availability'), 'Clipboard plain-text should include disclaimer note');
  console.log('CHECK2 OK: clipboard has rich HTML (yellow header, centered cells, bold borders, disclaimer) and plain-text fallback');

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
