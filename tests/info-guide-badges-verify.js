const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const artifactDir = 'C:\\Users\\Parth Joshi\\.gemini\\antigravity-ide\\brain\\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6';
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('Testing Section Information Guide Badges & Soft Slate Light Mode...');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  console.log('--- 1. VERIFYING SECTION INFORMATION BADGES & TOOLTIPS ---');
  const expectedTooltips = {
    '#taxSectionHeading .info-guide-badge': 'Directly paste tax breakdown from E-ticket — Tax codes are automatically converted to required format',
    '#parserSectionHeading .info-guide-badge': 'Input fare components and surcharges for NEW fare — total NUC, ROE, and Base Fare are automatically calculated and validated.',
    '#fareSectionHeading .info-guide-badge': 'Enter currency as per filed fare. If issuing in a 2nd currency, enter converted settlement amount in Fare Difference / Change Fee.',
    '#summaryHeading .info-guide-badge': 'Click to generate multi-PTC summary and One-line string. Made changes? Click again to update'
  };

  for (const [selector, expectedText] of Object.entries(expectedTooltips)) {
    const exists = await page.isVisible(selector);
    assert.ok(exists, `Badge must exist for selector: ${selector}`);
    const actualTooltip = await page.$eval(selector, el => el.getAttribute('data-tooltip'));
    const qMarkText = await page.$eval(`${selector} .badge-question-mark`, el => el.textContent.trim());
    console.log(`Badge [${selector}] qMark: "${qMarkText}", tooltip: "${actualTooltip}"`);
    assert.strictEqual(qMarkText, '?', `Question mark symbol must be ?`);
    assert.strictEqual(actualTooltip, expectedText, `Tooltip text mismatch for ${selector}`);
  }
  console.log('All 4 3D Blue Question Mark Information Badges verified successfully with exact text!');

  console.log('\n--- 2. VERIFYING SOFT SLATE LIGHT MODE THEME ---');
  // Populate sample values to visually verify light mode
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '200');
  await page.click('#fareCalcButton');
  await page.fill('#oldTax', 'USD50YQ/USD20AE');
  await page.fill('#newTax', 'USD100YQ/USD20AE');
  await page.click('#taxCalcButton');
  await page.click('#summariseButton');
  await page.waitForTimeout(300);

  console.log('\n--- 2. VERIFYING THEME TOGGLE & COLORS ---');
  // Initial theme must be light by default
  const initialTheme = await page.getAttribute('html', 'data-theme');
  console.log('Initial HTML data-theme attribute (default):', initialTheme);
  assert.strictEqual(initialTheme, 'light', 'Default theme must be light');

  // Verify Light Mode button color is rgb(63, 81, 181) with #F5F5DC text
  const lightBtnBg = await page.evaluate(() => getComputedStyle(document.querySelector('#fareCalcButton')).backgroundColor);
  const lightBtnColor = await page.evaluate(() => getComputedStyle(document.querySelector('#fareCalcButton')).color);
  console.log('Light Mode Button BG:', lightBtnBg);
  console.log('Light Mode Button Color:', lightBtnColor);
  assert.strictEqual(lightBtnBg, 'rgb(63, 81, 181)', 'Light mode button should be rgb(63, 81, 181)');
  assert.strictEqual(lightBtnColor, 'rgb(245, 245, 220)', 'Light mode button text should be rgb(245, 245, 220)');

  // Capture Light Mode Overview with Badge Tooltip
  await page.hover('#taxSectionHeading .info-guide-badge', { force: true });
  await page.waitForTimeout(250);
  const lightImgPath = path.join(artifactDir, 'light_mode_soft_slate_overview.png');
  await page.screenshot({ path: lightImgPath, fullPage: false });
  console.log('Saved Light Mode screenshot to:', lightImgPath);

  // Switch to Dark Mode
  await page.click('#themeToggle');
  await page.waitForTimeout(300);

  const darkThemeAttr = await page.getAttribute('html', 'data-theme');
  console.log('HTML data-theme attribute after toggle to dark:', darkThemeAttr);
  assert.strictEqual(darkThemeAttr, 'dark', 'Theme should be dark after toggle');

  // Verify Dark Mode hero color rgb(63, 81, 181) and button color #F5F5DC
  const darkHeroColor = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).color);
  const darkBtnBg = await page.evaluate(() => getComputedStyle(document.querySelector('#fareCalcButton')).backgroundColor);
  console.log('Dark Mode Hero Color:', darkHeroColor);
  console.log('Dark Mode Button BG:', darkBtnBg);
  assert.strictEqual(darkHeroColor, 'rgb(63, 81, 181)', 'Dark mode hero color should be rgb(63, 81, 181)');
  assert.strictEqual(darkBtnBg, 'rgb(245, 245, 220)', 'Dark mode button should be #F5F5DC = rgb(245, 245, 220)');

  // Capture Dark Mode Overview with Badges
  const darkImgPath = path.join(artifactDir, 'dark_mode_info_badges_overview.png');
  await page.screenshot({ path: darkImgPath, fullPage: false });
  console.log('Saved Dark Mode screenshot to:', darkImgPath);

  // Switch back to Light Mode
  await page.click('#themeToggle');
  await page.waitForTimeout(300);
  const backToLight = await page.getAttribute('html', 'data-theme');
  assert.strictEqual(backToLight, 'light', 'Theme should switch back to light');

  console.log('\n========================================================================');
  console.log('ALL THEME & INFORMATION BADGE TESTS PASSED 100%');
  console.log('========================================================================');
  assert.strictEqual(errors.length, 0, 'Zero console errors expected');

  await browser.close();
})();
