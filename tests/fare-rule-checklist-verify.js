const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForLoadState('domcontentloaded');

  console.log('--- 1. Initial State: HUD should be hidden when textarea is empty ---');
  const initialDisplay = await page.$eval('#fareRuleChecklistSection', el => el.style.display);
  assert.strictEqual(initialDisplay, 'none', 'HUD section should be hidden initially');

  console.log('--- 2. Triggering on Input: Typing in fareCalcString reveals HUD ---');
  const testFcs = 'BOM EK DXB 300.00TLEEPIN1/NDC2 EK BOM 250.00TLEEPIN1/NDC2 NUC550.00 ROE1.0';
  await page.fill('#fareCalcString', testFcs);
  await page.waitForTimeout(100);

  const displayAfterInput = await page.$eval('#fareRuleChecklistSection', el => window.getComputedStyle(el).display);
  assert.strictEqual(displayAfterInput, 'block', 'HUD should be visible after entering FCS');

  console.log('--- 3. Verify Surcharge Alert Banner text ---');
  const bannerInfo = await page.$eval('#surchargeWarningNotice', el => {
    return {
      text: el.textContent.trim(),
      isWarning: el.classList.contains('warning-state')
    };
  });
  assert.ok(bannerInfo.isWarning, 'Surcharge notice banner must have warning-state class');
  assert.ok(
    bannerInfo.text.includes('Important - Check all surcharges are calculated. Especially FZ surcharge') ||
    (bannerInfo.text.includes('Important - Check all surcharges are calculated') && bannerInfo.text.includes('FZ surcharge')),
    `Banner must contain requested FZ surcharge text. Actual: ${bannerInfo.text}`
  );

  console.log('--- 4. Verify all 6 Rule Guidance Pills ---');
  const pills = await page.$$eval('.fare-rule-pill', list => list.map(el => {
    const label = el.querySelector('.pill-label')?.textContent.trim() || '';
    const badge = el.querySelector('.pill-badge-critical')?.textContent.trim() || '';
    const warningIcon = el.querySelector('.pill-warning-icon')?.textContent.trim() || '';
    const isCritical = el.classList.contains('pill-critical');
    return { label, badge, warningIcon, isCritical };
  }));

  assert.strictEqual(pills.length, 6, 'Must contain exactly 6 rule guidance pills');

  const expectedLabels = [
    'Flight Application',
    'Day/Time Application',
    'Stopover',
    'Combinability',
    'Seasonality',
    'Surcharges'
  ];

  expectedLabels.forEach((exp, idx) => {
    assert.strictEqual(pills[idx].label, exp, `Pill ${idx + 1} label should be "${exp}"`);
  });

  // Verify Surcharges pill has critical emphasis and warning icon
  const surchargePill = pills[5];
  assert.ok(surchargePill.isCritical, 'Surcharges pill must have .pill-critical class');
  assert.strictEqual(surchargePill.badgeText || surchargePill.badge, 'CRITICAL', 'Surcharges pill must have CRITICAL badge');
  assert.strictEqual(surchargePill.warningIcon, '⚠️', 'Surcharges pill must have ⚠️ warning icon');

  // Verify first 5 pills have no emojis and no category numbers (clean typography)
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(pills[i].isCritical, false, `Pill ${i + 1} should not be critical`);
    assert.strictEqual(pills[i].warningIcon, '', `Pill ${i + 1} should have no warning icon`);
    assert.ok(!pills[i].label.includes('Cat'), `Pill ${i + 1} should not include category code`);
  }

  console.log('--- 5. Verify Zero Interaction Cost (No checkboxes, instant Convert) ---');
  const checkboxCount = await page.$$eval('#fareRuleChecklistSection input[type="checkbox"]', list => list.length);
  assert.strictEqual(checkboxCount, 0, 'HUD must require 0 checkboxes (zero-click interaction cost)');

  await page.click('#parseButton');
  await page.waitForTimeout(150);

  const nucValText = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(nucValText.includes('PASS'), 'NUC validation should PASS immediately');

  const hudVisibleAfterConvert = await page.$eval('#fareRuleChecklistSection', el => window.getComputedStyle(el).display);
  assert.strictEqual(hudVisibleAfterConvert, 'block', 'HUD should remain visible after Convert');

  console.log('--- 6. Verify PTC Cross-Tab Persistence ---');
  // Switch to CHD tab
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);

  // In CHD tab without FCS, HUD should be hidden
  const chdChecklistDisplay = await page.$eval('#fareRuleChecklistSection', el => el.style.display);
  assert.strictEqual(chdChecklistDisplay, 'none', 'CHD HUD should be hidden initially');

  // Switch back to ADT tab
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);

  // ADT HUD should be visible
  const restoredDisplay = await page.$eval('#fareRuleChecklistSection', el => el.style.display);
  assert.strictEqual(restoredDisplay, 'block', 'ADT HUD should restore visible state');

  console.log('--- 7. Verify Clear Parser resets HUD and hides it ---');
  await page.click('#parserClearButton');
  await page.waitForTimeout(100);

  const displayAfterClear = await page.$eval('#fareRuleChecklistSection', el => el.style.display);
  assert.strictEqual(displayAfterClear, 'none', 'HUD should hide on clear');

  console.log('--- 8. Verify Theme Switching Parity ---');
  // Type FCS again
  await page.fill('#fareCalcString', testFcs);
  await page.waitForTimeout(60);

  const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
  await page.click('#themeToggle');
  await page.waitForTimeout(450);

  const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert.notStrictEqual(toggledTheme, initialTheme, 'Theme should successfully toggle');

  const hudDisplay = await page.$eval('#fareRuleChecklistSection', el => window.getComputedStyle(el).display);
  assert.strictEqual(hudDisplay, 'block', 'HUD should remain visible across theme changes');

  // Toggle back
  await page.click('#themeToggle');
  await page.waitForTimeout(450);

  await browser.close();
  console.log('\n>>> ALL FARE RULE HUD TESTS PASSED SUCCESSFULLY! <<<');
})();

module.exports = {};

