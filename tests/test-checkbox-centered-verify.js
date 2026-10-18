const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  console.log('========================================================================');
  console.log('TESTING FARE DIFF & CHANGE FEE K3 CHECKBOX CENTERING ALIGNMENT');
  console.log('========================================================================');

  // Verify alignment across multiple desktop & laptop viewports
  for (const vpWidth of [1440, 1366, 1280, 1024]) {
    await page.setViewportSize({ width: vpWidth, height: 800 });
    await page.waitForTimeout(50);

    const alignment = await page.evaluate(() => {
      const fareDiff = document.getElementById('fareDiff').getBoundingClientRect();
      const chkFare = document.getElementById('applyK3OnFareDiff').getBoundingClientRect();
      const changeFee = document.getElementById('changeFee').getBoundingClientRect();
      const chkFee = document.getElementById('applyK3OnChangeFee').getBoundingClientRect();

      const fareCenter = fareDiff.top + fareDiff.height / 2;
      const chkFareCenter = chkFare.top + chkFare.height / 2;
      const feeCenter = changeFee.top + changeFee.height / 2;
      const chkFeeCenter = chkFee.top + chkFee.height / 2;

      return {
        fareCenter,
        chkFareCenter,
        diffFare: Math.abs(chkFareCenter - fareCenter),
        feeCenter,
        chkFeeCenter,
        diffFee: Math.abs(chkFeeCenter - feeCenter),
      };
    });

    console.log(`\nViewport: ${vpWidth}px`);
    console.log(`  Fare Diff Input Center: ${alignment.fareCenter.toFixed(1)}px | Checkbox Center: ${alignment.chkFareCenter.toFixed(1)}px | Offset: ${alignment.diffFare.toFixed(2)}px`);
    console.log(`  Change Fee Input Center: ${alignment.feeCenter.toFixed(1)}px | Checkbox Center: ${alignment.chkFeeCenter.toFixed(1)}px | Offset: ${alignment.diffFee.toFixed(2)}px`);

    assert.ok(alignment.diffFare <= 1.5, `Fare Diff checkbox must be vertically centered with input within 1.5px (offset: ${alignment.diffFare}px)`);
    assert.ok(alignment.diffFee <= 1.5, `Change Fee checkbox must be vertically centered with input within 1.5px (offset: ${alignment.diffFee}px)`);
  }

  // Visual screenshots in artifacts
  await page.setViewportSize({ width: 1280, height: 800 });
  const artifactDir = path.resolve('C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/643cd18c-a97f-4475-80c9-0ad6e75f8e33');
  
  await page.screenshot({
    path: path.join(artifactDir, 'checkbox_centered_comparison_light.png'),
    clip: { x: 490, y: 160, width: 770, height: 280 }
  });
  console.log('\n✓ Light mode centered screenshot saved to artifacts.');

  await page.click('#themeToggle');
  await page.waitForTimeout(60);
  await page.screenshot({
    path: path.join(artifactDir, 'checkbox_centered_comparison_dark.png'),
    clip: { x: 490, y: 160, width: 770, height: 280 }
  });
  console.log('✓ Dark mode centered screenshot saved to artifacts.');

  console.log('\n========================================================================');
  console.log('ALL CHECKBOX CENTERING ASSERTIONS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');

  await browser.close();
})();
