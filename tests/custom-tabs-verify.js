const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  // Native prompt()/confirm() should no longer be used anywhere in this flow (that was the bug).
  page.on('dialog', async (dialog) => {
    errors.push(`UNEXPECTED native dialog: ${dialog.type()} "${dialog.message()}"`);
    await dialog.dismiss();
  });

  const shot = (name) => page.screenshot({ path: name, fullPage: true });

  // Answers the in-app #ptcPromptModal: fills the input (if visible) and clicks OK/Cancel.
  async function answerPtcPrompt(text, { cancel = false } = {}) {
    await page.waitForSelector('#ptcPromptModal.show');
    const inputVisible = await page.isVisible('#ptcPromptInput');
    if (cancel) {
      await page.click('#ptcPromptCancelBtn');
      return;
    }
    if (inputVisible && text !== undefined) {
      await page.fill('#ptcPromptInput', text);
    }
    await page.click('#ptcPromptOkBtn');
  }

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --- Add a custom tab named "GRP" ---
  await page.click('#ptcAddTabButton');
  await answerPtcPrompt('GRP');
  await page.waitForTimeout(150);

  const tabTexts = await page.$$eval('.ptc-tab', els => els.map(el => el.querySelector('.ptc-tab-label')?.textContent || el.childNodes[0].textContent.trim()));
  console.log('Tabs after adding GRP:', tabTexts);
  assert.ok(tabTexts.includes('GRP'), 'Expected GRP tab to exist');

  const activeSelected = await page.getAttribute('.ptc-tab[data-ptc="GRP"]', 'aria-selected');
  assert.strictEqual(activeSelected, 'true', 'New custom tab should become active immediately');
  console.log('CHECK1 OK: custom tab GRP created and made active (via in-app modal, not native prompt)');

  // --- Cancelling the add-tab modal should not create a tab ---
  const tabCountBeforeCancel = await page.$$eval('.ptc-tab', els => els.length);
  await page.click('#ptcAddTabButton');
  await answerPtcPrompt(undefined, { cancel: true });
  await page.waitForTimeout(100);
  const tabCountAfterCancel = await page.$$eval('.ptc-tab', els => els.length);
  assert.strictEqual(tabCountAfterCancel, tabCountBeforeCancel, 'Cancelling add-tab should not create a new tab');
  console.log('CHECK1b OK: cancelling the modal adds nothing');

  // --- Fill GRP data and ADT data, Summarise, check header shows GRP ---
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '300');
  await page.fill('#newFare', '330');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  await page.click('.ptc-tab[data-ptc="ADT"]');
  await page.waitForTimeout(100);
  await page.selectOption('#currency', 'AED');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '1000');
  await page.fill('#newFare', '1200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const headers = await page.$$eval('#summary thead th', ths => ths.map(th => th.textContent));
  console.log('Summary headers:', headers);
  assert.deepStrictEqual(headers, ['', 'Adult', 'GRP'], 'Expected headers [\'\', Adult, GRP]');

  const fcsLabels = await page.$$eval('#summary tbody tr', trs =>
    trs.filter(tr => tr.cells[0].textContent.includes('Fare Calculation String')).map(tr => tr.cells[0].textContent)
  );
  console.log('Fare Calc String row labels:', fcsLabels);
  assert.deepStrictEqual(fcsLabels, ['Fare Calculation String Adult', 'Fare Calculation String GRP']);
  console.log('CHECK2 OK: summary shows GRP header and Fare Calc String GRP row');
  await shot('custom-tab-summary.png');

  // --- Rename GRP -> "GROUP A" via the pencil icon ---
  await page.click('.ptc-tab[data-ptc="GRP"] .ptc-tab-action:has-text("✎")');
  const prefill = await page.inputValue('#ptcPromptInput');
  assert.strictEqual(prefill, 'GRP', 'Rename prompt should be pre-filled with the current label');
  await answerPtcPrompt('GROUP A');
  await page.waitForTimeout(100);
  const renamedLabel = await page.$eval('.ptc-tab[data-ptc="GRP"] .ptc-tab-label', el => el.textContent);
  assert.strictEqual(renamedLabel, 'GROUP A', 'Tab label should update to GROUP A');

  await page.click('#ptcTabADT');
  await page.waitForTimeout(50);
  await page.click('.ptc-tab[data-ptc="GRP"] .ptc-tab-label');
  await page.waitForTimeout(100);
  const oldFareAfterRename = await page.$eval('#oldFare', el => el.value);
  assert.strictEqual(oldFareAfterRename, '300', 'Data should be unchanged after rename, just the label changed');
  console.log('CHECK3 OK: rename updates label only, data preserved, code unchanged');

  // --- Add a second custom tab -> + should hide (cap of 2 reached) ---
  await page.click('#ptcAddTabButton');
  await answerPtcPrompt('VIP');
  await page.waitForTimeout(150);
  const addBtnHiddenAt2 = await page.getAttribute('#ptcAddTabButton', 'hidden');
  assert.ok(addBtnHiddenAt2 !== null, 'Add button should be hidden once cap of 2 custom tabs is reached');
  console.log('CHECK4 OK: + button hides after reaching cap of 2 custom tabs');

  // --- Remove GROUP A (formerly GRP) via x ---
  await page.click('.ptc-tab[data-ptc="GRP"] .ptc-tab-action:has-text("×")');
  await answerPtcPrompt(undefined); // confirm-only modal, just click OK
  await page.waitForTimeout(150);
  const grpGone = await page.$('.ptc-tab[data-ptc="GRP"]');
  assert.strictEqual(grpGone, null, 'GRP tab should be removed from DOM');
  const addBtnHiddenAfterRemove = await page.getAttribute('#ptcAddTabButton', 'hidden');
  assert.strictEqual(addBtnHiddenAfterRemove, null, '+ button should reappear after dropping below the cap');
  console.log('CHECK5 OK: removing a custom tab deletes it and + reappears');

  // --- Remove the currently-active custom tab (VIP) -> should fall back to ADT ---
  await page.click('.ptc-tab[data-ptc="VIP"] .ptc-tab-label');
  await page.waitForTimeout(100);
  await page.click('.ptc-tab[data-ptc="VIP"] .ptc-tab-action:has-text("×")');
  await answerPtcPrompt(undefined);
  await page.waitForTimeout(150);
  const adtSelectedAfterRemoveActive = await page.getAttribute('#ptcTabADT', 'aria-selected');
  assert.strictEqual(adtSelectedAfterRemoveActive, 'true', 'Should fall back to ADT after removing the active custom tab');
  console.log('CHECK6 OK: removing the active custom tab falls back to ADT');

  // --- Built-in tabs have no rename/remove icons ---
  const adtActionCount = await page.$$eval('#ptcTabADT .ptc-tab-action', els => els.length);
  assert.strictEqual(adtActionCount, 0, 'Built-in ADT tab should have no rename/remove icons');
  console.log('CHECK7 OK: built-in tabs have no rename/remove affordances');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors and zero native dialogs');
  console.log('CHECK8 OK: zero console errors, zero native dialog() calls');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
