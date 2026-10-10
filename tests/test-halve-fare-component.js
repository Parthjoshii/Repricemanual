const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  console.log('--- Test 1: One-way journey guard blocks halving ---');
  const owString = 'BOM EK DXB 300.00TLEEPIN1/NDC2 NUC300.00 ROE1.0';
  await page.fill('#fareCalcString', owString);
  await page.waitForTimeout(100);

  // Check the halve checkbox
  await page.click('#halveFareComponents');
  await page.waitForTimeout(200);

  const modalVisible = await page.isVisible('#errorModal.show');
  assert.strictEqual(modalVisible, true, 'Error modal should appear when halving a one-way fare');
  const modalText = await page.textContent('#modalMessage');
  console.log('One-way guard modal message:', modalText);
  assert.ok(modalText.includes('not applicable for a one-way journey'), 'Modal should inform user that halving is not applicable for one-way: ' + modalText);

  // Verify checkbox was reverted to unchecked
  const isChecked = await page.isChecked('#halveFareComponents');
  assert.strictEqual(isChecked, false, 'Checkbox should be automatically unchecked for one-way journeys');

  // Verify string in textarea was NOT modified
  const currentVal = await page.inputValue('#fareCalcString');
  assert.strictEqual(currentVal, owString, 'One-way string must remain completely unchanged in textarea');
  console.log('✓ One-way guard successfully blocked halving, reverted checkbox, and preserved string in textarea');

  // Close modal
  await page.click('.modal-close-btn');
  await page.waitForTimeout(100);

  console.log('--- Test 2: Round-trip journey with halving enabled: textarea stays as is, results show halved string ---');
  const rtString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC0END ROE0.855028';
  await page.fill('#fareCalcString', rtString);
  await page.waitForTimeout(100);

  // Check the halve checkbox
  await page.click('#halveFareComponents');
  await page.waitForTimeout(300);

  // CRITICAL: Textarea must NOT be replaced with halved values!
  const textareaVal = await page.inputValue('#fareCalcString');
  console.log('Textarea content after enabling halving:', textareaVal);
  assert.strictEqual(textareaVal, rtString, 'The string entered by the user in the textarea must stay as it is!');
  assert.ok(textareaVal.includes('470.74QHAMPIE1/VFN2'), 'Textarea retains original 470.74');
  assert.ok(textareaVal.includes('585.36UHEESIE1/VFN2'), 'Textarea retains original 585.36');

  // Results: Fare components list shows halved amounts (235.37, 292.68)
  const fareCompList = await page.textContent('#fareComponents');
  console.log('Fare Components list:', fareCompList);
  assert.ok(fareCompList.includes('235.37'), 'Fare components list shows halved 235.37');
  assert.ok(fareCompList.includes('292.68'), 'Fare components list shows halved 292.68');

  // Calculated NUC: 235.37 + 292.68 + 58.47 + 18.82 + 58.47 + 23.41 = 687.22
  const calcNucText = await page.textContent('#calculatedNuc');
  console.log('Calculated NUC:', calcNucText);
  assert.ok(calcNucText.includes('687.22'), 'Calculated NUC should be 687.22: ' + calcNucText);

  // Base Fare: 687.22 * 0.855028 = 587.59 / 587.60
  const baseFareText = await page.textContent('#baseFare');
  console.log('Base Fare:', baseFareText);
  assert.ok(baseFareText.includes('587.60') || baseFareText.includes('587.59'), 'Base Fare should be 587.59/587.60: ' + baseFareText);

  // Corrected Fare String in results displays the halved string!
  const nucValidationText = await page.textContent('#nucValidation');
  console.log('NUC Validation section:', nucValidationText);
  assert.ok(nucValidationText.includes('Corrected Fare String:'), 'Validator displays Corrected Fare String');
  assert.ok(nucValidationText.includes('235.37QHAMPIE1/VFN2'), 'Corrected string contains halved 235.37');
  assert.ok(nucValidationText.includes('292.68UHEESIE1/VFN2'), 'Corrected string contains halved 292.68');
  assert.ok(nucValidationText.includes('NUC687.22'), 'Corrected string contains NUC687.22');
  console.log('✓ Textarea preserved as entered; validator results show halved string and components correctly!');

  console.log('--- Test 3: Unchecking halving recalculates back to unhalved values without modifying textarea ---');
  await page.click('#halveFareComponents');
  await page.waitForTimeout(300);

  const textareaValUnchecked = await page.inputValue('#fareCalcString');
  assert.strictEqual(textareaValUnchecked, rtString, 'Textarea still matches original entered string');

  const unhalvedCompList = await page.textContent('#fareComponents');
  assert.ok(unhalvedCompList.includes('470.74'), 'Fare components list shows unhalved 470.74');
  assert.ok(unhalvedCompList.includes('585.36'), 'Fare components list shows unhalved 585.36');

  const unhalvedNuc = await page.textContent('#calculatedNuc');
  assert.ok(unhalvedNuc.includes('1215.27'), 'Calculated NUC shows unhalved total 1215.27: ' + unhalvedNuc);
  console.log('✓ Unchecking halving recalculates to unhalved values seamlessly');

  console.log('--- Test 4: User has already entered halved components: validator checks NUC and passes as previously doing ---');
  const alreadyHalvedString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 235.37QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 292.68UHEESIE1/VFN2 NUC687.22END ROE0.855028';
  await page.fill('#fareCalcString', alreadyHalvedString);
  // Halving checkbox is unchecked
  assert.strictEqual(await page.isChecked('#halveFareComponents'), false);

  await page.click('#parseButton');
  await page.waitForTimeout(200);

  const alreadyHalvedTextarea = await page.inputValue('#fareCalcString');
  assert.strictEqual(alreadyHalvedTextarea, alreadyHalvedString);

  const passValidation = await page.textContent('#nucValidation');
  console.log('Validation text for already-halved string:', passValidation);
  assert.ok(passValidation.includes('PASS'), 'NUC Validation must be PASS: ' + passValidation);
  assert.ok(!passValidation.includes('FAIL'), 'Must not fail');

  const statedNucText = await page.textContent('#statedNuc');
  assert.strictEqual(statedNucText.trim(), '687.22');
  console.log('✓ Already-halved string validates NUC and displays PASS as previously doing');

  console.log('--- Test 5: Clear parser resets checkbox and results ---');
  await page.click('#parserClearButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.inputValue('#fareCalcString'), '');
  assert.strictEqual(await page.isChecked('#halveFareComponents'), false);
  console.log('✓ Clear parser reset fare string and checkbox');

  assert.strictEqual(errors.length, 0, 'Zero errors');
  await browser.close();
  console.log('ALL HALVE FARE COMPONENT TESTS PASSED!');
})();
