/**
 * Master Test Runner: Discovers and executes all Playwright & unit test suites.
 * Usage: node tests/run-all-tests.js [optional-filter]
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testsDir = __dirname;
const filter = process.argv[2] ? process.argv[2].toLowerCase() : '';

// Exclude the test runner itself
const EXCLUDED_FILES = new Set([
  'run-all-tests.js',
]);

const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.js') && !EXCLUDED_FILES.has(f))
  .filter(f => !filter || f.toLowerCase().includes(filter))
  .sort();

console.log('========================================================================');
console.log(`MANUAL REPRICE - MASTER CALCULATOR: TEST SUITE RUNNER`);
console.log(`Found ${testFiles.length} test suites in ${testsDir}`);
console.log('========================================================================\n');

function runTest(filename) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const filePath = path.join(testsDir, filename);
    const proc = spawn('node', [filePath, 'index.html'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { output += d.toString(); });

    const timeoutMs = filename.includes('chaos') || filename.includes('sectional') ? 360000 : 45000;
    const timer = setTimeout(() => {
      proc.kill();
      resolve({
        filename,
        passed: false,
        code: -1,
        elapsed: ((Date.now() - startTime) / 1000).toFixed(2),
        output: output + `\nTIMEOUT after ${timeoutMs / 1000}s`,
      });
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      resolve({
        filename,
        passed: code === 0,
        code,
        elapsed,
        output,
      });
    });
  });
}

(async () => {
  let passedCount = 0;
  let failedCount = 0;
  const failures = [];

  for (let i = 0; i < testFiles.length; i++) {
    const file = testFiles[i];
    process.stdout.write(`[${i + 1}/${testFiles.length}] Running ${file}... `);

    const result = await runTest(file);

    if (result.passed) {
      passedCount++;
      console.log(`✓ PASS (${result.elapsed}s)`);
    } else {
      failedCount++;
      console.log(`✗ FAIL (${result.elapsed}s) [exit ${result.code}]`);
      failures.push(result);
    }
  }

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED, ${testFiles.length} TOTAL`);
  console.log('========================================================================');

  if (failures.length > 0) {
    console.log('\n--- FAILURE DETAILS ---');
    failures.forEach((f) => {
      console.log(`\n>>> ${f.filename} (Exit Code: ${f.code}) <<<`);
      console.log(f.output.slice(-1500)); // Show tail of output
    });
    process.exit(1);
  } else {
    console.log('\n✓ ALL TEST SUITES COMPLETED WITH 100% SUCCESS!');
    process.exit(0);
  }
})();
