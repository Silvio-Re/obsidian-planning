// scripts/test-runner.js - Run all tests
// This script runs all test files and reports results

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// Test files to run
const TEST_FILES = [
  'test/parser.test.js',
  'test/duration_parser.test.js',
];

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
