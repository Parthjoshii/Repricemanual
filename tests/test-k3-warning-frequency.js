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

  console.log('--- Test 1: Typing K3 triggers error modal once ---');
  let modalShowCount = 0;
  await page.exposeFunction('onModalShown', () => { modalShowCount++; });
  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.target.id === 'errorModal' && m.target.classList.contains('show')) {
          window.onModalShown();
        }
      });
    });
    observer.observe(document.getElementById('errorModal'), { attributes: true, attributeFilter: ['class'] });
  });

  // Type characters into oldTax ending with K3
  await page.type('#oldTax', 'INR4218K3', { delay: 50 });
  await page.waitForTimeout(350);

  assert.strictEqual(modalShowCount, 1, `Modal should have triggered exactly once on typing K3 (got ${modalShowCount})`);
  const msg = await page.textContent('#modalMessage');
  assert.ok(msg.includes('K3 tax should not be entered manually'), 'Modal message should warn about K3: ' + msg);
  console.log('✓ K3 modal triggered once:', msg);

  // Close modal
  await page.click('.modal-close-btn');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.isVisible('#errorModal.show'), false);

  // Type more into oldTax: slash and more taxes
  console.log('--- Test 2: Typing additional taxes does NOT re-trigger modal ---');
  await page.type('#oldTax', '/INR1348P2/INR130TP', { delay: 50 });
  await page.waitForTimeout(350);

  assert.strictEqual(modalShowCount, 1, `Modal count should remain 1 despite typing more with K3 present (got ${modalShowCount})`);
  console.log('✓ Modal was not re-triggered on typing additional taxes');

  // Type into newTax
  await page.type('#newTax', 'INR4271K3/INR1364P2/INR132TP', { delay: 50 });
  await page.waitForTimeout(350);

  assert.strictEqual(modalShowCount, 1, `Modal count should remain 1 when editing newTax (got ${modalShowCount})`);
  console.log('✓ Modal was not re-triggered when editing newTax');

  console.log('--- Test 3: Calculate taxes & Add Taxes preserves K3 when Fare Calculator has no K3 ---');
  await page.click('#taxCalcButton');
  await page.waitForTimeout(150);

  const posTaxes = await page.textContent('#taxResult .pos');
  const addTaxes = await page.inputValue('#addTaxes');
  console.log('Positive taxes in result:', posTaxes);
  console.log('Add taxes field:', addTaxes);

  assert.ok(posTaxes.includes('INR53K3') || posTaxes.includes('53K3'), 'Positive taxes should contain 53K3 difference: ' + posTaxes);
  assert.ok(addTaxes.includes('INR53K3') || addTaxes.includes('53K3'), 'Add taxes should retain 53K3 difference when Fare Calc has no K3: ' + addTaxes);
  console.log('✓ Add taxes retains K3 difference from tax inputs');

  console.log('--- Test 4: Clear taxes resets warning guard ---');
  await page.click('#taxClearButton');
  await page.waitForTimeout(100);

  await page.type('#oldTax', 'INR50K3', { delay: 50 });
  await page.waitForTimeout(350);

  assert.strictEqual(modalShowCount, 2, `Modal should trigger again after clearTaxes (got ${modalShowCount})`);
  console.log('✓ Modal guard properly reset on clear taxes');

  assert.strictEqual(errors.length, 0, 'Zero errors');
  await browser.close();
  console.log('ALL K3 FREQUENCY & ADD TAXES TESTS PASSED!');
})();
