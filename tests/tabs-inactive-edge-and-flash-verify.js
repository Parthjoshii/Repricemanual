const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  console.log('1. Checking inactive tab edge styling...');
  const chdBorder = await page.$eval('#ptcTabCHD', el => window.getComputedStyle(el).borderTopWidth);
  assert.ok(parseFloat(chdBorder) >= 1, 'Inactive tab must have crisp border edge definition');

  console.log('2. Checking stable tab dimensions for zero-flash switching...');
  const adtHeight = await page.$eval('#ptcTabADT', el => window.getComputedStyle(el).height);
  const chdHeight = await page.$eval('#ptcTabCHD', el => window.getComputedStyle(el).height);
  assert.strictEqual(adtHeight, chdHeight, 'Active and inactive tab buttons must share identical stable height');

  const adtPadding = await page.$eval('#ptcTabADT', el => window.getComputedStyle(el).paddingLeft);
  const chdPadding = await page.$eval('#ptcTabCHD', el => window.getComputedStyle(el).paddingLeft);
  assert.strictEqual(adtPadding, chdPadding, 'Active and inactive tab buttons must share identical stable horizontal padding');

  console.log('3. Checking help button z-index layer elevation...');
  const helpZIndex = await page.$eval('.minimal-help-btn', el => window.getComputedStyle(el).zIndex);
  assert.strictEqual(helpZIndex, '20', 'Minimal help button must have z-index: 20');

  console.log('4. Checking switch from ADT to CHD does not jump tab button width or height...');
  const chdBeforeBox = await (await page.$('#ptcTabCHD')).boundingBox();
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(300);
  const chdAfterBox = await (await page.$('#ptcTabCHD')).boundingBox();
  assert.strictEqual(Math.round(chdBeforeBox.height), Math.round(chdAfterBox.height), 'CHD height must remain constant after becoming active');
  assert.strictEqual(Math.round(chdBeforeBox.width), Math.round(chdAfterBox.width), 'CHD width must remain constant after becoming active');

  console.log('✓ All tab edge, zero-flash, and help button tests passed!');
  await browser.close();
  process.exit(0);
})();
