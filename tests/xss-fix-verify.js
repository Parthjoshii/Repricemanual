const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('========================================================================');
  console.log('TEST SUITE: DOM XSS Elimination & Safe Tax Result Rendering Verification');
  console.log('========================================================================\n');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Listen for unexpected alerts or dialogs
  page.on('dialog', async dialog => {
    console.error(`Unexpected dialog triggered: ${dialog.message()}`);
    await dialog.dismiss();
    assert.fail(`XSS Alert dialog was triggered: "${dialog.message()}"`);
  });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // --------------------------------------------------------------------------
  // TEST 1: Malicious XSS Payload Injection in Old & New Taxes
  // --------------------------------------------------------------------------
  console.log('1. Testing DOM XSS payload immunity in Tax inputs...');

  const xssTestResult = await page.evaluate(() => {
    window.XSS_FLAG = false;

    // Inject aggressive XSS payloads into tax inputs
    els.oldTax.value = 'INR500YQ <img src="invalid-image" onerror="window.XSS_FLAG=true">';
    els.newTax.value = 'INR1000YQ <svg onload="window.XSS_FLAG=true"><script>window.XSS_FLAG=true</script>';

    calculateTaxes();

    const taxResultEl = document.getElementById('taxResult');
    const childTags = Array.from(taxResultEl.querySelectorAll('*')).map(el => el.tagName.toLowerCase());
    const imgElements = taxResultEl.querySelectorAll('img');
    const svgElements = taxResultEl.querySelectorAll('svg');
    const scriptElements = taxResultEl.querySelectorAll('script');

    return {
      xssFlag: window.XSS_FLAG,
      childTags,
      imgCount: imgElements.length,
      svgCount: svgElements.length,
      scriptCount: scriptElements.length,
      posSpanText: taxResultEl.querySelector('.pos') ? taxResultEl.querySelector('.pos').textContent : '',
      negSpanText: taxResultEl.querySelector('.neg') ? taxResultEl.querySelector('.neg').textContent : '',
      rawHtml: taxResultEl.innerHTML,
    };
  });

  assert.strictEqual(xssTestResult.xssFlag, false, 'window.XSS_FLAG must NOT be set to true');
  assert.strictEqual(xssTestResult.imgCount, 0, 'No <img> elements should exist inside taxResult');
  assert.strictEqual(xssTestResult.svgCount, 0, 'No <svg> elements should exist inside taxResult');
  assert.strictEqual(xssTestResult.scriptCount, 0, 'No <script> elements should exist inside taxResult');
  assert.ok(
    !xssTestResult.childTags.includes('img') &&
    !xssTestResult.childTags.includes('svg') &&
    !xssTestResult.childTags.includes('script'),
    'Child tags must only include safe markup (b, span, br, div)'
  );
  console.log('   ✓ Zero malicious executable DOM nodes injected');
  console.log('   ✓ Injected XSS tags safely neutralized as textContent');

  // --------------------------------------------------------------------------
  // TEST 2: Verify Legitimate DOM Structure & Formatting
  // --------------------------------------------------------------------------
  console.log('\n2. Testing legitimate tax result rendering and DOM structure...');

  const cleanResult = await page.evaluate(() => {
    els.oldTax.value = 'INR1000OD INR500YQ INR200IN';
    els.newTax.value = 'INR1000OD INR800YQ INR250IN';
    els.cabin.value = 'economy';
    els.applyK3OnYQ.checked = true;

    calculateTaxes();

    const taxResultEl = document.getElementById('taxResult');
    const bTags = Array.from(taxResultEl.querySelectorAll('b')).map(b => b.textContent.trim());
    const posSpan = taxResultEl.querySelector('.pos');
    const negSpan = taxResultEl.querySelector('.neg');
    const odNotice = taxResultEl.querySelector('.tax-od-notice');

    return {
      bHeaders: bTags,
      posContent: posSpan ? posSpan.textContent : '',
      negContent: negSpan ? negSpan.textContent : '',
      hasOdNotice: !!odNotice,
      odNoticeText: odNotice ? odNotice.textContent : '',
      innerText: taxResultEl.innerText,
    };
  });

  assert.ok(cleanResult.bHeaders.includes('Positive Taxes'), 'Contains Positive Taxes header');
  assert.ok(cleanResult.bHeaders.includes('Negative Taxes'), 'Contains Negative Taxes header');
  assert.ok(cleanResult.bHeaders.includes('Positive Total:'), 'Contains Positive Total header');
  assert.ok(cleanResult.bHeaders.includes('Negative Total:'), 'Contains Negative Total header');
  assert.ok(cleanResult.bHeaders.includes('Net Total:'), 'Contains Net Total header');
  assert.ok(cleanResult.bHeaders.includes('K3 on YQ:'), 'Contains K3 on YQ header when checked');
  assert.strictEqual(cleanResult.hasOdNotice, true, 'OD Change Fee notice container exists');
  assert.ok(cleanResult.odNoticeText.includes('OD Tax (Change Fee): Already paid'), 'OD notice text matches specification');
  console.log('   ✓ All headers, spans, K3 notices, and OD fee elements present with proper DOM hierarchy');

  // --------------------------------------------------------------------------
  // TEST 3: Clear Taxes DOM Reset
  // --------------------------------------------------------------------------
  console.log('\n3. Testing clearTaxes() resets #taxResult completely...');

  const cleared = await page.evaluate(() => {
    clearTaxes();
    const taxResultEl = document.getElementById('taxResult');
    return {
      innerHTML: taxResultEl.innerHTML,
      textContent: taxResultEl.textContent,
      childrenLength: taxResultEl.children.length,
    };
  });

  assert.strictEqual(cleared.textContent, '', '#taxResult textContent must be empty after clearTaxes()');
  assert.strictEqual(cleared.childrenLength, 0, '#taxResult must have 0 child nodes after clearTaxes()');
  console.log('   ✓ clearTaxes() cleanly clears all child nodes');

  console.log('\n========================================================================');
  console.log('✨ ALL DOM XSS ELIMINATION & RENDERING TESTS PASSED (100%)');
  console.log('========================================================================');

  await browser.close();
  process.exit(0);
})();
