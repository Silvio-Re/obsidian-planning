// scripts/test-runner.js - Run all tests
// This script runs all test files and reports results

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// Test files are DISCOVERED, not hand-registered: every test/*.test.js and
// test/*.test.mjs runs automatically. A forgotten registry entry was a real
// failure mode (new tests silently never ran), and tests are independent
// node processes, so the hand-curated order bought nothing.
// Helpers live in test/harness/ and artifacts in test/output/ — neither
// matches the *.test.* pattern, so nothing else needs excluding.
const testDir = path.join(PROJECT_ROOT, 'test');
const TEST_FILES = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.js') || f.endsWith('.test.mjs'))
  .sort()
  .map(f => `test/${f}`);

console.log('Running tests...\n');

let passed = 0;
let failed = 0;

for (const testFile of TEST_FILES) {
  const filePath = path.join(PROJECT_ROOT, testFile);
  
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ ${testFile}: File not found`);
    failed++;
    continue;
  }
  
  console.log(`Running ${testFile}...`);
  const result = spawnSync('node', [filePath], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    encoding: 'utf8'
  });
  
  if (result.status === 0) {
    console.log(`  ✓ ${testFile}: PASSED`);
    passed++;
  } else {
    console.error(`  ✗ ${testFile}: FAILED`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    failed++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
