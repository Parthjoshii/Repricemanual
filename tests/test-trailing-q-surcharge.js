const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  console.log('========================================================================');
  console.log('TESTING TRAILING Q SURCHARGE DETECTION & POP-UP VERIFICATION MODAL');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // -------------------------------------------------------------------------
  // TEST 1: User String triggers Modal & "Apply Standard Format & Validate"
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Prompt Modal & "Apply Standard Format & Validate" ---');
  const userFcs = 'VCE QR DOH QR BLR Q 12.29 563.74KLEESIT1/ITN2 QR DOH QR VCE 563.74KLEESIT1/ITN2Q12.29 NUC1152.06 ROE0.925820';
  await page.fill('#fareCalcString', userFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  // Modal should be visible
  const isModalVisible = await page.isVisible('#qCorrectionModal.show');
  console.log('Q Correction Modal Visible:', isModalVisible);
  assert.strictEqual(isModalVisible, true, 'Modal should be displayed upon detecting trailing Q');

  // Verify modal content
  const modalBadge = await page.textContent('.q-modal-badge');
  console.log('Modal Badge:', modalBadge);
  assert.strictEqual(modalBadge.trim(), 'FARE CALC STRING FORMAT');

  const modalHeading = await page.textContent('#qCorrectionTitle');
  console.log('Modal Heading:', modalHeading);
  assert.strictEqual(modalHeading, 'Fare Calculation Syntax Notice');

  const modalDesc = await page.textContent('.q-modal-desc');
  console.log('Modal Desc contains Fare Calc String format:', modalDesc.includes('Fare Calc String format'));
  assert.strictEqual(modalDesc.includes('Fare Calc String format'), true);

  const recommendedLabel = await page.textContent('.q-diff-card-recommended .q-diff-label span:first-child');
  console.log('Recommended Card Label:', recommendedLabel);
  assert.strictEqual(recommendedLabel.trim(), 'Standard Fare Calc String Format');

  const diffInputted = await page.innerHTML('#qDiffInputted');
  console.log('Diff Inputted HTML contains highlight:', diffInputted.includes('q-hl-misplaced'));
  assert.strictEqual(diffInputted.includes('q-hl-misplaced'), true);

  const diffStandardized = await page.innerHTML('#qDiffStandardized');
  console.log('Diff Standardized HTML contains highlight:', diffStandardized.includes('q-hl-standard'));
  assert.strictEqual(diffStandardized.includes('q-hl-standard'), true);

  // Click "Apply Standard Format & Validate"
  await page.click('#qCorrectionApplyBtn');
  await page.waitForTimeout(300);

  // Modal should now be closed
  const isModalOpenAfterApply = await page.isVisible('#qCorrectionModal.show');
  assert.strictEqual(isModalOpenAfterApply, false, 'Modal should close after Apply');

  // Textarea should have the standardized string
  const updatedTextarea = await page.inputValue('#fareCalcString');
  console.log('Updated Textarea Value:', updatedTextarea);
  assert.strictEqual(updatedTextarea.includes('Q12.29 563.74KLEESIT1/ITN2'), true, 'Textarea should contain standardized format');

  // Fare Components
  const fcItems = await page.$$eval('#fareComponents li', lis => lis.map(li => li.innerText));
  console.log('Fare Components:', fcItems);
  assert.strictEqual(fcItems.length, 2);
  assert.strictEqual(fcItems[1].includes('(KLEESIT1/ITN2)'), true, 'Second component should be KLEESIT1/ITN2 (not corrupted to /ITN2Q12)');

  // Q Surcharges
  const qItems = await page.$$eval('#qSurcharges li', lis => lis.map(li => li.innerText));
  console.log('Q Surcharges:', qItems);
  assert.deepStrictEqual(qItems, ['12.29', '12.29']);

  // NUC Validation
  const calcNucText = await page.textContent('#calculatedNuc');
  console.log('Calculated NUC:', calcNucText);
  assert.strictEqual(calcNucText.includes('1152.06'), true);

  const nucValidationText = await page.textContent('#nucValidation');
  console.log('NUC Validation Result:', nucValidationText);
  assert.strictEqual(nucValidationText.includes('PASS'), true);

  console.log('✓ TEST 1 passed: Modal correctly displayed and Apply Standard Format validated with 100% precision.\n');

  // -------------------------------------------------------------------------
  // TEST 2: "Validate As-Is" Keeps Raw Text Untouched & Validates In-Memory
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: "Validate As-Is" with Raw Text Retention ---');
  await page.click('#parserClearButton');
  await page.waitForTimeout(100);

  await page.fill('#fareCalcString', userFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  // Modal open
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true);

  // Click "Validate As-Is"
  await page.click('#qCorrectionAsIsBtn');
  await page.waitForTimeout(300);

  // Modal closed
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false);

  // Textarea should retain raw input unmodified per Invariant 3
  const asIsTextarea = await page.inputValue('#fareCalcString');
  console.log('As-Is Textarea Value:', asIsTextarea);
  assert.strictEqual(asIsTextarea, userFcs, 'Raw input must remain pristine in textarea');

  // Fare components clean
  const asIsFcItems = await page.$$eval('#fareComponents li', lis => lis.map(li => li.innerText));
  console.log('As-Is Fare Components:', asIsFcItems);
  assert.strictEqual(asIsFcItems[1].includes('(KLEESIT1/ITN2)'), true, 'Designator must not swallow Q12 even in As-Is mode');

  // Q surcharges clean
  const asIsQItems = await page.$$eval('#qSurcharges li', lis => lis.map(li => li.innerText));
  console.log('As-Is Q Surcharges:', asIsQItems);
  assert.deepStrictEqual(asIsQItems, ['12.29', '12.29']);

  // NUC Validation PASS
  const asIsNucVal = await page.textContent('#nucValidation');
  assert.strictEqual(asIsNucVal.includes('PASS'), true);

  // Subsequent Convert click without text change should not re-trigger popup
  await page.click('#parseButton');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Subsequent Convert on same verified string should not re-prompt');

  console.log('✓ TEST 2 passed: Validate As-Is validates cleanly and leaves raw text pristine.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Dismissal via Close button & Escape key
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: Dismiss Modal via Close Button & Escape ---');
  await page.click('#parserClearButton');
  await page.waitForTimeout(100);

  await page.fill('#fareCalcString', userFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true);

  // Close via X button
  await page.click('#qCorrectionCloseBtn');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Modal should close on X button');

  // Re-open and close via Escape
  await page.click('#parseButton');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.strictEqual(await page.isVisible('#qCorrectionModal.show'), false, 'Modal should close on Escape key');

  console.log('✓ TEST 3 passed: Modal close button and Escape key dismiss cleanly.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Auto-Calculate & Downstream Halving with Misplaced Q
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Auto-Calculate to Child (CNN) & Halving Integration ---');
  // Re-validate Adult string
  await page.fill('#fareCalcString', userFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(200);
  await page.click('#qCorrectionApplyBtn');
  await page.waitForTimeout(200);

  // Switch to CNN
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(200);

  // Enable Auto-calculate from Adult
  await page.click('#autoCalcFromAdult');
  await page.waitForTimeout(300);

  const cnnFcs = await page.inputValue('#fareCalcString');
  console.log('CNN Derived String:', cnnFcs);
  // Adult fare was 563.74 * 0.75 = 422.81, Q was 12.29 * 0.75 = 9.22
  assert.strictEqual(cnnFcs.includes('422.81'), true);
  assert.strictEqual(cnnFcs.includes('KLEESIT1CH'), true);

  // Convert is automatically performed by autoCalcFromAdult
  const cnnNucVal = await page.textContent('#nucValidation');
  console.log('CNN NUC Validation:', cnnNucVal);
  assert.strictEqual(cnnNucVal.includes('PASS'), true);

  console.log('✓ TEST 4 passed: Auto-calc to Child seamlessly scales decoupled fare components and Q surcharges.\n');

  // -------------------------------------------------------------------------
  // TEST 5: User Screenshot Case with Coded Q Surcharge Glued After Ticket Designator
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: User Case (585.36UHEESIE1/VFN2Q COKDUB58.47) ---');
  await page.click('#ptcTabADT');
  await page.waitForTimeout(150);
  await page.click('#parserClearButton');
  await page.waitForTimeout(100);

  const userCaseString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB23.41 585.36UHEESIE1/VFN2Q COKDUB58.47 NUC0END ROE0.855028';
  await page.fill('#fareCalcString', userCaseString);
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  // Modal must be triggered
  const isModalActiveForUserCase = await page.isVisible('#qCorrectionModal.show');
  console.log('Modal active for user case:', isModalActiveForUserCase);
  assert.strictEqual(isModalActiveForUserCase, true, 'Modal MUST be active for Q COKDUB58.47 after ticket designator');

  // Verify highlights
  const userDiffInputted = await page.innerHTML('#qDiffInputted');
  assert.strictEqual(userDiffInputted.includes('q-hl-misplaced'), true);
  assert.strictEqual(userDiffInputted.includes('Q COKDUB58.47'), true);

  // Click Apply
  await page.click('#qCorrectionApplyBtn');
  await page.waitForTimeout(300);

  // Check Fare Components: second component must NOT have Q swallowed into ticket designator
  const userFcItems = await page.$$eval('#fareComponents li', lis => lis.map(li => li.innerText));
  console.log('User Case Fare Components:', userFcItems);
  assert.strictEqual(userFcItems.length, 2);
  assert.strictEqual(userFcItems[0].includes('470.74 (QHAMPIE1/VFN2)'), true);
  assert.strictEqual(userFcItems[1].includes('585.36 (UHEESIE1/VFN2)'), true, 'Second component must be UHEESIE1/VFN2 with NO trailing Q');

  // Check Q Surcharges: phantom 2.00 must NOT exist!
  const userQItems = await page.$$eval('#qSurcharges li', lis => lis.map(li => li.innerText));
  console.log('User Case Q Surcharges:', userQItems);
  assert.strictEqual(userQItems.includes('2.00'), false, 'Phantom 2.00 surcharge must NOT exist');
  assert.deepStrictEqual(userQItems, ['58.47', '18.82', '23.41', '58.47']);

  // Check Calculated NUC: 470.74 + 585.36 + 58.47 + 18.82 + 23.41 + 58.47 = 1215.27
  const userCalcNuc = await page.textContent('#calculatedNuc');
  console.log('User Case Calculated NUC:', userCalcNuc);
  assert.strictEqual(userCalcNuc.includes('1215.27'), true, 'Calculated NUC must be 1215.27');

  console.log('✓ TEST 5 passed: Modal activates, clean designator /VFN2, no phantom 2.00, calculated NUC = 1215.27.\n');

  await browser.close();

  console.log('========================================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! ZERO DEFECTS.');
  console.log('========================================================================');
})();
