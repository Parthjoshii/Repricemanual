const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('========================================================================');
  console.log('TEST SUITE: Child Tab "Copy Taxes from Adult" Verification');
  console.log('========================================================================\n');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --------------------------------------------------------------------------
  // TEST 1: Checkbox Visibility Exclusively on Child Tab
  // --------------------------------------------------------------------------
  console.log('1. Checking checkbox visibility across passenger tabs...');

  // ADT tab (default on load)
  const adtDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  assert.strictEqual(adtDisplay, 'none', 'Checkbox must be hidden on Adult tab');
  console.log('   ✓ Hidden on Adult tab');

  // Switch to Child tab
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  const chdDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  assert.notStrictEqual(chdDisplay, 'none', 'Checkbox must be visible on Child tab');
  console.log('   ✓ Visible on Child tab');

  // Switch to Infant tab
  await page.click('#ptcTabINF');
  await page.waitForTimeout(100);
  const infDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  assert.strictEqual(infDisplay, 'none', 'Checkbox must be hidden on Infant tab');
  console.log('   ✓ Hidden on Infant tab');

  // Switch to Infant to Child tab
  await page.click('#ptcTabINF_CHD');
  await page.waitForTimeout(100);
  const infChdDisplay = await page.$eval('#copyTaxFromAdultRow', el => window.getComputedStyle(el).display);
  assert.strictEqual(infChdDisplay, 'none', 'Checkbox must be hidden on Infant to Child hybrid tab');
  console.log('   ✓ Hidden on Hybrid tab');

  // Switch back to Adult
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);

  // --------------------------------------------------------------------------
  // TEST 2: Label Text & Geometry / CSS Alignment
  // --------------------------------------------------------------------------
  console.log('\n2. Checking label text and single-line layout...');
  const labelText = await page.$eval('label[for="copyTaxFromAdult"]', el => el.textContent.trim());
  assert.strictEqual(labelText, 'Copy Taxes from Adult', 'Label text must be exactly "Copy Taxes from Adult"');

  const labelStyle = await page.$eval('label[for="copyTaxFromAdult"]', el => {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      nowrap: s.whiteSpace === 'nowrap',
      height: r.height,
    };
  });
  assert.ok(labelStyle.nowrap, 'Label must have white-space: nowrap');
  assert.ok(labelStyle.height <= 18, `Label height (${labelStyle.height}px) must be <= 18px`);
  console.log('   ✓ Label text is "Copy Taxes from Adult" and single-line');

  // --------------------------------------------------------------------------
  // TEST 3: Copy Taxes Functionality & Automatic Calculation
  // --------------------------------------------------------------------------
  console.log('\n3. Testing tax copying from Adult to Child with automatic calculation...');

  // Enter taxes on Adult tab
  await page.fill('#oldTax', 'INR500YQ INR1000OD');
  await page.fill('#newTax', 'INR800YQ INR1000OD');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(100);

  // Switch to Child tab
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);

  // Initial Child taxes should be empty
  const chdOldTaxInitial = await page.$eval('#oldTax', el => el.value);
  assert.strictEqual(chdOldTaxInitial, '', 'Child Old Tax initially empty');

  // Click Copy Taxes from Adult
  await page.click('#copyTaxFromAdult');
  await page.waitForTimeout(150);

  const copiedState = await page.evaluate(() => ({
    oldTax: document.getElementById('oldTax').value,
    newTax: document.getElementById('newTax').value,
    netTax: state.lastTaxResult?.netTax,
    isChecked: document.getElementById('copyTaxFromAdult').checked,
    taxResultText: document.getElementById('taxResult').innerText,
  }));

  const adultTaxes = await page.evaluate(() => state.ptcData['ADT'].formSnapshot.fields);
  assert.strictEqual(copiedState.oldTax, adultTaxes.oldTax, 'Child Old Tax matches Adult');
  assert.strictEqual(copiedState.newTax, adultTaxes.newTax, 'Child New Tax matches Adult');
  assert.strictEqual(copiedState.netTax, 300, 'Taxes automatically calculated: netTax === 300');
  assert.ok(copiedState.taxResultText.includes('Net Total: INR300'), 'Tax result rendered correctly');
  assert.strictEqual(copiedState.isChecked, true, 'Checkbox is checked');
  console.log('   ✓ Adult taxes copied to Child and automatically calculated (Net Total: INR300.00)');

  // --------------------------------------------------------------------------
  // TEST 4: Manual Typing Auto-Unchecks the Checkbox
  // --------------------------------------------------------------------------
  console.log('\n4. Testing manual typing in Child taxes auto-unchecks the checkbox...');

  await page.fill('#newTax', 'INR900YQ');
  await page.waitForTimeout(100);

  const afterManualEdit = await page.$eval('#copyTaxFromAdult', el => el.checked);
  assert.strictEqual(afterManualEdit, false, 'Checkbox must uncheck after manual edit of tax input');
  console.log('   ✓ Checkbox auto-unchecks on manual edit');

  // --------------------------------------------------------------------------
  // TEST 5: Clear Taxes Resets the Checkbox
  // --------------------------------------------------------------------------
  console.log('\n5. Testing Clear Taxes resets the checkbox...');

  // Re-check copy taxes
  await page.click('label[for="copyTaxFromAdult"]');
  await page.waitForTimeout(150);

  const rechecked = await page.$eval('#copyTaxFromAdult', el => el.checked);
  assert.strictEqual(rechecked, true, 'Checkbox must be checked after checking');

  // Click Clear Taxes
  await page.click('#taxClearButton');
  await page.waitForTimeout(100);

  const afterClear = await page.evaluate(() => ({
    oldTax: document.getElementById('oldTax').value,
    newTax: document.getElementById('newTax').value,
    isChecked: document.getElementById('copyTaxFromAdult').checked,
  }));

  assert.strictEqual(afterClear.oldTax, '', 'Child Old Tax cleared');
  assert.strictEqual(afterClear.newTax, '', 'Child New Tax cleared');
  assert.strictEqual(afterClear.isChecked, false, 'Checkbox unchecked on Clear Taxes');
  console.log('   ✓ Checkbox safely reset by Clear Taxes');

  // --------------------------------------------------------------------------
  // TEST 6: Error Notification when Adult Taxes Empty
  // --------------------------------------------------------------------------
  console.log('\n6. Testing error toast when Adult taxes are empty...');

  // Switch to Adult and clear taxes
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  await page.click('#taxClearButton');
  await page.waitForTimeout(100);

  // Switch to Child and click copy
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  await page.click('#copyTaxFromAdult');
  await page.waitForTimeout(150);

  const errorState = await page.evaluate(() => ({
    isChecked: document.getElementById('copyTaxFromAdult').checked,
    errorModalText: document.getElementById('modalMessage')?.textContent || '',
    errorModalVisible: document.getElementById('errorModal')?.classList.contains('show'),
  }));

  assert.strictEqual(errorState.isChecked, false, 'Checkbox must remain/revert to unchecked if Adult has no taxes');
  assert.ok(errorState.errorModalVisible, 'Error modal shown');
  assert.ok(errorState.errorModalText.includes('Please enter taxes in the Adult tab first'), 'Error message matches specification');
  console.log('   ✓ Friendly error displayed and checkbox remains unchecked when Adult taxes are empty');

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  // --------------------------------------------------------------------------
  // TEST 7: Auto-Sync on Tab Switch
  // --------------------------------------------------------------------------
  console.log('\n7. Testing auto-sync when returning to Child tab with checkbox checked...');

  // Populate Adult taxes again
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  await page.fill('#oldTax', 'INR400YQ');
  await page.fill('#newTax', 'INR700YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(100);

  // Switch to Child and check copy
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(100);
  await page.click('#copyTaxFromAdult');
  await page.waitForTimeout(100);

  // Switch to Adult and change taxes
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);
  await page.fill('#oldTax', 'INR600YQ');
  await page.fill('#newTax', 'INR950YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(100);

  // Switch back to Child: should auto-sync updated Adult taxes!
  await page.click('#ptcTabCHD');
  await page.waitForTimeout(150);

  const syncedState = await page.evaluate(() => ({
    oldTax: document.getElementById('oldTax').value,
    newTax: document.getElementById('newTax').value,
    netTax: state.lastTaxResult?.netTax,
    isChecked: document.getElementById('copyTaxFromAdult').checked,
  }));

  assert.strictEqual(syncedState.oldTax, 'INR600YQ', 'Child Old Tax auto-synced to updated Adult tax');
  assert.strictEqual(syncedState.newTax, 'INR950YQ', 'Child New Tax auto-synced to updated Adult tax');
  assert.strictEqual(syncedState.netTax, 350, 'Child net tax updated to 350');
  assert.strictEqual(syncedState.isChecked, true, 'Checkbox remains checked');
  console.log('   ✓ Taxes auto-synchronized upon switching back to Child tab');

  console.log('\n========================================================================');
  console.log('✨ ALL 7 CHILD "COPY TAXES FROM ADULT" TESTS PASSED (100%)');
  console.log('========================================================================');

  await browser.close();
  process.exit(0);
})();
