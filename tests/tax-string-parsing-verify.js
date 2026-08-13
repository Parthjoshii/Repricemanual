// Unit-style tests of the tax-string parsing/validation functions, called directly (plain
// globals in this non-module script). Covers the documented edge cases from the source comments:
// the fixed 2-char tax code (vs. an ambiguous leading digit in a code like "6A"), PD-prefix
// handling, and invalid-entry rejection.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  await page.goto(fileUrl);
  await page.waitForSelector('h1');

  const parseAmount = (t) => page.evaluate((t) => parseAmount(t), t);
  const parseTaxToken = (t) => page.evaluate((t) => parseTaxToken(t), t);
  const parseTaxes = (t) => page.evaluate((t) => parseTaxes(t), t);
  const formatTaxInput = (t) => page.evaluate((t) => { window.__errs = window.__errs || []; return formatTaxInput(t); }, t);

  // --- parseAmount: currency before or after the number, with/without currency at all ---
  assert.deepStrictEqual(await parseAmount('AED1000'), { currency: 'AED', amount: 1000 }, 'Currency-prefixed amount should parse');
  assert.deepStrictEqual(await parseAmount('1000AED'), { currency: 'AED', amount: 1000 }, 'Currency-suffixed amount should parse');
  assert.deepStrictEqual(await parseAmount('1000'), { currency: null, amount: 1000 }, 'A bare number should parse with null currency');
  assert.strictEqual(await parseAmount('abc'), null, 'Non-numeric text should fail to parse');
  assert.strictEqual(await parseAmount(''), null, 'Empty text should fail to parse');
  console.log('CHECK1 OK: parseAmount handles prefixed/suffixed/bare/invalid amounts');

  // --- parseTaxToken: the 2-char-code anchor prevents a digit+letter code from stealing a digit ---
  const t1 = await parseTaxToken('10006A');
  assert.deepStrictEqual(t1, { currency: null, amount: 1000, code: '6A', isPaid: false }, '10006A should split as amount 1000, code 6A — not amount 10006, code A');
  const t2 = await parseTaxToken('AED50YQ');
  assert.deepStrictEqual(t2, { currency: 'AED', amount: 50, code: 'YQ', isPaid: false }, 'Standard 3-letter-currency + amount + 2-letter code should parse');
  const t3 = await parseTaxToken('PDAED30K3');
  assert.deepStrictEqual(t3, { currency: 'AED', amount: 30, code: 'K3', isPaid: true }, 'PD prefix should be detected and stripped from the parsed amount/code');
  const t4 = await parseTaxToken('PD30K3');
  assert.deepStrictEqual(t4, { currency: null, amount: 30, code: 'K3', isPaid: true }, 'PD prefix should work without an explicit currency too');
  assert.strictEqual(await parseTaxToken('garbage'), null, 'Unparseable text should return null');
  assert.strictEqual(await parseTaxToken(''), null, 'Empty token should return null');
  console.log('CHECK2 OK: parseTaxToken — 2-char code anchor, PD prefix, invalid rejection');

  // --- parseTaxes: aggregates same-code entries, PD and non-PD merge into the same bucket ---
  const agg = await parseTaxes('AED50YQ/PDAED30YQ/AED20K3');
  assert.strictEqual(agg.taxes['AEDYQ'], 80, 'AED50YQ + PDAED30YQ should sum into the same AEDYQ bucket (80)');
  assert.strictEqual(agg.taxes['AEDK3'], 20, 'A different code should stay in its own bucket');
  assert.strictEqual(agg.currency, 'AED', 'Inferred currency should be the first explicit currency seen');
  const aggNoCurrency = await parseTaxes('50YQ');
  assert.strictEqual(aggNoCurrency.currency, 'INR', 'With no explicit currency anywhere, INR should be the fallback default');
  console.log('CHECK3 OK: parseTaxes aggregation, PD/non-PD merge into one bucket, currency inference/fallback');

  // --- formatTaxInput: validates/normalizes a raw multi-entry string, flags invalid entries ---
  const formatted = await formatTaxInput('aed50yq, USD30k3');
  assert.strictEqual(formatted, 'AED50YQ/USD30K3', 'Mixed-case, comma-separated entries should normalize to uppercase, slash-joined');
  const withInvalid = await formatTaxInput('AED50YQ/notatax/AED20K3');
  assert.strictEqual(withInvalid, 'AED50YQ/AED20K3', 'An invalid entry should be dropped, valid ones kept');
  console.log('CHECK4 OK: formatTaxInput normalizes valid entries and drops invalid ones');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK5 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
