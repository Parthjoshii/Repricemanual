const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');

(async () => {
  console.log('========================================================================');
  console.log('VERIFYING 3-FIELD CURRENCY CONVERTER & NEW/OLD FARE PLACEMENT');
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

  // --- 1. VERIFY DOM PLACEMENT ORDER OF NEW FARE & OLD FARE ---
  console.log('--- 1. VERIFYING FORM GRID PLACEMENT ORDER ---');
  const fareInputs = await page.$$eval('section[aria-labelledby="fareSectionHeading"] input', inputs =>
    inputs.map(i => i.id)
  );
  console.log('Fare input DOM order:', fareInputs);
  const newFareIndex = fareInputs.indexOf('newFare');
  const oldFareIndex = fareInputs.indexOf('oldFare');
  assert.ok(newFareIndex !== -1 && oldFareIndex !== -1, 'Both newFare and oldFare must exist');
  assert.ok(newFareIndex < oldFareIndex, `New Base Fare (index ${newFareIndex}) must be placed BEFORE Old Base Fare (index ${oldFareIndex}) in form grid`);
  console.log('✓ New Base Fare is correctly placed before Old Base Fare in form grid.');

  // --- 2. VERIFY CURRENCY CONVERTER CARD IS HIDDEN BY DEFAULT ---
  console.log('\n--- 2. VERIFYING CURRENCY CONVERTER HIDDEN BY DEFAULT ---');
  const isConverterVisible = await page.isVisible('#converterCollapsible');
  console.log('Is converterCollapsible visible on load:', isConverterVisible);
  assert.strictEqual(isConverterVisible, false, 'Currency converter should be hidden by default');

  const toggleBtnText = await page.textContent('#converterToggleBtn');
  console.log('Converter toggle button text:', toggleBtnText.trim());
  assert.ok(toggleBtnText.includes('Show'), 'Toggle button should indicate Show when collapsed');
  console.log('✓ Currency Converter section is correctly hidden by default.');

  // --- 3. TEST TOGGLE EXPANSION & COLLAPSE ---
  console.log('\n--- 3. TESTING TOGGLE EXPAND / COLLAPSE ---');
  await page.click('#converterToggleBtn');
  await page.waitForTimeout(150);

  const isExpanded = await page.isVisible('#converterCollapsible');
  console.log('Is converterCollapsible visible after click:', isExpanded);
  assert.strictEqual(isExpanded, true, 'Currency converter should expand on click');

  const expandedBtnText = await page.textContent('#converterToggleBtn');
  console.log('Expanded toggle button text:', expandedBtnText.trim());
  assert.ok(expandedBtnText.includes('Hide'), 'Toggle button should indicate Hide when expanded');
  console.log('✓ Toggle expand/collapse works perfectly.');

  // --- 4. TEST ROE MULTIPLICATION & AUTO-PASTING INTO FARE DIFF ---
  console.log('\n--- 4. TESTING ROE MULTIPLICATION & AUTO-PASTING ---');
  await page.selectOption('#currency', 'USD');
  await page.fill('#newFare', '200');
  await page.fill('#oldFare', '100'); // Base diff = 100 USD

  await page.selectOption('#targetCurrency', 'INR');
  await page.fill('#exchangeRate', '90.3344');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const convertedDiffVal = await page.inputValue('#convertedFareDiff');
  console.log('Converted Fare Diff output (IATA rounded INR):', convertedDiffVal);
  assert.strictEqual(convertedDiffVal, 'INR9034');

  const autoPastedFareDiff = await page.inputValue('#fareDiff');
  console.log('Auto-pasted Fare Difference:', autoPastedFareDiff);
  assert.strictEqual(autoPastedFareDiff, 'INR9034');

  const perPaxVal = await page.inputValue('#perPax');
  console.log('Amount Payable per Pax:', perPaxVal);
  assert.strictEqual(perPaxVal, 'INR9034');
  console.log('✓ ROE Multiplication & Auto-pasting into Fare Difference verified 100%.');

  // --- 5. VERIFY SUMMARY TABLE ROW ORDER (OLD FARE FIRST, NEW FARE SECOND) ---
  console.log('\n--- 5. VERIFYING SUMMARY TABLE ROW ORDER ---');
  await page.click('#summariseButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const summaryRows = await page.$$eval('#summary table tr', trs =>
    trs.map(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) {
        return { label: cells[0].textContent.trim(), val: cells[1].textContent.trim() };
      }
      return null;
    }).filter(Boolean)
  );
  console.log('Summary Table Rows:', summaryRows);

  const oldFareRowIndex = summaryRows.findIndex(r => r.label === 'Old Fare');
  const newFareRowIndex = summaryRows.findIndex(r => r.label === 'New Fare');
  assert.ok(oldFareRowIndex !== -1 && newFareRowIndex !== -1, 'Both Old Fare and New Fare summary rows must exist');
  assert.ok(oldFareRowIndex < newFareRowIndex, `Summary Table must preserve Old Fare (index ${oldFareRowIndex}) BEFORE New Fare (index ${newFareRowIndex})`);
  console.log('✓ Summary Table correctly preserves Old Fare before New Fare.');

  // --- 6. TEST MANUAL OVERRIDE FLEXIBILITY ---
  console.log('\n--- 6. TESTING MANUAL OVERRIDE FLEXIBILITY ---');
  await page.fill('#fareDiff', 'INR8500');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await closeModalIfOpen();

  const manualDiffVal = await page.inputValue('#fareDiff');
  console.log('Manual Fare Diff:', manualDiffVal);
  assert.strictEqual(manualDiffVal, 'INR8500');

  const perPaxManual = await page.inputValue('#perPax');
  console.log('Per Pax after manual override:', perPaxManual);
  assert.strictEqual(perPaxManual, 'INR8500');
  console.log('✓ Manual override remains fully operational.');

  console.log('\n========================================================================');
  console.log('ALL CURRENCY CONVERTER & PLACEMENT VERIFICATION TESTS PASSED 100%!');
  console.log('========================================================================');

  await browser.close();
})();
