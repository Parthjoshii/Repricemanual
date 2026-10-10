const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  // 1. Enter taxes in light mode to show high contrast colors
  await page.fill('#oldTax', 'INR4855YQ/INR7330YQ/INR1944AE/INR2592F6/INR330GR/INR1033IN/INR4218K3/INR1348P2/INR130TP/INR3813WP/INR899WQ/INR87ZL/INR390ZR');
  if (await page.isVisible('#errorModal.show')) {
    await page.click('.modal-close-btn');
    await page.waitForTimeout(100);
  }

  await page.fill('#newTax', 'INR1967AE/INR2624F6/INR324GR/INR726IN/INR4271K3/INR1364P2/INR307PN/INR132TP/INR3739WP/INR881WQ/INR24656YQ/INR86ZL/INR396ZR');
  if (await page.isVisible('#errorModal.show')) {
    await page.click('.modal-close-btn');
    await page.waitForTimeout(100);
  }

  await page.click('#taxCalcButton');
  await page.waitForTimeout(200);

  // Enter round trip string and halve it
  const rtString = 'DUB EK X/DXB EK COK Q DUBCOK58.47Q DUBCOK18.82 470.74QHAMPIE1/VFN2 EK X/DXB EK DUB Q COKDUB58.47Q COKDUB23.41 585.36UHEESIE1/VFN2 NUC0END ROE0.855028';
  await page.fill('#fareCalcString', rtString);
  await page.click('#halveFareComponents');
  await page.waitForTimeout(200);

  // Screenshot light mode full page
  await page.screenshot({ path: path.resolve(__dirname, '../light-mode-preview-updated.png') });
  console.log('Saved light-mode-preview-updated.png');

  // Toggle to dark mode
  await page.click('#themeToggle');
  await page.waitForTimeout(450);

  // Screenshot dark mode full page
  await page.screenshot({ path: path.resolve(__dirname, '../dark-mode-preview-updated.png') });
  console.log('Saved dark-mode-preview-updated.png');

  await browser.close();
  console.log('Visual artifacts generated successfully!');
})();
