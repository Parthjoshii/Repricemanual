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

  console.log('--- Test 1: Vertical alignment check ---');
  const alignment = await page.evaluate(() => {
    const sw = document.getElementById('themeToggle').getBoundingClientRect();
    const hp = document.getElementById('helpIcon').getBoundingClientRect();
    const swCenterY = sw.top + sw.height / 2;
    const hpCenterY = hp.top + hp.height / 2;
    return {
      swCenterY,
      hpCenterY,
      diff: Math.abs(swCenterY - hpCenterY),
      swHeight: sw.height,
      hpHeight: hp.height
    };
  });
  console.log('Alignment info:', alignment);
  assert.ok(alignment.diff < 1.5, `Theme switch and Help icon should be vertically centered (diff: ${alignment.diff}px)`);
  console.log('✓ Theme switch and Help icon are vertically aligned with pixel precision!');

  console.log('--- Test 2: Light Mode slider screenshot ---');
  await page.screenshot({ path: path.resolve(__dirname, '../aligned-light-slider.png'), clip: { x: 1080, y: 0, width: 200, height: 75 } });
  console.log('Saved aligned-light-slider.png');

  console.log('--- Test 3: Toggle to Dark Mode ---');
  await page.click('#themeToggle');
  await page.waitForTimeout(450);

  const darkAlignment = await page.evaluate(() => {
    const sw = document.getElementById('themeToggle').getBoundingClientRect();
    const hp = document.getElementById('helpIcon').getBoundingClientRect();
    const swCenterY = sw.top + sw.height / 2;
    const hpCenterY = hp.top + hp.height / 2;
    return {
      diff: Math.abs(swCenterY - hpCenterY)
    };
  });
  assert.ok(darkAlignment.diff < 1.5, `Dark mode vertical alignment check (diff: ${darkAlignment.diff}px)`);

  await page.screenshot({ path: path.resolve(__dirname, '../aligned-dark-slider.png'), clip: { x: 1080, y: 0, width: 200, height: 75 } });
  console.log('Saved aligned-dark-slider.png');

  console.log('--- Test 4: Keyboard shortcut Ctrl+M toggles back ---');
  await page.keyboard.press('Control+m');
  await page.waitForTimeout(450);
  assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'light');
  console.log('✓ Ctrl+M toggled back to light mode');

  assert.strictEqual(errors.length, 0, 'Zero errors');
  await browser.close();
  console.log('ALL ALIGNMENT AND SLIDER DESIGN TESTS PASSED!');
})();
