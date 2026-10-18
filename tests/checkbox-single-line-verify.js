const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  const viewports = [
    { name: 'Desktop (1440px)', width: 1440, height: 900 },
    { name: 'Laptop (1366px)', width: 1366, height: 768 },
    { name: 'Laptop (1280px)', width: 1280, height: 800 },
    { name: 'Tablet (1024px)', width: 1024, height: 768 },
    { name: 'Mobile (768px)', width: 768, height: 1024 },
    { name: 'Mobile (375px)', width: 375, height: 667 },
  ];

  console.log('========================================================================');
  console.log('VERIFYING YQ / K3 TRIGGER CHECKBOXES ARE RENDERED IN ONE SINGLE LINE');
  console.log('========================================================================');

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(50);

    const results = await page.evaluate(() => {
      const ids = ['applyK3OnYQ', 'applyK3OnFareDiff', 'applyK3OnChangeFee'];
      return ids.map(id => {
        const input = document.getElementById(id);
        const label = document.querySelector(`label[for="${id}"]`);
        const height = label ? label.offsetHeight : 0;
        const width = label ? label.offsetWidth : 0;
        const scrollW = label ? label.scrollWidth : 0;
        const computedFont = label ? window.getComputedStyle(label).fontSize : '';
        const whiteSpace = label ? window.getComputedStyle(label).whiteSpace : '';
        const isSingleLine = height > 0 && height <= 20;

        return {
          id,
          text: label ? label.innerText.trim() : '',
          height,
          width,
          scrollW,
          computedFont,
          whiteSpace,
          isSingleLine
        };
      });
    });

    console.log(`\nViewport: ${vp.name}`);
    for (const res of results) {
      assert.strictEqual(res.isSingleLine, true, `Checkbox label for ${res.id} must be single line (h <= 20px, got ${res.height}px) at ${vp.name}`);
      assert.strictEqual(res.whiteSpace, 'nowrap', `Checkbox label for ${res.id} must have whiteSpace: nowrap`);
      console.log(`  ✓ [${res.id}]: "${res.text}" -> height=${res.height}px, font=${res.computedFont}, nowrap (Single Line OK)`);
    }
  }

  // Visual snapshot at 1280px (Light and Dark)
  await page.setViewportSize({ width: 1280, height: 800 });
  const artifactDir = path.resolve('C:/Users/Parth Joshi/.gemini/antigravity-ide/brain/643cd18c-a97f-4475-80c9-0ad6e75f8e33');
  
  await page.screenshot({
    path: path.join(artifactDir, 'checkboxes_single_line_light.png'),
    clip: { x: 0, y: 160, width: 1280, height: 350 }
  });
  console.log('\n✓ Light mode screenshot saved to artifacts.');

  await page.click('#themeToggle');
  await page.waitForTimeout(60);
  await page.screenshot({
    path: path.join(artifactDir, 'checkboxes_single_line_dark.png'),
    clip: { x: 0, y: 160, width: 1280, height: 350 }
  });
  console.log('✓ Dark mode screenshot saved to artifacts.');

  console.log('\n========================================================================');
  console.log('ALL CHECKBOX SINGLE LINE ASSERTIONS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');

  await browser.close();
})();
