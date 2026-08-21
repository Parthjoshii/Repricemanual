const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

(async () => {
  console.log('Testing Tax Calculation with Multi-Space/Column/Tab Separated Inputs...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  if (await page.isVisible('#errorModal.show')) {
    await page.evaluate(() => closeErrorModal());
  }

  // Exact OLD TAX from user image
  const oldTaxString = 'MUR12840YQ/MUR986AE/MUR1316F6/MUR546IN/MUR49JE/MUR1000MU/MUR1121OV/MUR684P2/MUR66TP/MUR198ZR/MUR10006A/MUR1506X';
  
  // Exact NEW TAX from user image (spaced and multi-line, copied directly from GDS)
  const newTaxString = `MUR12840YQ   MUR986AE      MUR1316F6
   MUR546IN      MUR49JE      MUR1000MU
   MUR1121OV     MUR684P2     MUR66TP
   MUR198ZR      MUR10006A    MUR1506X`;

  console.log('--- Step 1: Input Old Tax (slash formatted) and New Tax (spaced/multiline) ---');
  await page.fill('#oldTax', oldTaxString);
  await page.fill('#newTax', newTaxString);
  await page.waitForTimeout(400); // Live debounced calculation

  // Check Tax Results
  const posTaxes = await page.$eval('#taxResult .pos', el => el.textContent.trim());
  const negTaxes = await page.$eval('#taxResult .neg', el => el.textContent.trim());
  const netTaxAdj = await page.inputValue('#taxAdj');
  const addTaxes = await page.inputValue('#addTaxes');
  const refundTaxes = await page.inputValue('#refundTaxes');

  console.log('Positive Taxes Text:', posTaxes);
  console.log('Negative Taxes Text:', negTaxes);
  console.log('Net Tax Adj:', netTaxAdj);
  console.log('Add Taxes:', addTaxes);
  console.log('Refund Taxes:', refundTaxes);

  // When all 12 taxes match, diff should be MUR0.00, NOT negative -19956!
  assert.strictEqual(posTaxes, 'MUR0.00', 'Positive taxes should be MUR0.00');
  assert.strictEqual(negTaxes, 'None', 'Negative taxes should be None when taxes match');
  assert.strictEqual(netTaxAdj, 'MUR0.00', 'Net Tax Adj should be MUR0.00');
  assert.strictEqual(refundTaxes, '', 'Refund taxes should be empty when taxes match');

  console.log('--- Step 2: Partial/Changed Taxes with Tabs, Multi-spaces ---');
  // New tax with a +500 increase on YQ and -49 drop on JE
  const modifiedNewTax = `MUR13340YQ\t\tMUR986AE    MUR1316F6
MUR546IN        MUR1000MU   MUR1121OV
MUR684P2        MUR66TP     MUR198ZR
MUR10006A       MUR1506X`;

  await page.fill('#newTax', modifiedNewTax);
  await page.waitForTimeout(400);

  const posTaxes2 = await page.$eval('#taxResult .pos', el => el.textContent.trim());
  const negTaxes2 = await page.$eval('#taxResult .neg', el => el.textContent.trim());
  const netTaxAdj2 = await page.inputValue('#taxAdj');
  const addTaxes2 = await page.inputValue('#addTaxes');
  const refundTaxes2 = await page.inputValue('#refundTaxes');

  console.log('Modified Positive Taxes:', posTaxes2);
  console.log('Modified Negative Taxes:', negTaxes2);
  console.log('Modified Net Tax Adj:', netTaxAdj2);
  console.log('Modified Add Taxes:', addTaxes2);
  console.log('Modified Refund Taxes:', refundTaxes2);

  assert.strictEqual(posTaxes2, 'MUR500.00YQ', 'Should accurately detect +MUR500YQ increase');
  assert.strictEqual(negTaxes2, '-MUR49.00JE', 'Should accurately detect -MUR49JE drop');
  assert.strictEqual(netTaxAdj2, 'MUR451.00', 'Net Tax Adj should be MUR451.00 (500 - 49)');
  assert.strictEqual(addTaxes2, 'MUR500.00YQ', 'Add taxes should contain MUR500.00YQ');
  assert.strictEqual(refundTaxes2, '-MUR49.00JE', 'Refund taxes should contain -MUR49.00JE');

  console.log('\nALL SPACE/TAB/MULTILINE TAX PARSING TESTS PASSED 100%!');
  await browser.close();
})();
