// Unit-style test of formatAmount() against roundingRules — calls the function directly (it's a
// plain global in this non-module script) rather than driving the UI, since this is pure
// currency-rounding arithmetic with no DOM dependency.
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

  const fmt = (value, currency) => page.evaluate(({ value, currency }) => formatAmount(value, currency), { value, currency });

  // --- INR: ceiling, 0 decimals — always rounds UP regardless of fractional part ---
  assert.strictEqual(await fmt(100.01, 'INR'), '101', 'INR should ceiling 100.01 up to 101');
  assert.strictEqual(await fmt(100.99, 'INR'), '101', 'INR should ceiling 100.99 up to 101');
  assert.strictEqual(await fmt(100.00, 'INR'), '100', 'INR should leave an exact whole number unchanged');
  assert.strictEqual(await fmt(-5.5, 'INR'), '-5', 'INR ceiling on a negative number rounds toward zero (Math.ceil semantics)');
  console.log('CHECK1 OK: INR ceiling rounding (always rounds up)');

  // --- JPY: nearest, 0 decimals — standard round-half-up to a whole unit ---
  assert.strictEqual(await fmt(100.49, 'JPY'), '100', 'JPY should round 100.49 down to 100');
  assert.strictEqual(await fmt(100.50, 'JPY'), '101', 'JPY should round 100.50 up to 101 (round-half-up)');
  console.log('CHECK2 OK: JPY nearest-whole-unit rounding');

  // --- BHD/KWD/OMR/JOD/TND: standard, 3 decimals ---
  assert.strictEqual(await fmt(12.3456, 'BHD'), '12.346', 'BHD should round to 3 decimals (12.3456 -> 12.346)');
  assert.strictEqual(await fmt(12.3444, 'BHD'), '12.344', 'BHD should round down at the 4th decimal below .5');
  assert.strictEqual(await fmt(1, 'KWD'), '1.000', 'KWD should always show 3 decimals even for a whole number');
  console.log('CHECK3 OK: 3-decimal currencies (BHD/KWD/etc.) round and display correctly');

  // --- Default 2-decimal currencies (AED, USD, and anything NOT in roundingRules) ---
  assert.strictEqual(await fmt(99.995, 'AED'), '100.00', 'AED should round 99.995 up to 100.00 (2 decimals)');
  assert.strictEqual(await fmt(99.994, 'AED'), '99.99', 'AED should round 99.994 down to 99.99');
  assert.strictEqual(await fmt(50, 'XXX'), '50.00', 'An unlisted currency code should default to standard 2-decimal rounding');
  console.log('CHECK4 OK: default 2-decimal rounding (explicit AED and unlisted-currency fallback)');

  // --- Edge cases: zero, falsy, NaN ---
  assert.strictEqual(await fmt(0, 'AED'), '0', 'Zero should format as the literal "0", not "0.00" (falsy short-circuit)');
  assert.strictEqual(await fmt('', 'AED'), '0', 'Empty value should format as "0"');
  assert.strictEqual(await fmt('abc', 'AED'), '0', 'Non-numeric value should format as "0"');
  console.log('CHECK5 OK: zero/empty/NaN edge cases');

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0, 'Expected zero console errors');
  console.log('CHECK6 OK: zero console errors');

  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(async (err) => {
  console.error('FAILURE:', err.message);
  process.exitCode = 1;
});
