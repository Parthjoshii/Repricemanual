const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  const fillAdtFare = async (oldFare, newFare) => {
    await page.click('#ptcTabADT');
    await page.waitForTimeout(80);
    await page.selectOption('#currency', 'AED');
    await page.fill('#oldFare', oldFare);
    await page.fill('#newFare', newFare);
    await page.click('#fareCalcButton');
    await page.waitForTimeout(150);
  };

  // --- Fresh load: no banner, banner elements exist but hidden ---
  const bannerHiddenInitially = await page.isHidden('#restoreBanner');
  assert.ok(bannerHiddenInitially, 'Restore banner should be hidden on a fresh/first-ever load');
  console.log('CHECK1 OK: no restore banner on first-ever load (nothing saved yet)');

  // --- Do some work, then reload: banner shows, fields stay EMPTY (no auto-hydration) ---
  await fillAdtFare('1000', '1200');
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);

  const bannerVisibleAfterReload = await page.isVisible('#restoreBanner');
  assert.ok(bannerVisibleAfterReload, 'Restore banner should be visible after reload when a session was saved');
  const oldFareAfterReload = await page.inputValue('#oldFare');
  const newFareAfterReload = await page.inputValue('#newFare');
  assert.strictEqual(oldFareAfterReload, '', 'Old Fare must stay EMPTY on reload — no auto-restore');
  assert.strictEqual(newFareAfterReload, '', 'New Fare must stay EMPTY on reload — no auto-restore');
  console.log('CHECK2 OK: reload shows the restore banner but leaves fields empty (no auto-hydration)');

  // --- Click Restore: fields populate exactly as before ---
  await page.click('#restoreSessionButton');
  await page.waitForTimeout(150);
  const bannerHiddenAfterRestore = await page.isHidden('#restoreBanner');
  assert.ok(bannerHiddenAfterRestore, 'Restore banner should hide after clicking Restore');
  const oldFareAfterRestore = await page.inputValue('#oldFare');
  const newFareAfterRestore = await page.inputValue('#newFare');
  assert.strictEqual(oldFareAfterRestore, '1000', 'Old Fare should be restored to 1000');
  assert.strictEqual(newFareAfterRestore, '1200', 'New Fare should be restored to 1200');
  console.log('CHECK3 OK: clicking Restore populates the exact prior data and hides the banner');

  // --- After restoring, normal saving resumes: further edits + reload + restore work ---
  await page.fill('#newFare', '1300');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);
  assert.ok(await page.isVisible('#restoreBanner'), 'Banner should reappear after further edits + reload');
  await page.click('#restoreSessionButton');
  await page.waitForTimeout(150);
  const newFareAfterSecondRestore = await page.inputValue('#newFare');
  assert.strictEqual(newFareAfterSecondRestore, '1300', 'Post-restore edits should also be saved and restorable');
  console.log('CHECK4 OK: saving/restoring keeps working normally after an initial restore');

  // --- Dismiss explicitly clears storage: next reload shows no banner ---
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);
  assert.ok(await page.isVisible('#restoreBanner'), 'Banner should show before testing Dismiss');
  await page.click('#dismissRestoreButton');
  await page.waitForTimeout(150);
  assert.ok(await page.isHidden('#restoreBanner'), 'Banner should hide immediately after Dismiss');
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);
  assert.ok(await page.isHidden('#restoreBanner'), 'Banner should NOT reappear after Dismiss cleared the saved session');
  const oldFareAfterDismiss = await page.inputValue('#oldFare');
  assert.strictEqual(oldFareAfterDismiss, '', 'Fields should stay empty (clean state) after a dismissed+cleared session');
  console.log('CHECK5 OK: Dismiss clears the saved session; it does not come back on the next reload');

  // --- Auto-dismiss when the user starts typing without clicking Restore ---
  await fillAdtFare('500', '600');
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);
  assert.ok(await page.isVisible('#restoreBanner'), 'Banner should show before testing auto-dismiss-on-typing');
  await page.fill('#oldFare', '999'); // user starts entering fresh data instead of restoring
  await page.waitForTimeout(150);
  assert.ok(await page.isHidden('#restoreBanner'), 'Banner should auto-dismiss once the user starts typing new data');
  // Confirm normal saving resumed after the auto-dismiss (not stuck suppressed forever)
  await page.fill('#newFare', '1111');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(150);
  assert.ok(await page.isVisible('#restoreBanner'), 'A new session should be saved (and offered) after the auto-dismissed one');
  await page.click('#restoreSessionButton');
  await page.waitForTimeout(150);
  const oldFareAfterAutoDismissFlow = await page.inputValue('#oldFare');
  assert.strictEqual(oldFareAfterAutoDismissFlow, '999', 'The fresh (post-auto-dismiss) data should be what gets saved/restored, not the old 500');
  console.log('CHECK6 OK: typing without restoring auto-dismisses the banner and normal saving resumes');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK7 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
