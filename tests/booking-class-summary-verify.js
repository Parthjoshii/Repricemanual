const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const artifactDir = path.resolve('C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/1a69e0b2-33ac-4d8b-a578-b99b256dd4e6');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('Testing Outbound & Inbound Booking Class rendering in Summary Table...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => {
      const m = document.getElementById('errorModal');
      if (m) m.classList.remove('show');
    });
  }

  // 1. Enter Fare
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '199');
  await page.fill('#newFare', '288');
  await page.fill('#fareDiff', 'INR1999');
  await page.fill('#changeFee', 'INR3000');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(200);

  // 2. Open Parser and Enter Fare Calc String with Outbound 'TLEEPIN1' (T) and Inbound 'XWEEFIN1' (X)
  if (await page.$eval('#parserCollapsible', el => el.classList.contains('collapsed'))) {
    await page.click('#parserToggleBtn');
    await page.waitForTimeout(200);
  }

  const sampleFcs = 'BOM EK X/DXB EK NYC 102.21TLEEPIN1/NDC2 EK X/DXB BOM 404.56XWEEFIN1/NDC2 Q5.00 NUC511.77 ROE90.3344456';
  await page.fill('#fareCalcString', sampleFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(200);

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => {
      const m = document.getElementById('errorModal');
      if (m) m.classList.remove('show');
    });
  }

  // 3. Summarise
  await page.click('#summariseButton');
  await page.waitForTimeout(300);

  // Check top-left header cell
  const firstHeaderTh = await page.$eval('#summary table thead tr th:first-child', th => th.textContent.trim());
  console.log('Summary Table Top-Left Header:', firstHeaderTh);

  assert.strictEqual(firstHeaderTh, 'Booking class : Outbound T & Inbound X', 'Should format as Booking class : Outbound T & Inbound X');

  // Take screenshot of summary table
  const summarySection = await page.$('#summaryContent');
  if (summarySection) {
    const screenshotPath = path.join(artifactDir, 'summary_table_outbound_inbound_booking_class.png');
    await summarySection.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);
  }

  // 4. Test Single-Leg (One Way)
  const singleLegFcs = 'BOM EK DXB 102.21TLEEPIN1 NUC102.21 ROE90.00';
  await page.fill('#fareCalcString', singleLegFcs);
  await page.click('#parseButton');
  await page.waitForTimeout(200);
  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => {
      const m = document.getElementById('errorModal');
      if (m) m.classList.remove('show');
    });
  }
  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  const singleHeaderTh = await page.$eval('#summary table thead tr th:first-child', th => th.textContent.trim());
  console.log('Single leg Booking Class Header:', singleHeaderTh);
  assert.strictEqual(singleHeaderTh, 'Booking class : Outbound T', 'Should display Booking class : Outbound T');

  console.log('ALL OUTBOUND & INBOUND BOOKING CLASS TESTS PASSED 100%!');
  await browser.close();
})();
