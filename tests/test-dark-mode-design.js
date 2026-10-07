const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  // Switch to dark mode
  await page.click('#themeToggle');
  await page.waitForTimeout(300);

  // Enter data in ADT tab
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '300');
  await page.fill('#newFare', '800');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // Switch to CNN tab and enter data
  await page.click('.ptc-tab[data-ptc="CNN"]');
  await page.waitForTimeout(100);
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '200');
  await page.fill('#newFare', '500');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  // Take screenshot of top section showing h1 and tabs
  await page.screenshot({ path: path.resolve(__dirname, '../dark-mode-preview.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
  console.log('Saved dark-mode-preview.png top view');

  await browser.close();
})();
