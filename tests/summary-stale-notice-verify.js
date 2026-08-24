const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');

(async () => {
  console.log('========================================================================');
  console.log('VERIFYING DYNAMIC STALE NOTICE BANNER NEXT TO SUMMARISE BUTTON');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = `file:///${path.resolve(__dirname, '../index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function closeModalIfOpen() {
    if (await page.isVisible('#errorModal.show')) {
      await page.evaluate(() => closeErrorModal());
      await page.waitForTimeout(100);
    }
  }

  // --- 1. INITIAL LOAD STATE ---
  console.log('--- 1. VERIFYING INITIAL LOAD STATE ---');
  let isNoticeVisible = await page.isVisible('#summaryStaleNotice');
  console.log('Is summaryStaleNotice visible on load:', isNoticeVisible);
  assert.strictEqual(isNoticeVisible, false, 'Summary stale notice should be hidden initially');
  console.log('✓ Stale notice is hidden on load.');

  // --- 2. GENERATE INITIAL SUMMARY ---
  console.log('\n--- 2. GENERATING INITIAL SUMMARY ---');
  await page.selectOption('#currency', 'USD');
  await page.fill('#newFare', '300');
  await page.fill('#oldFare', '100'); // Base diff = 200 USD
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const isSummaryVisible = await page.isVisible('#summaryContent');
  console.log('Is summaryContent visible after Summarise click:', isSummaryVisible);
  assert.strictEqual(isSummaryVisible, true, 'Summary content should be visible');

  isNoticeVisible = await page.isVisible('#summaryStaleNotice');
  console.log('Is summaryStaleNotice visible after initial Summarise:', isNoticeVisible);
  assert.strictEqual(isNoticeVisible, false, 'Stale notice should remain hidden immediately after Summarise click');
  console.log('✓ Initial summary generated cleanly with notice hidden.');

  // --- 3. EDIT INPUT AFTER INITIAL SUMMARY (TRIGGER NOTICE) ---
  console.log('\n--- 3. EDITING INPUT AFTER INITIAL SUMMARY ---');
  await page.fill('#changeFee', '2000');
  await page.waitForTimeout(150);

  isNoticeVisible = await page.isVisible('#summaryStaleNotice');
  console.log('Is summaryStaleNotice visible after editing Change Fee:', isNoticeVisible);
  assert.strictEqual(isNoticeVisible, true, 'Stale notice MUST appear when an input is edited after Summarise click');

  const noticeText = await page.textContent('#summaryStaleNotice');
  console.log('Stale Notice Text:', noticeText.trim());
  assert.ok(noticeText.includes('Inputs changed') && noticeText.includes('Summarise'), 'Notice text should inform user of changes');
  console.log('✓ Stale notice appeared automatically next to Summarise button.');

  // --- 4. RE-CLICK SUMMARISE (UPDATE TABLE & HIDE NOTICE) ---
  console.log('\n--- 4. RE-CLICKING SUMMARISE TO UPDATE TABLE ---');
  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  isNoticeVisible = await page.isVisible('#summaryStaleNotice');
  console.log('Is summaryStaleNotice visible after re-clicking Summarise:', isNoticeVisible);
  assert.strictEqual(isNoticeVisible, false, 'Stale notice MUST hide after re-clicking Summarise');

  const gdsVal = await page.inputValue('#gdsString');
  console.log('Updated GDS String:', gdsVal);
  assert.ok(gdsVal.includes('CHG FEE USD2000.00'), 'GDS string should pick up updated change fee');
  console.log('✓ Summary updated and stale notice hidden.');

  // --- 5. REPEAT BEHAVIOR (EDIT AGAIN) ---
  console.log('\n--- 5. TESTING REPEATABILITY ON SECOND EDIT ---');
  await page.fill('#newFare', '400');
  await page.waitForTimeout(150);

  isNoticeVisible = await page.isVisible('#summaryStaleNotice');
  console.log('Is summaryStaleNotice visible after second edit:', isNoticeVisible);
  assert.strictEqual(isNoticeVisible, true, 'Stale notice MUST re-appear on second edit');
  console.log('✓ Repeatability verified successfully.');

  console.log('\n========================================================================');
  console.log('ALL DYNAMIC STALE NOTICE VERIFICATION TESTS PASSED 100%!');
  console.log('========================================================================');

  await browser.close();
})();
