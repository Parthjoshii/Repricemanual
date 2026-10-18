const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('--- STARTING BASE FARE PROMPT / POP-UP VERIFICATION ---');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  async function getPseudoStyle(selector, pseudo, property) {
    return page.evaluate(({ sel, ps, prop }) => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el, ps).getPropertyValue(prop) : null;
    }, { sel: selector, ps: pseudo, prop: property });
  }

  // 1. Verify that parserResults is initially hidden
  assert.strictEqual(await page.isVisible('#parserResults'), false, 'Parser results should initially be hidden');

  // 2. Parse a fare calculation string to display Base Fare
  console.log('\n[TEST 1] Parsing Fare Calc String and Verifying Base Fare Prompt DOM & Visibility...');
  await page.fill('#fareCalcString', 'BOM EK DXB Q DXB50.00 300.00TLEEPIN1/NDC2 NUC350.00 ROE1.5');
  await page.click('#parseButton');
  await page.waitForTimeout(100);

  assert.strictEqual(await page.isVisible('#parserResults'), true, 'Parser results must be visible');
  const baseFareText = (await page.textContent('#baseFare')).trim();
  console.log('  Base Fare displayed:', baseFareText);
  assert.strictEqual(baseFareText, '525.00', 'Base Fare should be 525.00');

  const isPromptVisible = await page.isVisible('#baseFareRoundPrompt');
  console.log('  Is Base Fare prompt visible:', isPromptVisible);
  assert.strictEqual(isPromptVisible, true, 'Base Fare prompt must be visible next to base fare');

  // 3. Verify Prompt ARIA attributes & copy
  console.log('\n[TEST 2] Verifying ARIA & data-tooltip contents...');
  const promptAriaLabel = await page.getAttribute('#baseFareRoundPrompt', 'aria-label');
  const promptTooltip = await page.getAttribute('#baseFareRoundPrompt', 'data-tooltip');
  const promptText = (await page.textContent('#baseFareRoundPrompt')).trim();
  console.log('  Prompt Aria Label:', promptAriaLabel);
  console.log('  Prompt Text:', promptText);
  console.log('  Prompt data-tooltip:', promptTooltip);

  assert.ok(promptAriaLabel && promptAriaLabel.includes('Check round off on ResConnect'), 'aria-label should specify round off check on ResConnect');
  assert.strictEqual(promptText, 'Check Round Off on ResConnect', 'Prompt text pill should show "Check Round Off on ResConnect"');
  assert.strictEqual(promptTooltip, 'The calculated Base Fare (NUC × ROE) is a raw conversion. Check via ResConnect for correct Currency Rounding Rule & update the fare.', 'data-tooltip should contain the exact ResConnect statement');

  // 4. Test Hover Tooltip / Pop-up display
  console.log('\n[TEST 3] Verifying Hover Tooltip Pop-up Visibility...');
  await page.hover('#baseFareRoundPrompt');
  await page.waitForTimeout(200);

  const hoverOpacity = await getPseudoStyle('#baseFareRoundPrompt', '::after', 'opacity');
  const hoverVisibility = await getPseudoStyle('#baseFareRoundPrompt', '::after', 'visibility');
  console.log(`  Hover state: opacity=${hoverOpacity}, visibility=${hoverVisibility}`);
  assert.strictEqual(hoverOpacity, '1', 'Pop-up must be visible on hover');
  assert.strictEqual(hoverVisibility, 'visible', 'Pop-up visibility must be visible on hover');

  // Move mouse away
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  const outOpacity = await getPseudoStyle('#baseFareRoundPrompt', '::after', 'opacity');
  assert.strictEqual(outOpacity, '0', 'Pop-up must hide when pointer moves away');

  // 5. Test Click Toggle & Outside Click & Escape Dismissal
  console.log('\n[TEST 4] Verifying Click Toggle, Escape key & Outside Click...');
  await page.click('#baseFareRoundPrompt');
  await page.waitForTimeout(250);
  let isActive = await page.evaluate(() => document.querySelector('#baseFareRoundPrompt').classList.contains('active'));
  console.log('  Is prompt .active on click:', isActive);
  assert.strictEqual(isActive, true, 'Prompt should gain .active class on click');

  const activeOpacity = await getPseudoStyle('#baseFareRoundPrompt', '::after', 'opacity');
  assert.strictEqual(activeOpacity, '1', 'Pop-up must remain open when .active');

  // Press Escape to dismiss
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  isActive = await page.evaluate(() => document.querySelector('#baseFareRoundPrompt').classList.contains('active'));
  console.log('  Is prompt .active after Escape:', isActive);
  assert.strictEqual(isActive, false, 'Prompt should lose .active class on Escape');

  // Re-open with Enter key on focus
  await page.focus('#baseFareRoundPrompt');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  isActive = await page.evaluate(() => document.querySelector('#baseFareRoundPrompt').classList.contains('active'));
  assert.strictEqual(isActive, true, 'Prompt should toggle .active on Enter key');

  // Outside click to dismiss
  await page.click('h1');
  await page.waitForTimeout(100);
  isActive = await page.evaluate(() => document.querySelector('#baseFareRoundPrompt').classList.contains('active'));
  assert.strictEqual(isActive, false, 'Prompt should lose .active on outside click');

  // 6. Test Currency Context Statement Consistency
  console.log('\n[TEST 5] Verifying Tooltip Statement Consistency across Currencies...');
  await page.selectOption('#currency', 'INR');
  await page.waitForTimeout(150);
  const inrTooltip = await page.getAttribute('#baseFareRoundPrompt', 'data-tooltip');
  console.log('  INR data-tooltip:', inrTooltip);
  assert.strictEqual(inrTooltip, 'The calculated Base Fare (NUC × ROE) is a raw conversion. Check via ResConnect for correct Currency Rounding Rule & update the fare.');

  await page.selectOption('#currency', 'AED');
  await page.waitForTimeout(150);
  const aedTooltip = await page.getAttribute('#baseFareRoundPrompt', 'data-tooltip');
  console.log('  AED data-tooltip:', aedTooltip);
  assert.strictEqual(aedTooltip, 'The calculated Base Fare (NUC × ROE) is a raw conversion. Check via ResConnect for correct Currency Rounding Rule & update the fare.');

  // 7. Test Light Mode Styling & Screenshots
  console.log('\n[TEST 6] Capturing Visual Verification Screenshots...');
  const artifactDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  // Re-parse with user example string
  await page.evaluate(() => {
    document.querySelector('#currency').value = '';
    document.querySelector('#currency').dispatchEvent(new Event('change'));
  });
  await page.fill('#fareCalcString', 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM Q5.00 404.56XWEEFIN1/NDC2 NUC511.77 ROE2.0303847');
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  const calculatedBaseFare = (await page.textContent('#baseFare')).trim();
  console.log('  Base Fare for test string:', calculatedBaseFare);
  assert.strictEqual(calculatedBaseFare, '1039.09', 'Base Fare should match the user screenshot 1039.09');

  // Take screenshot with pop-up active
  await page.click('#baseFareRoundPrompt');
  await page.waitForTimeout(250);
  const parserResultsEl = await page.$('#parserResults');
  await parserResultsEl.screenshot({ path: path.join(artifactDir, 'base-fare-popup-light.png') });

  // Toggle to dark mode and screenshot
  await page.click('#themeToggle');
  await page.waitForTimeout(300);
  await page.click('#baseFareRoundPrompt');
  await page.waitForTimeout(250);
  await parserResultsEl.screenshot({ path: path.join(artifactDir, 'base-fare-popup-dark.png') });

  console.log('  ✓ Screenshots saved to artifacts/');

  // 8. Test Clear Parser
  console.log('\n[TEST 7] Verifying Clear Parser...');
  await page.click('#parserClearButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isVisible('#parserResults'), false, 'Parser results should be hidden after clear');
  isActive = await page.evaluate(() => document.querySelector('#baseFareRoundPrompt').classList.contains('active'));
  assert.strictEqual(isActive, false, 'Prompt should not be active after clear');

  assert.strictEqual(errors.length, 0, `Zero errors expected, found: ${errors.join(', ')}`);
  console.log('\n--- ALL BASE FARE PROMPT / POP-UP CHECKS PASSED SUCCESSFULLY! ---');
  await browser.close();
})();
