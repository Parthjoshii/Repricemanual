const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  const setAdt = async (str) => {
    await page.click('#ptcTabADT');
    await page.waitForTimeout(80);
    await page.fill('#fareCalcString', str);
    await page.click('#parseButton');
    await page.waitForTimeout(120);
    const v = await page.$eval('#nucValidation', el => el.textContent);
    assert.ok(v.includes('PASS'), 'ADT string should validate PASS: ' + v + ' for ' + str);
  };

  // Idempotent: switching into a tab whose checkbox is already checked (reused across scenarios)
  // silently re-triggers auto-calc on its own (switchPtcTab's reentrant path) — only click the
  // checkbox if it isn't already checked, otherwise a redundant click can get blocked by a modal
  // the reentrant recalculation just opened.
  const enableAutoCalc = async (ptc) => {
    await page.click(`#ptcTab${ptc}`);
    await page.waitForTimeout(120);
    const checked = await page.isChecked('#autoCalcFromAdult');
    if (!checked) {
      await page.click('#autoCalcFromAdult');
      await page.waitForTimeout(120);
    }
  };

  // --- Tab bar registration ---
  const tabTexts = await page.$$eval('.ptc-tabs .ptc-tab', els => els.map(e => e.getAttribute('data-ptc')));
  assert.deepStrictEqual(tabTexts, ['ADT', 'CNN', 'INF', 'INF_CNN', 'CNN_ADT'], 'Expected 5 built-in tabs in order: ' + JSON.stringify(tabTexts));
  console.log('CHECK1 OK: 5 built-in tabs registered (ADT, CNN, INF, INF_CNN, CNN_ADT)');

  // --- Hint text ---
  await page.click('#ptcTabINF_CNN');
  await page.waitForTimeout(80);
  const hint = await page.$eval('#autoCalcHint', el => el.textContent);
  assert.strictEqual(hint, 'Outbound 10% (Infant) · Inbound 75% (Child)', 'Unexpected hint text: ' + hint);
  console.log('CHECK2 OK: INF_CNN hint text correct:', hint);

  // --- Plain round trip: INF_CNN ---
  const roundTrip = 'DUB EK X/DXB EK COK 400.00QHAMPIE1/VFN2 EK X/DXB DUB 400.00UHEESIE1/VFN2 NUC800.00 ROE1.0';
  await setAdt(roundTrip);
  await enableAutoCalc('INF_CNN');
  const infCnnDerived = await page.inputValue('#fareCalcString');
  console.log('INF_CNN derived (round trip):', infCnnDerived);
  assert.ok(infCnnDerived.includes('40.00QHAMPIE1IN/VFN2'), 'Outbound scaled to 10% with IN suffix: ' + infCnnDerived);
  assert.ok(infCnnDerived.includes('300.00UHEESIE1CH/VFN2'), 'Inbound scaled to 75% with CH suffix: ' + infCnnDerived);
  assert.ok(infCnnDerived.includes('NUC340.00'), 'Recomputed NUC (40+300): ' + infCnnDerived);
  const infCnnValidation = await page.$eval('#nucValidation', el => el.textContent);
  assert.ok(infCnnValidation.includes('PASS'), 'Derived INF_CNN string should self-validate PASS: ' + infCnnValidation);
  const fareComponentsHtml1 = await page.$eval('#fareComponents', el => el.innerHTML);
  assert.ok(fareComponentsHtml1.includes('Outbound') && fareComponentsHtml1.includes('Inbound'), 'Fare component list should show Outbound/Inbound labels: ' + fareComponentsHtml1);
  console.log('CHECK3 OK: INF_CNN plain round trip scales 10%/75%, recomputes NUC, shows phase labels');

  // --- Plain round trip: CNN_ADT ---
  await setAdt(roundTrip);
  await enableAutoCalc('CNN_ADT');
  const cnnAdtDerived = await page.inputValue('#fareCalcString');
  console.log('CNN_ADT derived (round trip):', cnnAdtDerived);
  assert.ok(cnnAdtDerived.includes('300.00QHAMPIE1CH/VFN2'), 'Outbound scaled to 75% with CH suffix: ' + cnnAdtDerived);
  assert.ok(cnnAdtDerived.includes('400.00UHEESIE1/VFN2') && !cnnAdtDerived.includes('UHEESIE1CH') && !cnnAdtDerived.includes('UHEESIE1IN'), 'Inbound at 100% with no suffix: ' + cnnAdtDerived);
  assert.ok(cnnAdtDerived.includes('NUC700.00'), 'Recomputed NUC (300+400): ' + cnnAdtDerived);
  console.log('CHECK4 OK: CNN_ADT plain round trip scales 75%/100%, no suffix on inbound');

  // --- Side trip inside outbound leg ---
  const sideTripOutbound = 'DUB EK X/DXB EK COK 400.00QHAMPIE1/VFN2 (EK COK BEY COK 100.00XXXXXXX1) EK X/DXB DUB 400.00UHEESIE1/VFN2 NUC900.00 ROE1.0';
  await setAdt(sideTripOutbound);
  await enableAutoCalc('INF_CNN');
  const sideOutDerived = await page.inputValue('#fareCalcString');
  console.log('INF_CNN derived (side trip in outbound):', sideOutDerived);
  assert.ok(sideOutDerived.includes('40.00QHAMPIE1IN/VFN2'), 'Outbound primary scaled 10%: ' + sideOutDerived);
  assert.ok(sideOutDerived.includes('10.00XXXXXXX1IN'), 'Side trip (in outbound leg) scaled 10%: ' + sideOutDerived);
  assert.ok(sideOutDerived.includes('300.00UHEESIE1CH/VFN2'), 'Inbound primary scaled 75%: ' + sideOutDerived);
  assert.ok(sideOutDerived.includes('NUC350.00'), 'Recomputed NUC (40+10+300): ' + sideOutDerived);
  console.log('CHECK5 OK: side trip inside outbound leg scales at the outbound ratio');

  // --- Side trip inside inbound leg ---
  const sideTripInbound = 'DUB EK X/DXB EK COK 400.00QHAMPIE1/VFN2 EK X/DXB DUB 400.00UHEESIE1/VFN2 (EK DUB LHR DUB 50.00YYYYYYY2) NUC850.00 ROE1.0';
  await setAdt(sideTripInbound);
  await enableAutoCalc('INF_CNN');
  const sideInDerived = await page.inputValue('#fareCalcString');
  console.log('INF_CNN derived (side trip in inbound):', sideInDerived);
  assert.ok(sideInDerived.includes('40.00QHAMPIE1IN/VFN2'), 'Outbound primary scaled 10%: ' + sideInDerived);
  assert.ok(sideInDerived.includes('300.00UHEESIE1CH/VFN2'), 'Inbound primary scaled 75%: ' + sideInDerived);
  assert.ok(sideInDerived.includes('37.50YYYYYYY2CH'), 'Side trip (in inbound leg) scaled 75%: ' + sideInDerived);
  assert.ok(sideInDerived.includes('NUC377.50'), 'Recomputed NUC (40+300+37.50): ' + sideInDerived);
  console.log('CHECK6 OK: side trip inside inbound leg scales at the inbound ratio');

  // --- Open jaw marker passes through untouched ---
  const openJaw = 'DUB EK X/DXB EK COK 400.00QHAMPIE1/VFN2 -/ EK X/DXB DUB 400.00UHEESIE1/VFN2 NUC800.00 ROE1.0';
  await setAdt(openJaw);
  await enableAutoCalc('INF_CNN');
  const openJawDerived = await page.inputValue('#fareCalcString');
  console.log('INF_CNN derived (open jaw):', openJawDerived);
  assert.ok(openJawDerived.includes('-/'), 'Open jaw marker should pass through untouched: ' + openJawDerived);
  assert.ok(openJawDerived.includes('40.00QHAMPIE1IN/VFN2'), 'Outbound scaled 10%: ' + openJawDerived);
  assert.ok(openJawDerived.includes('300.00UHEESIE1CH/VFN2'), 'Inbound scaled 75%: ' + openJawDerived);
  assert.ok(openJawDerived.includes('NUC340.00'), 'Recomputed NUC: ' + openJawDerived);
  console.log('CHECK7 OK: open jaw marker preserved, split still correct');

  // --- Fallback: one-way (1 primary component) ---
  const oneWay = 'DUB EK COK 400.00QHAMPIE1/VFN2 NUC400.00 ROE1.0';
  await setAdt(oneWay);
  await enableAutoCalc('INF_CNN');
  const oneWayModalVisible = await page.isVisible('#errorModal.show');
  const oneWayModalText = oneWayModalVisible ? await page.textContent('#modalMessage') : null;
  console.log('One-way fallback warning:', oneWayModalText);
  assert.ok(oneWayModalVisible, 'Expected a fallback warning for a one-way (1-component) string');
  assert.ok(oneWayModalText.includes('outbound'), 'Warning should mention outbound-only fallback: ' + oneWayModalText);
  await page.click('.modal-close-btn');
  const oneWayDerived = await page.inputValue('#fareCalcString');
  console.log('INF_CNN derived (one-way fallback):', oneWayDerived);
  assert.ok(oneWayDerived.includes('40.00QHAMPIE1IN/VFN2'), 'Whole string scaled at outbound (10%) rate: ' + oneWayDerived);
  assert.ok(oneWayDerived.includes('NUC40.00'), 'Recomputed NUC: ' + oneWayDerived);
  console.log('CHECK8 OK: one-way fare falls back to outbound-only scaling with a warning');

  // --- Fallback: 3 primary components ---
  const threeLeg = 'DUB EK COK 400.00QHAMPIE1/VFN2 EK X/DXB DUB 400.00UHEESIE1/VFN2 EK X/DXB LHR 400.00VHEESIE1/VFN2 NUC1200.00 ROE1.0';
  await setAdt(threeLeg);
  await enableAutoCalc('CNN_ADT');
  const threeLegModalVisible = await page.isVisible('#errorModal.show');
  console.log('3-leg fallback warning shown:', threeLegModalVisible);
  assert.ok(threeLegModalVisible, 'Expected a fallback warning for a 3-component string');
  await page.click('.modal-close-btn');
  console.log('CHECK9 OK: multi-leg (3-component) string falls back with a warning rather than guessing');

  // --- Custom tab cap still works with BUILT_IN_PTC_COUNT = 5 ---
  await page.click('#ptcTabADT');
  await page.waitForTimeout(80);
  await page.click('#ptcAddTabButton');
  await page.waitForTimeout(100);
  await page.fill('#ptcPromptInput', 'Group A');
  await page.click('#ptcPromptOkBtn');
  await page.waitForTimeout(100);
  await page.click('#ptcAddTabButton');
  await page.waitForTimeout(100);
  await page.fill('#ptcPromptInput', 'Group B');
  await page.click('#ptcPromptOkBtn');
  await page.waitForTimeout(100);
  const addButtonHidden = await page.isHidden('#ptcAddTabButton');
  assert.ok(addButtonHidden, 'Add-tab button should hide after 2 custom tabs even with 5 built-ins');
  const allTabs = await page.$$eval('.ptc-tabs .ptc-tab', els => els.map(e => e.getAttribute('data-ptc')));
  console.log('All tabs after adding 2 custom:', allTabs);
  assert.strictEqual(allTabs.length, 7, 'Expected 7 total tabs (5 built-in + 2 custom): ' + JSON.stringify(allTabs));
  console.log('CHECK10 OK: custom-tab cap correctly triggers at 2 even with 5 built-ins (BUILT_IN_PTC_COUNT refactor OK)');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK11 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
