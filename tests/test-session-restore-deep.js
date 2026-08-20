const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('Testing Automatic Session Restore on Page Reload...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => {
      const m = document.getElementById('errorModal');
      if (m) m.classList.remove('show');
    });
  }

  console.log('--- Step 1: Populate complete session with dual currency, taxes, and FCS ---');
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '199');
  await page.fill('#newFare', '288');
  await page.fill('#fareDiff', 'INR1999');
  await page.fill('#changeFee', 'INR3000');
  await page.check('#applyK3OnFareDiff');
  await page.check('#applyK3OnChangeFee');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  // Taxes
  await page.fill('#oldTax', 'INR500YQ');
  await page.fill('#newTax', 'INR700YQ');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  // Fare Calc String
  if (await page.$eval('#parserCollapsible', el => el.classList.contains('collapsed'))) {
    await page.click('#parserToggleBtn');
    await page.waitForTimeout(200);
  }
  await page.fill('#fareCalcString', 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM 404.56XWEEFIN1/NDC2 Q5.00 NUC511.77 ROE90.3344456');
  await page.click('#parseButton');
  await page.waitForTimeout(200);
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => {
      const m = document.getElementById('errorModal');
      if (m) m.classList.remove('show');
    });
  }

  // Summarise
  await page.click('#summariseButton');
  await page.waitForTimeout(300);

  console.log('--- Step 2: Reload Page (F5) ---');
  const storedJson = await page.evaluate(() => localStorage.getItem('fareTaxCalc.state.v1'));
  console.log('Stored payload before reload:', storedJson ? JSON.parse(storedJson) : null);
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(300);

  // Check restored values directly
  const oldFare = await page.inputValue('#oldFare');
  const newFare = await page.inputValue('#newFare');
  const fareDiff = await page.inputValue('#fareDiff');
  const changeFee = await page.inputValue('#changeFee');
  const cabin = await page.inputValue('#cabin');
  const k3Tax = await page.inputValue('#k3Tax');
  const perPax = await page.inputValue('#perPax');
  const oldTax = await page.inputValue('#oldTax');
  const newTax = await page.inputValue('#newTax');
  const fcs = await page.inputValue('#fareCalcString');
  const baseBadgeVisible = await page.isVisible('#baseFareDiffBadge');
  const baseBadgeText = baseBadgeVisible ? await page.textContent('#baseFareDiffBadge') : '';
  const bulbVisible = await page.isVisible('#fareDiffBulb');
  const isSummaryVisible = await page.isVisible('#summaryContent');

  console.log('Restored Old Fare:', oldFare);
  console.log('Restored New Fare:', newFare);
  console.log('Restored Fare Diff:', fareDiff);
  console.log('Restored Change Fee:', changeFee);
  console.log('Restored Cabin:', cabin);
  console.log('Restored Calculated K3:', k3Tax);
  console.log('Restored Per Pax:', perPax);
  console.log('Restored Old Tax:', oldTax);
  console.log('Restored New Tax:', newTax);
  console.log('Restored Base Badge:', baseBadgeText);
  console.log('Restored Bulb Visible:', bulbVisible);
  console.log('Restored Summary Visible:', isSummaryVisible);

  assert.strictEqual(oldFare, '199', 'Old fare must restore on reload');
  assert.strictEqual(newFare, '288', 'New fare must restore on reload');
  assert.strictEqual(fareDiff, 'INR1999', 'Manual Fare Diff must restore on reload');
  assert.strictEqual(changeFee, 'INR3000', 'Change Fee must restore on reload');
  assert.strictEqual(cabin, 'economy', 'Cabin must restore on reload');
  assert.strictEqual(k3Tax, 'INR250', 'Calculated K3 must restore on reload');
  assert.strictEqual(perPax, 'INR5449', 'Per Pax must restore on reload');
  assert.strictEqual(oldTax, 'INR500YQ', 'Old Tax must restore on reload');
  assert.strictEqual(newTax, 'INR700YQ', 'New Tax must restore on reload');
  assert.strictEqual(baseBadgeText, 'Base: USD89.00', 'Base diff badge must restore on reload');
  assert.ok(bulbVisible, 'Bulb must be visible on reload');
  assert.ok(isSummaryVisible, 'Summary table must restore and remain visible on reload');

  // Verify Summary table content
  const summaryHeader = await page.$eval('#summary table thead tr th:first-child', th => th.textContent.trim());
  console.log('Restored Summary Header:', summaryHeader);
  assert.strictEqual(summaryHeader, 'Booking class : Outbound T & Inbound X', 'Summary header must restore with Booking class');

  console.log('\nALL SESSION RESTORE TESTS PASSED 100%!');
  await browser.close();
})();
