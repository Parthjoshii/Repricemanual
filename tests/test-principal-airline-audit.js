const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  // Helper to close modal if open
  async function dismissModalIfVisible() {
    if (await page.isVisible('#errorModal.show')) {
      await page.click('.modal-close-btn');
      await page.waitForTimeout(100);
    }
  }

  // =========================================================================
  // TEST CASE 1: Standard Economy Reissue (BOM–DXB–LHR)
  // 5% K3 accumulation on Fare Diff (INR 7,000) + Change Fee (INR 3,000) + Positive YQ (INR 2,000)
  // =========================================================================
  console.log('--- Case 1: Standard Economy Reissue (BOM–DXB–LHR) ---');
  await page.selectOption('#currency', 'INR');
  await page.selectOption('#cabin', 'economy');

  await page.fill('#oldTax', 'INR4855YQ/INR1944AE/INR2592F6/INR1033IN');
  await page.fill('#newTax', 'INR6855YQ/INR1944AE/INR2592F6/INR1033IN');
  await dismissModalIfVisible();
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  await page.fill('#oldFare', 'INR45000');
  await page.fill('#newFare', 'INR52000');
  await page.fill('#changeFee', 'INR3000');

  await page.check('#applyK3OnFareDiff');
  await page.check('#applyK3OnChangeFee');
  await page.check('#applyK3OnYQ');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  const case1FareDiff = await page.inputValue('#fareDiff');
  const case1AddTaxes = await page.inputValue('#addTaxes');
  const case1TaxAdj = await page.inputValue('#taxAdj');
  const case1PerPax = await page.inputValue('#perPax');

  console.log('Case 1 Fare Diff:', case1FareDiff);
  console.log('Case 1 Add Taxes:', case1AddTaxes);
  console.log('Case 1 Tax Adj:', case1TaxAdj);
  console.log('Case 1 Per Pax:', case1PerPax);

  // K3: 5% of 7000 = 350, 5% of 3000 = 150 (folded into Change Fee: 3150 incl. of K3), 5% of 2000 = 100 => K3 in Add Taxes = 450
  // Positive YQ = 2000 => Add Taxes = INR2000YQ/INR450K3 (Total 2450)
  assert.ok(case1AddTaxes.includes('450K3') || case1AddTaxes.includes('450.00K3'), 'Add Taxes must have 450 K3: ' + case1AddTaxes);
  assert.ok(case1AddTaxes.includes('2000YQ') || case1AddTaxes.includes('2000.00YQ'), 'Add Taxes must have 2000 YQ: ' + case1AddTaxes);
  assert.strictEqual(case1TaxAdj, 'INR2450', 'Tax Adjustment Net must be INR2450');
  assert.strictEqual(case1PerPax, 'INR12600', 'Per Pax must be 7000 + 3150 (fee incl K3) + 2450 = INR12600');
  console.log('✓ Case 1 passed: Standard Economy Reissue reconciled with zero audit discrepancy.');

  // =========================================================================
  // TEST CASE 2: Cabin Upgrade (DEL–DOH–JFK, Economy to Business with 12% K3 Rate Switch)
  // =========================================================================
  console.log('--- Case 2: Cabin Upgrade (Economy to Business) ---');
  await page.click('#fareClearButton');
  await page.click('#taxClearButton');
  await page.waitForTimeout(200);

  await page.selectOption('#currency', 'INR');
  await page.selectOption('#cabin', 'business'); // 12% K3

  await page.fill('#oldTax', 'INR12000YQ');
  await page.fill('#newTax', 'INR18000YQ'); // +6000 YQ diff
  await dismissModalIfVisible();
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  await page.fill('#oldFare', 'INR60000');
  await page.fill('#newFare', 'INR140000'); // +80,000 fare diff
  await page.fill('#changeFee', 'INR5000');

  await page.check('#applyK3OnFareDiff');
  await page.check('#applyK3OnChangeFee');
  await page.check('#applyK3OnYQ');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(300);

  const case2AddTaxes = await page.inputValue('#addTaxes');
  const case2TaxAdj = await page.inputValue('#taxAdj');
  const case2PerPax = await page.inputValue('#perPax');

  console.log('Case 2 Add Taxes:', case2AddTaxes);
  console.log('Case 2 Tax Adj:', case2TaxAdj);
  console.log('Case 2 Per Pax:', case2PerPax);

  // K3 at business rate (18% in K3_RATES):
  // Fare diff: 80,000 * 18% = 14,400
  // Fee: 5,000 * 18% = 900 (folded into Change Fee: 5,900 incl. of K3)
  // YQ: 6,000 * 18% = 1,080
  // Add Taxes K3 = 14,400 + 1,080 = 15,480
  // Add Taxes = INR6000YQ/INR15480K3 (Total 21,480)
  assert.ok(case2AddTaxes.includes('15480K3') || case2AddTaxes.includes('15480.00K3'), 'Add Taxes must have 15480 K3: ' + case2AddTaxes);
  assert.strictEqual(case2TaxAdj, 'INR21480', 'Tax Adj Net must be INR21480');
  assert.strictEqual(case2PerPax, 'INR107380', 'Per Pax must be 80000 + 5900 (fee incl K3) + 21480 = INR107380');
  console.log('✓ Case 2 passed: Cabin Upgrade dynamically scaled Business K3 correctly.');

  // =========================================================================
  // TEST CASE 3: Downgrade / Lower New Base Fare Notification
  // =========================================================================
  console.log('--- Case 3: Downgrade / Lower New Base Fare Notification ---');
  await page.click('#fareClearButton');
  await page.click('#taxClearButton');
  await page.waitForTimeout(200);

  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', 'USD3500');
  await page.fill('#newFare', 'USD2200'); // New fare lower than old fare
  await page.waitForTimeout(400); // wait for debounce / calculate

  const modalShown = await page.isVisible('#errorModal.show');
  assert.strictEqual(modalShown, true, 'Notice modal must pop up when new base fare is lower than old base fare');
  const modalMsg = await page.textContent('#modalMessage');
  console.log('Downgrade modal message:', modalMsg);
  assert.ok(modalMsg.includes('lower than Old Base Fare'), 'Message notifies user of lower base fare');

  await dismissModalIfVisible();
  // Verify typing fee does NOT re-trigger modal
  await page.fill('#changeFee', 'USD250');
  await page.waitForTimeout(400);
  assert.strictEqual(await page.isVisible('#errorModal.show'), false, 'Modal should not re-trigger on subsequent edits');

  const case3FareDiff = await page.inputValue('#fareDiff');
  const case3PerPax = await page.inputValue('#perPax');
  console.log('Case 3 Fare Diff:', case3FareDiff);
  console.log('Case 3 Per Pax:', case3PerPax);
  assert.strictEqual(case3FareDiff, 'USD-1300.00', 'Fare diff should reflect negative difference');
  assert.strictEqual(case3PerPax, 'USD-1050.00', 'Per pax should reflect -1300 + 250 = USD-1050.00');
  console.log('✓ Case 3 passed: Lower new base fare notification and calculation verified.');

  // =========================================================================
  // =========================================================================
  // TEST CASE 4: Hybrid Passenger Journey (Child Outbound, Adult Inbound)
  // =========================================================================
  console.log('--- Case 4: Hybrid Pax Journey (CNN_ADT Outbound Child, Inbound Adult) ---');
  // First, parse and validate the Adult fare calculation string on ADT tab
  await page.click('.ptc-tab[data-ptc="ADT"], .ptc-tab:has-text("Adult"), .ptc-tab:has-text("ADT")');
  await page.waitForTimeout(200);

  const adultHybridSource = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC1215.27END ROE0.855028';
  await page.fill('#fareCalcString', adultHybridSource);
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  // Switch to CHD/ADT (or CNN/ADT) tab and enable Auto-calculate from Adult
  const tabSelector = '#ptcTabCHD_ADT, #ptcTabCNN_ADT, .ptc-tab[data-ptc="CHD_ADT"], .ptc-tab:has-text("Child to Adult"), .ptc-tab:has-text("CHD/ADT"), .ptc-tab:has-text("CNN/ADT")';
  await page.click(tabSelector);
  await page.waitForTimeout(200);

  await page.click('#autoCalcFromAdult');
  await page.waitForTimeout(300);

  // Verify outbound component (DUB-COK 470.74 * 0.75 = 353.06)
  // Inbound component (COK-DUB 585.36 * 1.00 = 585.36)
  // Scaled Q: 58.47*0.75=43.85, 18.82*0.75=14.12, 58.47*1=58.47, 23.41*1=23.41 => 139.85
  // Total NUC = 353.06 + 585.36 + 139.85 = 1078.27
  const hybridFareComps = await page.textContent('#fareComponents');
  console.log('Hybrid Fare Components:', hybridFareComps);
  assert.ok(hybridFareComps.includes('353.06'), 'Outbound component scaled by 75%: 353.06');
  assert.ok(hybridFareComps.includes('585.36'), 'Inbound component scaled by 100%: 585.36');

  const hybridCalcNuc = await page.textContent('#calculatedNuc');
  console.log('Hybrid Calculated NUC:', hybridCalcNuc);
  assert.ok(hybridCalcNuc.includes('1078.27'), 'Calculated NUC matches scaled total 1078.27');

  // Also verify manual entry: textarea raw string must stay untouched when halving is checked
  await page.click('#autoCalcFromAdult'); // uncheck auto-calc
  await page.waitForTimeout(200);
  const manualInputString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC1215.27END ROE0.855028';
  await page.fill('#fareCalcString', manualInputString);
  await page.click('#halveFareComponents');
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  const rawTextareaAfterConvert = await page.inputValue('#fareCalcString');
  assert.strictEqual(rawTextareaAfterConvert, manualInputString, 'Raw textarea input string must stay untouched after halving');
  console.log('✓ Case 4 passed: Hybrid CNN/ADT leg-specific scaling and raw string retention verified.');

  // =========================================================================
  // TEST CASE 5: Three-Decimal Currency Exchange (KWD / OMR)
  // =========================================================================
  console.log('--- Case 5: Three-Decimal Currency Exchange (KWD) ---');
  // Switch back to ADT tab
  await page.click('.ptc-tab[data-ptc="ADT"], .ptc-tab:has-text("Adult"), .ptc-tab:has-text("ADT")');
  await page.waitForTimeout(200);

  await page.selectOption('#currency', 'KWD');
  await page.fill('#oldTax', 'KWD10.100YQ');
  await page.fill('#newTax', 'KWD15.350YQ'); // +5.250 YQ diff
  await dismissModalIfVisible();
  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  await page.fill('#fareDiff', 'KWD150.250');
  await page.fill('#changeFee', 'KWD25.500');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  const case5AddTaxes = await page.inputValue('#addTaxes');
  const case5TaxAdj = await page.inputValue('#taxAdj');
  const case5PerPax = await page.inputValue('#perPax');

  console.log('Case 5 Add Taxes:', case5AddTaxes);
  console.log('Case 5 Tax Adj:', case5TaxAdj);
  console.log('Case 5 Per Pax:', case5PerPax);

  // KWD minor unit is 3 decimals: 150.250 + 25.500 + 5.250 = 181.000
  assert.ok(case5AddTaxes.includes('5.250YQ'), 'Add Taxes preserves 3 decimals: ' + case5AddTaxes);
  assert.strictEqual(case5TaxAdj, 'KWD5.250', 'Tax Adj Net preserves 3 decimals');
  assert.strictEqual(case5PerPax, 'KWD181.000', 'Per Pax preserves 3 decimals: ' + case5PerPax);
  console.log('✓ Case 5 passed: Three-decimal KWD currency calculations preserved.');

  assert.strictEqual(errors.length, 0, 'Zero errors');
  await browser.close();
  console.log('\n======================================================');
  console.log('ALL 5 PRINCIPAL AIRLINE AUDIT TEST CASES PASSED 100%!');
  console.log('======================================================');
})();
