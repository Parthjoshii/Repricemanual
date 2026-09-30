const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

let browser;

(async () => {
  console.log('========================================================================');
  console.log('REALISTIC END-TO-END TEST: TST CREATION -> DEVTOOLS 1-CLICK FORM BRIDGE');
  console.log('========================================================================\n');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 920 },
    permissions: ['clipboard-read', 'clipboard-write']
  });

  const artifactDir = 'C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/1a69e0b2-33ac-4d8b-a578-b99b256dd4e6';

  // ===========================================================================
  // PHASE 1: TAB 1 - RE-PRICE MANUAL CALCULATOR (CREATE TST & FTA BRIDGE)
  // ===========================================================================
  console.log('--- PHASE 1: OPENING RE-PRICE CALCULATOR & CREATING TST ---');
  const pageCalc = await context.newPage();
  const calcUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await pageCalc.goto(calcUrl);
  await pageCalc.waitForLoadState('domcontentloaded');

  // Input calculation
  await pageCalc.selectOption('#currency', 'USD');
  await pageCalc.fill('#oldFare', '300');
  await pageCalc.fill('#newFare', '800');
  await pageCalc.click('#fareCalcButton');
  await pageCalc.waitForTimeout(100);

  // Multi-segment 4-flight FCS
  const multiFlightFcs = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC0END ROE0.855028';
  await pageCalc.fill('#fareCalcString', multiFlightFcs);
  await pageCalc.click('#parseButton');
  await pageCalc.waitForTimeout(100);

  await pageCalc.click('#summariseButton');
  await pageCalc.waitForTimeout(200);

  // Create TST
  await pageCalc.click('#createTstButton');
  await pageCalc.waitForTimeout(300);

  assert.ok(await pageCalc.isVisible('#tstSection'), 'TST Creator section must be visible');
  assert.ok(await pageCalc.isVisible('#ftaSection'), 'Fare Transfer Assistant section must be visible');
  console.log('✓ TST Creator and Fare Transfer Assistant successfully generated');

  // Capture Step 1 Screenshot
  const tstSectionEl = await pageCalc.$('#tstSection');
  if (tstSectionEl) {
    await tstSectionEl.screenshot({ path: path.join(artifactDir, 'step1_tst_created.png') });
    console.log('📷 Screenshot 1 saved: step1_tst_created.png');
  }

  // ===========================================================================
  // PHASE 2: PRE-TRANSFER SELECTIVE REVIEW & COPY BRIDGE CODE
  // ===========================================================================
  console.log('\n--- PHASE 2: OPENING PRE-TRANSFER REVIEW MODAL & COPYING BRIDGE SCRIPT ---');
  await pageCalc.click('#ftaOpenReviewModalBtn');
  await pageCalc.waitForTimeout(200);

  assert.ok(await pageCalc.isVisible('#ftaReviewModal'), 'Review modal must be visible');
  console.log('✓ Pre-Transfer Selective Review modal open');

  // Capture Step 2 Screenshot
  const modalBox = await pageCalc.$('#ftaReviewModal .fta-review-modal-box');
  if (modalBox) {
    await modalBox.screenshot({ path: path.join(artifactDir, 'step2_selective_review_modal.png') });
    console.log('📷 Screenshot 2 saved: step2_selective_review_modal.png');
  }

  // Click 1-Click Form Bridge Code button
  await pageCalc.click('#ftaCopyInjectorSnippetBtn');
  await pageCalc.waitForTimeout(150);

  // Retrieve snippet from clipboard
  const bridgeSnippet = await pageCalc.evaluate(() => navigator.clipboard.readText());
  assert.ok(bridgeSnippet.includes('FARE TRANSFER ASSISTANT (FTA) - UNIVERSAL FORM BRIDGE'), 'Clipboard must contain Form Bridge snippet');
  assert.ok(bridgeSnippet.includes('Object.getOwnPropertyDescriptor'), 'Snippet must include native prototype descriptor setter');
  assert.ok(bridgeSnippet.includes('QHAMPIE1'), 'Snippet must contain Coupon 1 Fare Basis');
  assert.ok(bridgeSnippet.includes('UHEESIE1'), 'Snippet must contain Coupon 3 Fare Basis');
  console.log(`✓ 1-Click Form Bridge snippet compiled and copied (${bridgeSnippet.length} bytes)`);

  // ===========================================================================
  // PHASE 3: TAB 2 - IN-HOUSE SERVICING APPLICATION (BEFORE INJECTION)
  // ===========================================================================
  console.log('\n--- PHASE 3: OPENING IN-HOUSE SERVICING APP (TARGET ENVIRONMENT) ---');
  const pageInhouse = await context.newPage();
  const inhouseUrl = 'file:///' + path.resolve(__dirname, 'mock-inhouse-tool.html').replace(/\\/g, '/');
  await pageInhouse.goto(inhouseUrl);
  await pageInhouse.waitForLoadState('domcontentloaded');

  // Verify all fields are initially empty
  const initialBase = await pageInhouse.inputValue('#txtBaseFare');
  const initialRoe = await pageInhouse.inputValue('#txtRoe');
  const initialFcs = await pageInhouse.inputValue('#txtFcs');
  const initialFb1 = await pageInhouse.locator('input[name="fb1_1"]').inputValue();
  assert.strictEqual(initialBase, '', 'Target Base Fare must initially be blank');
  assert.strictEqual(initialRoe, '', 'Target ROE must initially be blank');
  assert.strictEqual(initialFcs, '', 'Target FCS must initially be blank');
  assert.strictEqual(initialFb1, '', 'Target FB1 must initially be blank');
  console.log('✓ Target in-house application confirmed completely blank (AS-IS state)');

  // Capture Step 3 Screenshot (Before Injection)
  await pageInhouse.screenshot({ path: path.join(artifactDir, 'step3_inhouse_tool_before_injection.png') });
  console.log('📷 Screenshot 3 saved: step3_inhouse_tool_before_injection.png');

  // ===========================================================================
  // PHASE 4: EXECUTE 1-CLICK BRIDGE IN DEVTOOLS CONSOLE CONTEXT
  // ===========================================================================
  console.log('\n--- PHASE 4: EXECUTING 1-CLICK FORM BRIDGE SCRIPT IN DEVTOOLS CONSOLE ---');
  // Executing the copied IIFE in page context simulates the user pasting into DevTools Console
  await pageInhouse.evaluate(bridgeSnippet);
  await pageInhouse.waitForTimeout(300);

  // ===========================================================================
  // PHASE 5: VERIFY INJECTED VALUES & REACTIVE STORE SYNC
  // ===========================================================================
  console.log('\n--- PHASE 5: VERIFYING INJECTED VALUES & REACTIVE FRAMEWORK STATE ---');
  const injectedBase = await pageInhouse.inputValue('#txtBaseFare');
  const injectedEquiv = await pageInhouse.inputValue('#txtEquivFare');
  const injectedRoe = await pageInhouse.inputValue('#txtRoe');
  const injectedTotal = await pageInhouse.inputValue('#txtTotalAmount');
  const injectedOrgDest = await pageInhouse.inputValue('#txtOrgDest');
  const injectedFcs = await pageInhouse.inputValue('#txtFcs');
  const injectedFe = await pageInhouse.inputValue('#txtEndorsements');

  console.log('Injected Base Fare :', injectedBase);
  console.log('Injected Equiv Fare:', injectedEquiv);
  console.log('Injected ROE       :', injectedRoe);
  console.log('Injected Total     :', injectedTotal);
  console.log('Injected Org/Dest  :', injectedOrgDest);
  console.log('Injected FCS       :', injectedFcs.substring(0, 45) + '...');
  console.log('Injected FE        :', injectedFe);

  assert.strictEqual(injectedBase, 'USD800.00', 'Base Fare must match USD800.00');
  assert.strictEqual(injectedEquiv, 'USD800.00', 'Equivalent Fare must match USD800.00');
  assert.strictEqual(injectedRoe, '0.855028', 'ROE must match extracted ROE 0.855028');
  assert.strictEqual(injectedTotal, 'USD500.00', 'Total must match USD500.00');
  assert.strictEqual(injectedOrgDest, 'DUB/COK', 'Org/Dest must match DUB/COK');
  assert.ok(injectedFcs.includes('DUB EK X/DXB'), 'FCS must match linear string');
  assert.strictEqual(injectedFe, 'NON-REF/NON-CHANG/VALID ON ISSUING CARRIER ONLY', 'Endorsements must match FE');

  // Verify Coupon Fare Bases
  const fb1_1 = await pageInhouse.locator('input[name="fb1_1"]').inputValue();
  const fb2_1 = await pageInhouse.locator('input[name="fb2_1"]').inputValue();
  const fb1_2 = await pageInhouse.locator('input[name="fb1_2"]').inputValue();
  const fb2_2 = await pageInhouse.locator('input[name="fb2_2"]').inputValue();
  const fb1_3 = await pageInhouse.locator('input[name="fb1_3"]').inputValue();
  const fb2_3 = await pageInhouse.locator('input[name="fb2_3"]').inputValue();
  const fb1_4 = await pageInhouse.locator('input[name="fb1_4"]').inputValue();
  const fb2_4 = await pageInhouse.locator('input[name="fb2_4"]').inputValue();

  console.log(`Coupon 1: FB1=${fb1_1}, FB2=${fb2_1}`);
  console.log(`Coupon 2: FB1=${fb1_2}, FB2=${fb2_2}`);
  console.log(`Coupon 3: FB1=${fb1_3}, FB2=${fb2_3}`);
  console.log(`Coupon 4: FB1=${fb1_4}, FB2=${fb2_4}`);

  assert.strictEqual(fb1_1, 'QHAMPIE1', 'Coupon 1 FB1 must be QHAMPIE1');
  assert.strictEqual(fb2_1, 'VFN2', 'Coupon 1 FB2 must be VFN2');
  assert.strictEqual(fb1_2, 'QHAMPIE1', 'Coupon 2 FB1 must be QHAMPIE1');
  assert.strictEqual(fb2_2, 'VFN2', 'Coupon 2 FB2 must be VFN2');
  assert.strictEqual(fb1_3, 'UHEESIE1', 'Coupon 3 FB1 must be UHEESIE1');
  assert.strictEqual(fb2_3, 'VFN2', 'Coupon 3 FB2 must be VFN2');
  assert.strictEqual(fb1_4, 'UHEESIE1', 'Coupon 4 FB1 must be UHEESIE1');
  assert.strictEqual(fb2_4, 'VFN2', 'Coupon 4 FB2 must be VFN2');
  console.log('✓ All 4 Flight Coupon Fare Bases successfully injected into table rows');

  // Verify Reactive Store State
  const reactiveText = await pageInhouse.textContent('#reactiveStateSummary');
  console.log('Reactivity Monitor Text:', reactiveText);
  assert.ok(reactiveText.includes('DIRTY / UPDATED'), 'Form state must be updated to DIRTY/UPDATED');
  assert.ok(reactiveText.includes('Ready: YES (VALIDATED)'), 'Reactivity store must validate inputs as complete');
  console.log('✓ Reactive framework store successfully registered synthetic change events');

  // Verify Visual Badges
  const couponBadge = await pageInhouse.textContent('#couponGridStatus');
  const fareBadge = await pageInhouse.textContent('#fareSectionStatus');
  console.log('Coupon Status Badge:', couponBadge);
  console.log('Fare Status Badge  :', fareBadge);
  assert.ok(couponBadge.includes('Fare Bases Loaded'), 'Coupon badge must show loaded');
  assert.ok(fareBadge.includes('Validated'), 'Fare badge must show validated');

  // Capture Step 4 Screenshot (After Injection)
  await pageInhouse.screenshot({ path: path.join(artifactDir, 'step4_inhouse_tool_after_injection.png') });
  console.log('📷 Screenshot 4 saved: step4_inhouse_tool_after_injection.png');

  // Test Save button
  let alertFired = false;
  pageInhouse.on('dialog', async dialog => {
    console.log(`Dialog message: "${dialog.message()}"`);
    assert.ok(dialog.message().includes('Success'), 'Save dialog must indicate success');
    alertFired = true;
    await dialog.accept();
  });
  await pageInhouse.click('#btnValidateSave');
  await pageInhouse.waitForTimeout(200);
  assert.ok(alertFired, 'Save button must trigger successful submission');
  console.log('✓ Exchange form successfully validated and submitted');

  await browser.close();
  console.log('\n========================================================================');
  console.log('REALISTIC END-TO-END DEVTOOLS BRIDGE TEST PASSED 100%!');
  console.log('========================================================================');
  process.exit(0);
})().catch(async err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  if (browser) await browser.close();
  process.exit(1);
});
