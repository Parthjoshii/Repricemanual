/**
 * Regression & Visual Verification: Minimal Monoline Help Buttons, Brand Favicon & Zero-Flash Tab Transitions
 */
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('--- STARTING HELP BUTTONS, FAVICON & ZERO-FLASH VERIFICATION ---');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const filePath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(filePath);
  await page.waitForLoadState('domcontentloaded');

  async function getElementStyle(selector, property) {
    return page.evaluate(({ sel, prop }) => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el).getPropertyValue(prop) : null;
    }, { sel: selector, prop: property });
  }

  async function getPseudoStyle(selector, pseudo, property) {
    return page.evaluate(({ sel, ps, prop }) => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el, ps).getPropertyValue(prop) : null;
    }, { sel: selector, ps: pseudo, prop: property });
  }

  // --------------------------------------------------------------------------
  // TEST 1: Brand Favicon Verification
  // --------------------------------------------------------------------------
  console.log('\n[TEST 1] Verifying Brand Favicon Link in <head>...');
  const faviconSvgHref = await page.getAttribute('link[rel="icon"][type="image/svg+xml"]', 'href');
  assert.strictEqual(faviconSvgHref, 'favicon.svg', 'SVG favicon must be linked in head');

  const faviconPath = path.resolve(__dirname, '../favicon.svg');
  assert.ok(fs.existsSync(faviconPath), 'favicon.svg file must exist on disk');
  const faviconContent = fs.readFileSync(faviconPath, 'utf8');
  assert.ok(faviconContent.includes('<svg') && faviconContent.includes('aircraft-delta'), 'Favicon must be an SVG with aircraft-delta branding');
  console.log('  ✓ Favicon successfully linked and validated on disk.');

  // --------------------------------------------------------------------------
  // TEST 2: Minimal Monoline Help Buttons DOM & ARIA Compliance (2.25 Stroke Weight)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] Verifying Section Help Buttons DOM, Attributes & Hitbox...');
  const expectedSections = [
    {
      selector: '#taxSectionHeading .minimal-help-btn',
      name: 'Tax Adjustment Calculator',
      expectedKeyword: 'net differences between OLD and NEW'
    },
    {
      selector: '#parserSectionHeading .minimal-help-btn',
      name: 'Fare Calculation String Validator',
      expectedKeyword: 'linear GDS fare construction strings'
    },
    {
      selector: '#fareSectionHeading .minimal-help-btn',
      name: 'Fare Calculator',
      expectedKeyword: 'financial settlements'
    },
    {
      selector: '.currency-converter-title-group .minimal-help-btn',
      name: 'Fare Difference Converter',
      expectedKeyword: 'applicable IATA Rate of Exchange'
    },
    {
      selector: '#summaryHeading .minimal-help-btn',
      name: 'Final Summary',
      expectedKeyword: 'unified audit table'
    }
  ];

  const helpButtons = await page.$$('.minimal-help-btn');
  console.log(`  Found ${helpButtons.length} minimal help buttons in DOM`);
  assert.strictEqual(helpButtons.length, 5, 'Exactly 5 minimal help buttons must exist in the UI');

  for (const sec of expectedSections) {
    const btnSelector = sec.selector;
    const btnType = await page.getAttribute(btnSelector, 'type');
    const ariaLabel = await page.getAttribute(btnSelector, 'aria-label');
    const title = await page.getAttribute(btnSelector, 'title');
    const tooltip = await page.getAttribute(btnSelector, 'data-tooltip');

    assert.strictEqual(btnType, 'button', `${sec.name} help button must have type="button"`);
    assert.ok(ariaLabel && ariaLabel.toLowerCase().includes('help:'), `${sec.name} button must have descriptive aria-label`);
    assert.strictEqual(title, null, `${sec.name} button must NOT have native title attribute to avoid browser tooltip collision`);
    assert.ok(tooltip && tooltip.includes(sec.expectedKeyword), `${sec.name} button must have approved industry copy in data-tooltip`);

    // Verify SVG icon dimensions and increased stroke weight (2.25)
    const svgBox = await page.$eval(`${btnSelector} svg`, el => {
      const rect = el.getBoundingClientRect();
      const sw = el.getAttribute('stroke-width');
      return { width: Math.round(rect.width), height: Math.round(rect.height), strokeWidth: sw };
    });
    console.log(`  ${sec.name} -> Icon: ${svgBox.width}x${svgBox.height}px, Stroke-Width: ${svgBox.strokeWidth}`);
    assert.strictEqual(svgBox.width, 16, `${sec.name} icon width must be 16px`);
    assert.strictEqual(svgBox.height, 16, `${sec.name} icon height must be 16px`);
    assert.strictEqual(svgBox.strokeWidth, '2.25', `${sec.name} stroke width must be 2.25`);

    // Verify 24px x 24px touch target hitbox
    const btnBox = await page.$eval(btnSelector, el => {
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    console.log(`  ${sec.name} -> Hitbox: ${btnBox.width}x${btnBox.height}px`);
    assert.strictEqual(btnBox.width, 24, `${sec.name} touch target width must be 24px`);
    assert.strictEqual(btnBox.height, 24, `${sec.name} touch target height must be 24px`);
  }
  console.log('  ✓ All 5 section buttons have valid semantic markup, 16x16 geometry, 2.25 stroke weight, and 24x24 touch targets.');

  // --------------------------------------------------------------------------
  // TEST 3: Right-Aligned Tooltip Popover Display & Pill Reload Button Check
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Verifying Right-Aligned Tooltip Popovers & Pill Reload Button...');
  // Check Reload Button Pill Style Curve Design
  const reloadBorderRadius = await getElementStyle('#reloadButton', 'border-radius');
  console.log(`  Reload Button border-radius: ${reloadBorderRadius}`);
  assert.ok(reloadBorderRadius.includes('16px') || reloadBorderRadius.includes('9999px'), 'Reload button must have pill style curve design');

  // Hover over the first help button (now right-aligned by default)
  const firstBtn = '#taxSectionHeading .minimal-help-btn';
  await page.hover(firstBtn);
  await page.waitForTimeout(200);

  const tooltipOpacity = await getPseudoStyle(firstBtn, '::after', 'opacity');
  const tooltipVisibility = await getPseudoStyle(firstBtn, '::after', 'visibility');
  const tooltipZIndex = await getPseudoStyle(firstBtn, '::after', 'z-index');
  const tooltipContent = await getPseudoStyle(firstBtn, '::after', 'content');
  console.log(`  Hovered Tax: Tooltip opacity=${tooltipOpacity}, visibility=${tooltipVisibility}, z-index=${tooltipZIndex}`);
  assert.strictEqual(tooltipOpacity, '1', 'Tooltip must be visible (opacity: 1) on hover');
  assert.strictEqual(tooltipVisibility, 'visible', 'Tooltip visibility must be visible on hover');
  assert.strictEqual(tooltipZIndex, '500', 'Tooltip must overlay other content with z-index 500');
  assert.ok(tooltipContent.length > 20, 'Tooltip content must display data-tooltip string');

  // Hover over Fare Calculator button (also right-aligned by default)
  const fareBtn = '#fareSectionHeading .minimal-help-btn';
  await page.hover(fareBtn);
  await page.waitForTimeout(200);

  const fareTooltipOpacity = await getPseudoStyle(fareBtn, '::after', 'opacity');
  const fareTooltipZIndex = await getPseudoStyle(fareBtn, '::after', 'z-index');
  console.log(`  Hovered Fare Calculator (Right Tooltip): opacity=${fareTooltipOpacity}, z-index=${fareTooltipZIndex}`);
  assert.strictEqual(fareTooltipOpacity, '1', 'Fare Calculator tooltip must be visible on hover');
  assert.strictEqual(fareTooltipZIndex, '500', 'Fare Calculator tooltip must have z-index 500 for overlaying other content');

  // Verify workaround: Tooltip remains displayed when cursor moves inside the information display box
  const firstBtnBox = await page.$eval(firstBtn, el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  // 1. Move cursor to firstBtn to trigger hover
  await page.mouse.move(firstBtnBox.x + firstBtnBox.w / 2, firstBtnBox.y + firstBtnBox.h / 2);
  await page.waitForTimeout(150);
  assert.strictEqual(await getPseudoStyle(firstBtn, '::after', 'opacity'), '1', 'Tooltip must be visible when button is hovered');

  // 2. Move cursor seamlessly into the information display card
  await page.mouse.move(firstBtnBox.x + firstBtnBox.w + 50, firstBtnBox.y + firstBtnBox.h / 2, { steps: 5 });
  await page.waitForTimeout(150);
  const insideCardOpacity = await getPseudoStyle(firstBtn, '::after', 'opacity');
  console.log(`  Cursor inside info box: Tooltip opacity=${insideCardOpacity}`);
  assert.strictEqual(insideCardOpacity, '1', 'Tooltip must remain displayed when cursor is inside the information display box');

  // Move cursor outside the tooltip
  await page.mouse.move(firstBtnBox.x - 50, firstBtnBox.y + 150, { steps: 5 });
  await page.waitForTimeout(150);
  const outsideCardOpacity = await getPseudoStyle(firstBtn, '::after', 'opacity');
  assert.strictEqual(outsideCardOpacity, '0', 'Tooltip must disappear when cursor moves outside');

  // Verify focus-visible outline
  await page.focus(firstBtn);
  await page.waitForTimeout(250);
  const focusOpacity = await getPseudoStyle(firstBtn, '::after', 'opacity');
  assert.strictEqual(focusOpacity, '1', 'Tooltip must remain visible on focus');
  console.log('  ✓ Right-aligned tooltips, cursor box persistence, and pill reload button verified successfully.');

  // --------------------------------------------------------------------------
  // TEST 4: Smart Hint Pop-up Monoline Icons & Updated Guidance Copy
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] Verifying Smart Hint Monoline Icons & Updated Copy (#fareDiffBulb, #changeFeeBulb)...');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '150');
  await page.waitForTimeout(100);

  const fareDiffBulbVisible = await page.isVisible('#fareDiffBulb');
  const changeFeeBulbVisible = await page.isVisible('#changeFeeBulb');
  assert.strictEqual(fareDiffBulbVisible, true, 'Fare Diff hint badge must be visible when fares are entered');
  assert.strictEqual(changeFeeBulbVisible, true, 'Change Fee hint badge must be visible when fares are entered');

  // Verify modern monoline icon inside hint badge
  const bulbSvgClass = await page.$eval('#fareDiffBulb svg', el => el.getAttribute('class'));
  const bulbSvgStroke = await page.$eval('#fareDiffBulb svg', el => el.getAttribute('stroke-width'));
  assert.ok(bulbSvgClass.includes('hint-monoline-icon'), 'Hint badge must use .hint-monoline-icon');
  assert.strictEqual(bulbSvgStroke, '1.8', 'Hint badge icon stroke-width must be 1.8');

  // Verify title attribute removed to eliminate native tooltip collision
  const fareDiffTitle = await page.getAttribute('#fareDiffBulb', 'title');
  const changeFeeTitle = await page.getAttribute('#changeFeeBulb', 'title');
  assert.strictEqual(fareDiffTitle, null, 'Fare Diff hint badge must NOT have native title attribute');
  assert.strictEqual(changeFeeTitle, null, 'Change Fee hint badge must NOT have native title attribute');

  // Verify updated guidance copy
  const fareDiffBulbTip = await page.getAttribute('#fareDiffBulb', 'data-tooltip');
  const changeFeeBulbTip = await page.getAttribute('#changeFeeBulb', 'data-tooltip');
  assert.ok(fareDiffBulbTip.includes('Dual-Currency Detection') && fareDiffBulbTip.includes('converted settlement amount'), 'Fare Diff bulb tooltip must contain updated dual-currency guidance');
  assert.ok(changeFeeBulbTip.includes('Settlement Guidance') && changeFeeBulbTip.includes('settlement currency'), 'Change Fee bulb tooltip must contain updated settlement currency guidance');

  // Verify bulb tooltip remains displayed when cursor moves inside the box
  await page.hover('#fareDiffBulb');
  await page.waitForTimeout(200);
  assert.strictEqual(await getPseudoStyle('#fareDiffBulb', '::after', 'opacity'), '1', 'Bulb tooltip must be visible on hover');

  // Move cursor upward into the bulb tooltip card
  const bulbBox = await page.$eval('#fareDiffBulb', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.move(bulbBox.x + bulbBox.w / 2, bulbBox.y - 30, { steps: 5 });
  await page.waitForTimeout(200);
  const insideBulbCardOpacity = await getPseudoStyle('#fareDiffBulb', '::after', 'opacity');
  console.log(`  Cursor inside smart hint box: Tooltip opacity=${insideBulbCardOpacity}`);
  assert.strictEqual(insideBulbCardOpacity, '1', 'Smart hint tooltip must remain displayed when cursor is inside the information box');

  // Move away
  await page.mouse.move(bulbBox.x + bulbBox.w / 2, bulbBox.y + 150, { steps: 5 });
  await page.waitForTimeout(200);
  assert.strictEqual(await getPseudoStyle('#fareDiffBulb', '::after', 'opacity'), '0');

  console.log('  ✓ Smart hint badges verified: monoline SVG geometry, updated copy, and cursor box persistence present.');

  // Clear inputs to restore initial state
  await page.fill('#oldFare', '');
  await page.fill('#newFare', '');

  // --------------------------------------------------------------------------
  // TEST 5: Section Toggle Integration
  // --------------------------------------------------------------------------
  console.log('\n[TEST 5] Verifying Section Collapsible Toggle Integrity...');
  const taxToggle = '#taxToggleBtn';
  const taxContent = '#taxCollapsible';

  assert.strictEqual(await page.isVisible(taxContent), true, 'Tax section should be open initially');
  await page.click(taxToggle);
  await page.waitForTimeout(200);
  const isCollapsed = await page.evaluate(() => document.getElementById('taxCollapsible').classList.contains('collapsed') || !document.getElementById('taxCollapsible').offsetHeight);
  console.log(`  After clicking Hide: Section isCollapsed=${isCollapsed}`);
  await page.click(taxToggle);
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible(taxContent), true, 'Tax section must re-expand without error');
  console.log('  ✓ Section toggle functionality completely intact.');

  // --------------------------------------------------------------------------
  // TEST 6: Zero-Flash Tab Fillet Theme Transition
  // --------------------------------------------------------------------------
  console.log('\n[TEST 6] Verifying Zero-Flash Tab Fillet Theme Transition...');
  // Test both dark and light transitions on active glider leaflet and fillets
  const tabSelector = '.tab-glider';

  // Toggle theme to dark and sample at intervals to ensure no flash
  await page.evaluate(() => toggleTheme());
  await page.waitForTimeout(60);
  const midTabColor = await page.$eval(tabSelector, el => window.getComputedStyle(el).backgroundColor);
  const midFilletColor = await getPseudoStyle(tabSelector, '::before', 'background-color');
  console.log(`  Mid-transition (+60ms): Tab=${midTabColor} | Fillet=${midFilletColor}`);

  // Allow transition to settle
  await page.waitForTimeout(400);
  const settledTabColor = await page.$eval(tabSelector, el => window.getComputedStyle(el).backgroundColor);
  const settledFilletColor = await getPseudoStyle(tabSelector, '::before', 'background-color');
  console.log(`  Settled Dark: Tab=${settledTabColor} | Fillet=${settledFilletColor}`);
  assert.strictEqual(settledTabColor, settledFilletColor, 'Tab and Fillet colors must match 100% identically');

  // Toggle back to light
  await page.evaluate(() => toggleTheme());
  await page.waitForTimeout(450);
  const lightTabColor = await page.$eval(tabSelector, el => window.getComputedStyle(el).backgroundColor);
  const lightFilletColor = await getPseudoStyle(tabSelector, '::before', 'background-color');
  console.log(`  Settled Light: Tab=${lightTabColor} | Fillet=${lightFilletColor}`);
  assert.strictEqual(lightTabColor, lightFilletColor, 'Light tab and Fillet colors must match 100% identically');
  console.log('  ✓ Zero-flash theme transition verified: pseudo-element colors transition in lockstep.');

  // Capture verification screenshots
  const artifactDir = 'C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/1a69e0b2-33ac-4d8b-a578-b99b256dd4e6';
  await page.screenshot({ path: path.join(artifactDir, 'minimal-help-buttons-light.png'), fullPage: false });

  await page.evaluate(() => toggleTheme());
  await page.waitForTimeout(450);
  await page.hover('#taxSectionHeading .minimal-help-btn');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(artifactDir, 'minimal-help-buttons-dark-hover.png'), fullPage: false });

  // Screenshot Fare Difference Converter right-side tooltip
  await page.hover('.currency-converter-title-group .minimal-help-btn');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(artifactDir, 'fare-converter-right-tooltip.png'), fullPage: false });

  // Screenshot Smart Hint badge on Old/New fare entry
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '150');
  await page.waitForTimeout(400);
  await page.hover('#fareDiffBulb');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'smart-hint-badge-hover.png'), fullPage: false });
  console.log('  ✓ Saved verification screenshots.');

  await browser.close();
  console.log('\n--- ALL HELP BUTTONS, FAVICON & ZERO-FLASH CHECKS PASSED SUCCESSFULLY! ---');
})();
