const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const artifactDir = 'C:\\Users\\Parth Joshi\\.gemini\\antigravity-ide\\brain\\1a69e0b2-33ac-4d8b-a578-b99b256dd4e6';
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('Generating high-resolution visuals for Irregular Sequence & Reactivity Report...');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await context.newPage();

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  // --------------------------------------------------------------------------
  // VISUAL 1: Space-separated GDS Tax Paste Fix (Resolving Negative Taxes)
  // --------------------------------------------------------------------------
  console.log('Capturing Visual 1: Space-Separated Taxes Fix...');
  const oldTaxString = 'MUR12840YQ/MUR986AE/MUR1316F6/MUR546IN/MUR49JE/MUR1000MU/MUR1121OV/MUR684P2/MUR66TP/MUR198ZR/MUR10006A/MUR1506X';
  const newTaxString = `MUR12840YQ   MUR986AE      MUR1316F6
   MUR546IN      MUR49JE      MUR1000MU
   MUR1121OV     MUR684P2     MUR66TP
   MUR198ZR      MUR10006A    MUR1506X`;

  await page.fill('#oldTax', oldTaxString);
  await page.fill('#newTax', newTaxString);
  await page.waitForTimeout(400);

  const v1Path = path.join(artifactDir, 'visual_1_space_separated_taxes_fix.png');
  await page.screenshot({ path: v1Path, fullPage: false });
  console.log('Saved:', v1Path);

  // --------------------------------------------------------------------------
  // VISUAL 2: A -> B -> A Fare Roundtrip Restoration
  // --------------------------------------------------------------------------
  console.log('Capturing Visual 2: Fare Roundtrip Restoration...');
  await page.click('#taxClearButton');
  await page.selectOption('#currency', 'INR');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '305');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  // Edit to 307 and back to 305
  await page.fill('#newFare', '307');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);
  await page.fill('#newFare', '305');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  const v2Path = path.join(artifactDir, 'visual_2_fare_roundtrip_restoration.png');
  await page.screenshot({ path: v2Path, fullPage: false });
  console.log('Saved:', v2Path);

  // --------------------------------------------------------------------------
  // VISUAL 3: Mid-Calculation Currency Switch (KWD 3-Decimals & JPY 0-Decimals)
  // --------------------------------------------------------------------------
  console.log('Capturing Visual 3: Currency Switch...');
  await page.selectOption('#currency', 'KWD');
  await page.waitForTimeout(350);

  const v3Path = path.join(artifactDir, 'visual_3_mid_calculation_currency_switch.png');
  await page.screenshot({ path: v3Path, fullPage: false });
  console.log('Saved:', v3Path);

  // --------------------------------------------------------------------------
  // VISUAL 4: Dynamic Reverse Summary & Booking Class Update
  // --------------------------------------------------------------------------
  console.log('Capturing Visual 4: Dynamic Summary & Booking Class Header...');
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '305');
  await page.fill('#oldTax', 'USD100YQ');
  await page.fill('#newTax', 'USD150YQ');
  await page.click('#taxCalcButton');
  await page.click('#fareCalcButton');
  await page.click('#summariseButton');
  await page.waitForTimeout(300);

  // Now enter FCS in reverse
  if (await page.$eval('#parserCollapsible', el => el.classList.contains('collapsed'))) {
    await page.click('#parserToggleBtn');
    await page.waitForTimeout(100);
  }
  await page.fill('#fareCalcString', 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM 404.56XWEEFIN1/NDC2 Q5.00 NUC511.77 ROE90.3344456');
  await page.click('#parseButton');
  await page.waitForTimeout(300);

  const summaryEl = await page.$('#summaryContent');
  const v4Path = path.join(artifactDir, 'visual_4_dynamic_summary_booking_class.png');
  if (summaryEl) {
    await summaryEl.screenshot({ path: v4Path });
  } else {
    await page.screenshot({ path: v4Path });
  }
  console.log('Saved:', v4Path);

  // --------------------------------------------------------------------------
  // VISUAL 5: Manual Dual-Currency Settlement & Visual Bulb
  // --------------------------------------------------------------------------
  console.log('Capturing Visual 5: Manual Dual-Currency & Lightbulb...');
  await page.click('#taxClearButton');
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '100');
  await page.fill('#newFare', '200');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  // Select cabin first so K3 validation is satisfied
  await page.selectOption('#cabin', 'economy');
  await page.fill('#fareDiff', 'INR8500');
  await page.fill('#changeFee', 'INR3000');
  await page.check('#applyK3OnFareDiff');
  await page.check('#applyK3OnChangeFee');
  await page.waitForTimeout(400);

  // Hover on Fare Diff Bulb with force: true for animated elements
  await page.hover('#fareDiffBulb', { force: true });
  await page.waitForTimeout(300);

  const v5Path = path.join(artifactDir, 'visual_5_manual_dual_currency_propagation.png');
  await page.screenshot({ path: v5Path, fullPage: false });
  console.log('Saved:', v5Path);

  // --------------------------------------------------------------------------
  // VISUAL 6: Multi-PTC Consolidated Summary Table
  // --------------------------------------------------------------------------
  console.log('Capturing Visual 6: Multi-PTC Consolidated Summary...');
  // Adult is configured in USD (100 -> 200)
  await page.fill('#fareDiff', '');
  await page.evaluate(() => document.getElementById('fareDiff').blur());
  await page.fill('#changeFee', '');
  await page.uncheck('#applyK3OnChangeFee');
  await page.waitForTimeout(200);

  // Child tab
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(200);
  await page.selectOption('#currency', 'USD');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '50');
  await page.fill('#newFare', '120');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  // Switch back to ADT and click Summarise
  await page.click('#ptcTabADT');
  await page.waitForTimeout(200);
  await page.click('#summariseButton');
  await page.waitForTimeout(400);

  const v6Path = path.join(artifactDir, 'visual_6_multi_ptc_consolidated_summary.png');
  const summaryElMulti = await page.$('#summaryContent');
  if (summaryElMulti) {
    await summaryElMulti.screenshot({ path: v6Path });
  } else {
    await page.screenshot({ path: v6Path });
  }
  console.log('Saved:', v6Path);

  console.log('\nAll 6 test visuals captured successfully!');
  await browser.close();
})();
