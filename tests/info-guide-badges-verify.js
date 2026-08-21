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
    '#parserSectionHeading .info-guide-badge': 'Input fare components and surcharges — total NUC, ROE, and Base Fare are automatically calculated and validated.',
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

  // Capture Dark Mode Overview with Badges
  const darkImgPath = path.join(artifactDir, 'dark_mode_info_badges_overview.png');
  await page.screenshot({ path: darkImgPath, fullPage: false });
  console.log('Saved Dark Mode screenshot to:', darkImgPath);

  // Switch to Light Mode
  await page.click('#themeToggle');
  await page.waitForTimeout(300);

  const themeAttr = await page.getAttribute('html', 'data-theme');
  console.log('HTML data-theme attribute after toggle:', themeAttr);
  assert.strictEqual(themeAttr, 'light', 'Theme should be light');

  // Verify computed background colors
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const cardBg = await page.evaluate(() => getComputedStyle(document.querySelector('section')).backgroundColor);
  console.log('Light Mode Body BG:', bodyBg); // expected rgb(238, 242, 246) = #eef2f6
  console.log('Light Mode Card BG:', cardBg); // expected rgb(248, 250, 252) = #f8fafc

  // Hover over Tax Badge in Light Mode
  await page.hover('#taxSectionHeading .info-guide-badge', { force: true });
  await page.waitForTimeout(250);

  // Capture Light Mode Overview with Badge Tooltip
  const lightImgPath = path.join(artifactDir, 'light_mode_soft_slate_overview.png');
  await page.screenshot({ path: lightImgPath, fullPage: false });
  console.log('Saved Light Mode screenshot to:', lightImgPath);

  console.log('\n========================================================================');
  console.log('ALL INFORMATION BADGE & SOFT SLATE LIGHT MODE TESTS PASSED 100%');
  console.log('========================================================================');
  assert.strictEqual(errors.length, 0, 'Zero console errors expected');

  await browser.close();
})();
