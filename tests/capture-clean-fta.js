const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  const filePath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  console.log('Navigating to:', filePath);
  await page.goto(filePath);
  await page.waitForLoadState('domcontentloaded');

  // Input calculation
  await page.selectOption('#currency', 'USD');
  await page.fill('#oldFare', '300');
  await page.fill('#newFare', '800');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(100);

  const fcs = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC0END ROE0.855028';
  await page.fill('#fareCalcString', fcs);
  await page.click('#parseButton');
  await page.waitForTimeout(100);

  await page.click('#summariseButton');
  await page.waitForTimeout(200);

  await page.click('#createTstButton');
  await page.waitForTimeout(300);

  const artifactDir = 'C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/1a69e0b2-33ac-4d8b-a578-b99b256dd4e6';

  // Take screenshot of FTA container inside TST Creator
  const ftaSection = await page.$('#ftaSection');
  if (ftaSection) {
    await ftaSection.screenshot({ path: path.join(artifactDir, 'clean_fta_container.png') });
    console.log('Saved clean_fta_container.png');
  }

  // Open review modal
  await page.click('#ftaOpenReviewModalBtn');
  await page.waitForTimeout(200);

  const reviewModal = await page.$('#ftaReviewModal .fta-review-modal-box');
  if (reviewModal) {
    await reviewModal.screenshot({ path: path.join(artifactDir, 'clean_fta_review_modal.png') });
    console.log('Saved clean_fta_review_modal.png');
  }

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // Full screenshot of TST creator
  const tstSection = await page.$('#tstSection');
  if (tstSection) {
    await tstSection.screenshot({ path: path.join(artifactDir, 'clean_tst_creator_section.png') });
    console.log('Saved clean_tst_creator_section.png');
  }

  await browser.close();
  console.log('Screenshot capture complete!');
})();
