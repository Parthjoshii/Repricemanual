const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  // Test directly against live styles.css (no injected styles)
  const evaluation = await page.evaluate(() => {
    function getAlign(inputId, cbId, lblSelector) {
      const inp = document.getElementById(inputId).getBoundingClientRect();
      const cb = document.getElementById(cbId).getBoundingClientRect();
      const lbl = document.querySelector(lblSelector).getBoundingClientRect();

      const inpCenter = inp.top + inp.height / 2;
      const cbCenter = cb.top + cb.height / 2;
      const lblCenter = lbl.top + lbl.height / 2;

      return {
        inp: { top: inp.top, height: inp.height, center: inpCenter },
        cb: { top: cb.top, height: cb.height, center: cbCenter },
        lbl: { top: lbl.top, height: lbl.height, center: lblCenter },
        offsetCbToInput: Math.abs(cbCenter - inpCenter),
        offsetTextToCb: Math.abs(lblCenter - cbCenter)
      };
    }

    return {
      fareDiff: getAlign('fareDiff', 'applyK3OnFareDiff', 'label[for="applyK3OnFareDiff"]'),
      changeFee: getAlign('changeFee', 'applyK3OnChangeFee', 'label[for="applyK3OnChangeFee"]')
    };
  });

  console.log('Evaluation Results on Live styles.css:');
  console.log(JSON.stringify(evaluation, null, 2));

  // Assertions
  const assert = require('assert');
  assert.strictEqual(evaluation.fareDiff.offsetCbToInput, 0, 'Fare Diff Checkbox must be 0px offset from input');
  assert.strictEqual(evaluation.fareDiff.offsetTextToCb, 0, 'Fare Diff Text must be 0px offset from checkbox');
  assert.strictEqual(evaluation.changeFee.offsetCbToInput, 0, 'Change Fee Checkbox must be 0px offset from input');
  assert.strictEqual(evaluation.changeFee.offsetTextToCb, 0, 'Change Fee Text must be 0px offset from checkbox');
  console.log('ALL DUAL-AXIS CENTERING ASSERTIONS PASSED WITH 0.00px OFFSET!');

  // Save screenshots for visual proof
  const artifactDir = path.resolve('C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/643cd18c-a97f-4475-80c9-0ad6e75f8e33');
  await page.screenshot({
    path: path.join(artifactDir, 'live_centering_light.png'),
    clip: { x: 500, y: 190, width: 750, height: 200 }
  });

  await page.click('#themeToggle');
  await page.waitForTimeout(60);
  await page.screenshot({
    path: path.join(artifactDir, 'live_centering_dark.png'),
    clip: { x: 500, y: 190, width: 750, height: 200 }
  });

  console.log('Screenshots saved: live_centering_light.png and live_centering_dark.png');
  await browser.close();
})();
