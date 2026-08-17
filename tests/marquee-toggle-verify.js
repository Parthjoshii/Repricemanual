const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  console.log('Testing Currency Converter Default Hidden State & Toggle Visibility...');

  // 1. Verify default initial state on page load: collapsed/hidden
  const toggleBtnText = (await page.textContent('#converterToggleBtn')).trim();
  const isConverterContentCollapsedInitially = await page.$eval('#converterCollapsible', el => el.classList.contains('collapsed'));
  const isMarqueeInitiallyVisible = await page.isVisible('#converterMarquee');

  console.log('Toggle button text on initial load:', toggleBtnText);
  console.log('Is converter content collapsed initially:', isConverterContentCollapsedInitially);
  console.log('Is marquee visible initially:', isMarqueeInitiallyVisible);

  assert.strictEqual(toggleBtnText, 'Show', 'Toggle button should say Show initially');
  assert.strictEqual(isConverterContentCollapsedInitially, true, 'Converter content must be collapsed by default');
  assert.strictEqual(isMarqueeInitiallyVisible, false, 'Marquee must be hidden by default when converter is collapsed');

  // 2. Click Show button to expand converter
  await page.click('#converterToggleBtn');
  await page.waitForTimeout(400);

  const toggleBtnTextAfterShow = (await page.textContent('#converterToggleBtn')).trim();
  const isConverterContentCollapsedAfterShow = await page.$eval('#converterCollapsible', el => el.classList.contains('collapsed'));
  const isMarqueeVisibleAfterShow = await page.isVisible('#converterMarquee');

  console.log('Toggle button text after Show clicked:', toggleBtnTextAfterShow);
  console.log('Is converter content collapsed after Show clicked:', isConverterContentCollapsedAfterShow);
  console.log('Is marquee visible after Show clicked:', isMarqueeVisibleAfterShow);

  assert.strictEqual(toggleBtnTextAfterShow, 'Hide', 'Toggle button should change to Hide');
  assert.strictEqual(isConverterContentCollapsedAfterShow, false, 'Converter content must not be collapsed when expanded');
  assert.strictEqual(isMarqueeVisibleAfterShow, true, 'Marquee must be visible when expanded');

  // 3. Verify text content of marquee
  const marqueeText = await page.textContent('#converterMarquee');
  console.log('Marquee text:', marqueeText.trim());
  assert.ok(
    marqueeText.includes('Cross-check ROE with ResConnect & manually enter if current rate is lower.'),
    'Marquee must contain updated notice text'
  );

  // 4. Click Hide button to collapse converter again
  await page.click('#converterToggleBtn');
  await page.waitForTimeout(400);

  const toggleBtnTextAfterHide = (await page.textContent('#converterToggleBtn')).trim();
  const isConverterContentCollapsedAfterHide = await page.$eval('#converterCollapsible', el => el.classList.contains('collapsed'));
  const isMarqueeVisibleAfterHide = await page.isVisible('#converterMarquee');

  console.log('Toggle button text after Hide clicked:', toggleBtnTextAfterHide);
  console.log('Is converter content collapsed after Hide clicked:', isConverterContentCollapsedAfterHide);
  console.log('Is marquee visible after Hide clicked:', isMarqueeVisibleAfterHide);

  assert.strictEqual(toggleBtnTextAfterHide, 'Show', 'Toggle button should return to Show');
  assert.strictEqual(isConverterContentCollapsedAfterHide, true, 'Converter content must be collapsed again');
  assert.strictEqual(isMarqueeVisibleAfterHide, false, 'Marquee must hide again');

  console.log('ALL DEFAULT HIDDEN & TOGGLE TESTS PASSED SUCCESSFULLY!');
  await browser.close();
})();
