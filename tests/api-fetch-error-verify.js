const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Abort request to er-api to simulate network failure
  await page.route('https://open.er-api.com/**', route => route.abort());

  await page.goto(fileUrl);
  await page.waitForSelector('#errorModal.show', { timeout: 4000 });

  const modalText = await page.textContent('#modalMessage');
  console.log('Modal text displayed on API failure:', modalText);

  assert.ok(modalText.includes('Live exchange rate fetch failed'), 'Error modal should alert user about live rate fetch failure');
  assert.ok(modalText.includes('Pre-loaded baseline rates are active'), 'Error modal should mention baseline rates');

  // Close modal and verify app remains completely usable
  await page.click('#errorModal .modal-close-btn');
  await page.waitForSelector('#errorModal', { state: 'attached' });
  const hasShowClass = await page.$eval('#errorModal', el => el.classList.contains('show'));
  assert.strictEqual(hasShowClass, false, 'Modal should close on button click');

  console.log('API failure notification test passed successfully!');
  await browser.close();
})();
