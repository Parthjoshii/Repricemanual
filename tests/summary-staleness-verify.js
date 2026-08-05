const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

let browser;
(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  const fcsRowText = async () => {
    return page.$$eval('#summary tbody tr', trs => {
      const row = trs.find(tr => tr.cells[0].textContent.includes('Fare Calculation String'));
      return row ? row.cells[1].textContent : null;
    });
  };

  // --- Bug 1: calculate fare, convert string A, Summarise, then re-convert string B, Summarise again ---
  await page.selectOption('#currency', 'EUR');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '2000');
  await page.fill('#newFare', '3888');
  await page.fill('#changeFee', '1299');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  const stringA = 'BOM EK DXB 2000.00TLEEPIN1/NDC2 NUC2000.00 ROE1.0';
  await page.fill('#fareCalcString', stringA);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const row1 = await fcsRowText();
  console.log('FCS row after first Summarise:', row1);
  assert.strictEqual(row1, stringA, 'Summary should show the first converted string');

  const stringB = 'BOM EK DXB 2000.00TLEEPIN2/NDC3 NUC2000.00 ROE1.0';
  await page.fill('#fareCalcString', stringB);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const row2 = await fcsRowText();
  console.log('FCS row after re-convert + second Summarise:', row2);
  assert.strictEqual(row2, stringB, 'Summary should show the UPDATED string, not the stale first one');
  console.log('CHECK1 OK: re-converting the fare calc string after an initial Summarise now updates the summary table');

  // --- Bug 1 reverse order: convert BEFORE calculating fare at all (fresh PTC tab) ---
  await page.click('#ptcTabCNN');
  await page.waitForTimeout(100);
  const stringC = 'BOM EK DXB 500.00TLEEPIN1/NDC2 NUC500.00 ROE1.0';
  await page.fill('#fareCalcString', stringC);
  await page.click('#parseButton');
  await page.waitForTimeout(150);

  await page.selectOption('#currency', 'EUR');
  await page.selectOption('#cabin', 'economy');
  await page.fill('#oldFare', '500');
  await page.fill('#newFare', '550');
  await page.click('#fareCalcButton');
  await page.waitForTimeout(150);

  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  // Both ADT and CNN now have data, so the summary is multi-PTC (a separate "Fare Calculation
  // String <Label>" row per PTC) rather than one generic row — look up CNN's ("Child") row.
  const row3 = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent === 'Fare Calculation String Child');
    return row ? row.cells[1].textContent : null;
  });
  console.log('FCS row (convert-before-calculate order, CNN tab):', row3);
  assert.strictEqual(row3, stringC, 'Convert-then-calculate order should also show the correct string');
  console.log('CHECK2 OK: convert-before-calculate order also works (no regression)');

  // Clear CNN's data so the K3 test below runs in a clean single-PTC (ADT-only) state, avoiding
  // the multi-PTC breakdown/GDS format from complicating the arithmetic assertions below.
  await page.click('#fareClearButton');
  await page.waitForTimeout(100);
  await page.click('#ptcTabADT');
  await page.waitForTimeout(100);

  // --- Bug 2: toggle K3 on change fee, check both table and GDS string ---
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const gdsBeforeK3 = await page.inputValue('#gdsString');
  console.log('GDS string before K3 toggle:', gdsBeforeK3);
  assert.ok(gdsBeforeK3.includes('CHG FEE EUR1299'), 'Expected base change fee before K3: ' + gdsBeforeK3);

  await page.check('#applyK3OnChangeFee');
  await page.waitForTimeout(400); // debounced recalculation
  await page.click('#summariseButton');
  await page.waitForTimeout(150);

  const changeFeeRow = await page.$$eval('#summary tbody tr', trs => {
    const row = trs.find(tr => tr.cells[0].textContent.includes('Change Fee'));
    return row ? row.cells[1].textContent : null;
  });
  const gdsAfterK3 = await page.inputValue('#gdsString');
  console.log('Change Fee row after K3 ON:', changeFeeRow);
  console.log('GDS string after K3 ON:', gdsAfterK3);

  assert.ok(changeFeeRow.includes('incl. K3'), 'Table Change Fee row should show K3-inclusive amount: ' + changeFeeRow);
  const tableFeeMatch = changeFeeRow.match(/EUR([\d.]+) \(incl\. K3 EUR([\d.]+)\)/);
  assert.ok(tableFeeMatch, 'Could not parse table Change Fee value: ' + changeFeeRow);
  const tableFeeTotal = tableFeeMatch[1];

  assert.ok(gdsAfterK3.includes(`CHG FEE EUR${tableFeeTotal}`), `GDS CHG FEE should match table's K3-inclusive total (EUR${tableFeeTotal}): ${gdsAfterK3}`);
  console.log('CHECK3 OK: GDS String now matches the Summary Table\'s K3-inclusive Change Fee amount');

  // Confirm the GDS line items actually sum to its own trailing total
  const gdsNums = gdsAfterK3.match(/FARE DIFF EUR([\d.-]+) \+ CHG FEE EUR([\d.]+) [+-] TAX EUR([\d.]+) = EUR([\d.]+)/);
  assert.ok(gdsNums, 'Could not parse GDS line for arithmetic check: ' + gdsAfterK3);
  const [, diff, chgFee, tax, total] = gdsNums.map(Number).length ? gdsNums : [];
  const diffN = parseFloat(gdsNums[1]);
  const chgFeeN = parseFloat(gdsNums[2]);
  const taxSign = gdsAfterK3.includes('- TAX') ? -1 : 1;
  const taxN = parseFloat(gdsNums[3]) * taxSign;
  const totalN = parseFloat(gdsNums[4]);
  const computed = diffN + chgFeeN + taxN;
  console.log(`GDS arithmetic: ${diffN} + ${chgFeeN} + (${taxN}) = ${computed} (line total shown: ${totalN})`);
  assert.ok(Math.abs(computed - totalN) < 0.01, `GDS line items should sum to the trailing total: ${computed} vs ${totalN}`);
  console.log('CHECK4 OK: GDS line items now correctly sum to the trailing total');

  // --- Toggle K3 back off, confirm both drop back to base fee consistently ---
  await page.uncheck('#applyK3OnChangeFee');
  await page.waitForTimeout(400);
  await page.click('#summariseButton');
  await page.waitForTimeout(150);
  const gdsAfterOff = await page.inputValue('#gdsString');
  console.log('GDS string after K3 OFF:', gdsAfterOff);
  assert.ok(gdsAfterOff.includes('CHG FEE EUR1299'), 'Expected base fee again after toggling K3 off: ' + gdsAfterOff);
  console.log('CHECK5 OK: toggling K3 back off drops both views back to the base fee');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK6 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser.close(); } catch {}
});
