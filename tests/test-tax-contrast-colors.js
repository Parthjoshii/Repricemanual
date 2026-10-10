const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  // Input taxes to show positive and negative taxes
  await page.fill('#oldTax', 'USD50US/USD80YQ');
  await page.fill('#newTax', 'USD100US/USD30YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);

  console.log('--- Test 1: Light Mode Tax Colors ---');
  // Default is light mode
  const lightColors = await page.evaluate(() => {
    const posEl = document.querySelector('#taxResult .pos');
    const negEl = document.querySelector('#taxResult .neg');
    return {
      posColor: getComputedStyle(posEl).color,
      posWeight: getComputedStyle(posEl).fontWeight,
      negColor: getComputedStyle(negEl).color,
      negWeight: getComputedStyle(negEl).fontWeight,
    };
  });
  console.log('Light mode tax colors:', lightColors);

  // #15803d is rgb(21, 128, 61)
  assert.strictEqual(lightColors.posColor, 'rgb(21, 128, 61)', 'Positive taxes should be deep emerald green #15803d in light mode');
  // #b91c1c is rgb(185, 28, 28)
  assert.strictEqual(lightColors.negColor, 'rgb(185, 28, 28)', 'Negative taxes should be deep crimson red #b91c1c in light mode');
  assert.strictEqual(lightColors.posWeight, '600', 'Positive taxes should have font-weight 600');
  assert.strictEqual(lightColors.negWeight, '600', 'Negative taxes should have font-weight 600');
  console.log('✓ Light mode tax colors are high contrast (#15803d and #b91c1c, 600 weight)');

  console.log('--- Test 2: Dark Mode Tax Colors ---');
  await page.click('#themeToggle');
  await page.waitForTimeout(450);

  const darkColors = await page.evaluate(() => {
    const posEl = document.querySelector('#taxResult .pos');
    const negEl = document.querySelector('#taxResult .neg');
    return {
      posColor: getComputedStyle(posEl).color,
      negColor: getComputedStyle(negEl).color,
    };
  });
  console.log('Dark mode tax colors:', darkColors);
  // #86efac is rgb(134, 239, 172)
  assert.strictEqual(darkColors.posColor, 'rgb(134, 239, 172)', 'Positive taxes in dark mode');
  // #fca5a5 is rgb(252, 165, 165)
  assert.strictEqual(darkColors.negColor, 'rgb(252, 165, 165)', 'Negative taxes in dark mode');
  console.log('✓ Dark mode tax colors are preserved');

  assert.strictEqual(errors.length, 0, 'Zero errors');
  await browser.close();
  console.log('ALL TAX COLOR TESTS PASSED!');
})();
