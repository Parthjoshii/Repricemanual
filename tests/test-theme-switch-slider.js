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
    const rb = document.getElementById('reloadButton').getBoundingClientRect();
    const swCenterY = sw.top + sw.height / 2;
    const hpCenterY = hp.top + hp.height / 2;
    const rbCenterY = rb.top + rb.height / 2;
    return {
      swCenterY,
      hpCenterY,
      rbCenterY,
      diffSwHp: Math.abs(swCenterY - hpCenterY),
      diffSwRb: Math.abs(swCenterY - rbCenterY),
      swHeight: sw.height,
      hpHeight: hp.height,
      rbHeight: rb.height
    };
  });
  console.log('Alignment info:', alignment);
  assert.ok(alignment.diffSwHp < 1.5, `Theme switch and Help icon should be vertically centered (diff: ${alignment.diffSwHp}px)`);
  assert.ok(alignment.diffSwRb < 1.5, `Theme switch and Reload button should be vertically centered (diff: ${alignment.diffSwRb}px)`);
  console.log('✓ Theme switch, Help icon, and Reload button are vertically aligned with pixel precision!');

  console.log('--- Test 2: Light Mode slider check & screenshot ---');
  const lightTrackBg = await page.evaluate(() => getComputedStyle(document.querySelector('.switch-track')).backgroundColor);
  console.log('Light Mode Track Background:', lightTrackBg);
  assert.strictEqual(lightTrackBg, 'rgb(27, 160, 242)', 'Light mode switch track should match moon blue #1ba0f2');
  await page.screenshot({ path: path.resolve(__dirname, '../aligned-light-slider.png'), clip: { x: 1040, y: 0, width: 240, height: 75 } });
  console.log('Saved aligned-light-slider.png');

  console.log('--- Test 3: Toggle to Dark Mode ---');
  await page.click('#themeToggle');
  await page.waitForTimeout(450);

  const darkTrackBg = await page.evaluate(() => getComputedStyle(document.querySelector('.switch-track')).backgroundColor);
  const darkThumbBg = await page.evaluate(() => getComputedStyle(document.querySelector('.switch-thumb')).backgroundColor);
  console.log('Dark Mode Track Background:', darkTrackBg);
  console.log('Dark Mode Moon Thumb Background:', darkThumbBg);
  assert.strictEqual(darkTrackBg, 'rgb(250, 232, 164)', 'Dark mode switch track should be vanilla cream/yellow #fae8a4');
  assert.strictEqual(darkThumbBg, 'rgb(27, 160, 242)', 'Dark mode moon thumb background is #1ba0f2');
  assert.strictEqual(lightTrackBg, darkThumbBg, 'Light mode switch track must match dark mode moon thumb blue color!');

  const darkAlignment = await page.evaluate(() => {
    const sw = document.getElementById('themeToggle').getBoundingClientRect();
    const hp = document.getElementById('helpIcon').getBoundingClientRect();
    const rb = document.getElementById('reloadButton').getBoundingClientRect();
    const swCenterY = sw.top + sw.height / 2;
    const hpCenterY = hp.top + hp.height / 2;
    const rbCenterY = rb.top + rb.height / 2;
    return {
      diffSwHp: Math.abs(swCenterY - hpCenterY),
      diffSwRb: Math.abs(swCenterY - rbCenterY)
    };
  });
  assert.ok(darkAlignment.diffSwHp < 1.5, `Dark mode vertical alignment check (diff: ${darkAlignment.diffSwHp}px)`);
  assert.ok(darkAlignment.diffSwRb < 1.5, `Dark mode reload button alignment check (diff: ${darkAlignment.diffSwRb}px)`);

  await page.screenshot({ path: path.resolve(__dirname, '../aligned-dark-slider.png'), clip: { x: 1040, y: 0, width: 240, height: 75 } });
  console.log('Saved aligned-dark-slider.png');

  console.log('--- Test 4: Keyboard shortcut Ctrl+M toggles back ---');
  await page.keyboard.press('Control+m');
  await page.waitForTimeout(450);
  assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'light');
  console.log('✓ Ctrl+M toggled back to light mode');

  console.log('--- Test 5: Reload button check & hover animation ---');
  const reloadBtnVisible = await page.isVisible('#reloadButton');
  assert.strictEqual(reloadBtnVisible, true, 'Reload button must be visible');
  const reloadTitle = await page.getAttribute('.reload-wrapper', 'title');
  assert.ok(reloadTitle && reloadTitle.includes('Reload'), 'Reload wrapper title must indicate reload: ' + reloadTitle);

  // Check button text
  const btnText = await page.textContent('#reloadButton');
  console.log('Reload button text:', btnText.trim());
  assert.strictEqual(btnText.trim(), 'Reload Calculator', 'Button label must be "Reload Calculator"');

  // Verify that legacy detached diamond element no longer exists (zero background layout leakage)
  const diamondCount = await page.$$eval('.reload-icon-diamond', els => els.length);
  assert.strictEqual(diamondCount, 0, 'Detached diamond element must NOT exist in the DOM');

  // Verify inline SVG icon is present inside button
  const hasInlineSvg = await page.$eval('#reloadButton .reload-svg', el => Boolean(el));
  assert.strictEqual(hasInlineSvg, true, 'Inline SVG icon must be present inside reload button');

  // Hover over the reload wrapper
  await page.hover('.reload-wrapper');
  await page.waitForTimeout(400);

  const hoverInfo = await page.evaluate(() => {
    const btn = document.getElementById('reloadButton');
    const svg = btn.querySelector('.reload-svg');
    const btnStyle = getComputedStyle(btn);
    const svgStyle = getComputedStyle(svg);
    return {
      borderColor: btnStyle.borderColor,
      color: btnStyle.color,
      svgTransform: svgStyle.transform,
      svgStroke: svgStyle.stroke
    };
  });
  console.log('Hover state info:', hoverInfo);
  assert.strictEqual(hoverInfo.borderColor, 'rgb(27, 160, 242)', 'Border should turn #1ba0f2 on hover');
  assert.strictEqual(hoverInfo.color, 'rgb(27, 160, 242)', 'Text color should turn #1ba0f2 on hover');
  assert.ok(hoverInfo.svgTransform && hoverInfo.svgTransform !== 'none', 'SVG icon should have rotation transform on hover');

  // Screenshot light mode hover
  await page.screenshot({ path: path.resolve(__dirname, '../aligned-light-slider-hover.png'), clip: { x: 1000, y: 0, width: 280, height: 75 } });
  console.log('Saved aligned-light-slider-hover.png');

  // Verify dark mode hover
  await page.click('#themeToggle');
  await page.waitForTimeout(450);
  await page.hover('.reload-wrapper');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.resolve(__dirname, '../aligned-dark-slider-hover.png'), clip: { x: 1000, y: 0, width: 280, height: 75 } });
  console.log('Saved aligned-dark-slider-hover.png');

  // Toggle back to light mode
  await page.keyboard.press('Control+m');
  await page.waitForTimeout(450);

  // Verify reload button invokes window.location.reload by awaiting navigation
  const reloadPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await page.click('#reloadButton');
  await reloadPromise;
  console.log('✓ Reload button triggers page reload successfully');

  assert.strictEqual(errors.length, 0, 'Zero errors');
  await browser.close();
  console.log('ALL ALIGNMENT, SLIDER DESIGN, AND RELOAD BUTTON TESTS PASSED!');
})();
