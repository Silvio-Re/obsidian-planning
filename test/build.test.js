import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('Testing build system...');

// --- Build script verifies source file ordering ---
console.log('  Testing build script file ordering...');

// Read the build script
const buildScript = fs.readFileSync(path.join(ROOT, 'scripts/build.js'), 'utf8');

// Check the planning-artifact file list is in the right order.
// build.js groups source files per release artifact (ARTIFACTS); the planning.md dashboard chain
// is the canonical ordering (constants first, index last).
const srcFilesMatch = buildScript.match(/planning\.md':\s*\{\s*files:\s*\[([\s\S]*?)\]/);
assert(srcFilesMatch, 'planning.md artifact files array exists');
const srcFilesStr = srcFilesMatch[1];

// Verify order: constants first, index last
assert(srcFilesStr.indexOf('src/constants.js') < srcFilesStr.indexOf('src/utils.js'), 'constants before utils');
assert(srcFilesStr.indexOf('src/utils.js') < srcFilesStr.indexOf('src/parser.js'), 'utils before parser');
assert(srcFilesStr.indexOf('src/parser.js') < srcFilesStr.indexOf('src/scheduler.js'), 'parser before scheduler');
assert(srcFilesStr.indexOf('src/scheduler.js') < srcFilesStr.indexOf('src/capacity.js'), 'scheduler before capacity');
assert(srcFilesStr.indexOf('src/capacity.js') < srcFilesStr.indexOf('src/render/capacity_chart.js'), 'capacity before capacity_chart');
assert(srcFilesStr.indexOf('src/render/capacity_chart.js') < srcFilesStr.indexOf('src/render/gantt.js'), 'capacity_chart before gantt');
assert(srcFilesStr.indexOf('src/render/gantt.js') < srcFilesStr.indexOf('src/render/execution_list.js'), 'gantt before execution_list');
assert(srcFilesStr.indexOf('src/render/execution_list.js') < srcFilesStr.indexOf('src/render/ignored.js'), 'execution_list before ignored');
assert(srcFilesStr.indexOf('src/render/ignored.js') < srcFilesStr.indexOf('src/render/parsing_errors.js'), 'ignored before parsing_errors');
assert(srcFilesStr.indexOf('src/render/parsing_errors.js') < srcFilesStr.indexOf('src/index.js'), 'parsing_errors before index');

console.log('    file ordering: PASS');

// --- All source files exist ---
console.log('  Testing all source files exist...');
const srcFiles = [
  'src/constants.js', 'src/utils.js', 'src/parser.js', 'src/scheduler.js',
  'src/capacity.js', 'src/render/capacity_chart.js', 'src/render/gantt.js',
  'src/render/execution_list.js', 'src/render/ignored.js', 'src/render/parsing_errors.js',
  'src/render/completed.js', 'src/render/daily_notes.js',
  'src/execution_sequence.js', 'src/daily_notes.js', 'src/index.js',
];
for (const f of srcFiles) {
  assert(fs.existsSync(path.join(ROOT, f)), `${f} exists`);
}
console.log('    all files exist: PASS');

// --- Test build script runs ---
console.log('  Testing build script executes...');
const { execSync } = await import('child_process');
const buildOutput = execSync('node scripts/build.js', { cwd: ROOT, encoding: 'utf8' });
assert(buildOutput.includes('Built'), 'build output contains "Built"');
console.log('    build runs: PASS');

// --- Verify planning.md is valid dataviewjs block ---
console.log('  Testing planning.md structure...');
const planning = fs.readFileSync(path.join(ROOT, 'planning.md'), 'utf8');
assert(planning.startsWith('```dataviewjs'), 'starts with dataviewjs fence');
assert(planning.endsWith('```\n') || planning.endsWith('```'), 'ends with closing fence');
// Contains key functions (imports were resolved)
assert(planning.includes('collectPlannerData'), 'contains collectPlannerData');
assert(planning.includes('computeSchedule'), 'contains computeSchedule');
assert(planning.includes('computeCapacity'), 'contains computeCapacity');
assert(planning.includes('renderCapacity'), 'contains renderCapacity');
assert(planning.includes('renderGantt'), 'contains renderGantt');
assert(planning.includes('renderExecutionList'), 'contains renderExecutionList');
assert(planning.includes('renderIgnored'), 'contains renderIgnored');
assert(planning.includes('renderParsingErrors'), 'contains renderParsingErrors');
console.log('    planning.md valid: PASS');

// --- No import/export statements in output ---
console.log('  Testing no import/export in output...');
const importLines = planning.split('\n').filter(l => /^import\s+/.test(l));
const exportLines = planning.split('\n').filter(l => /^export\s+/.test(l));
assert.strictEqual(importLines.length, 0, `no import statements in output (found ${importLines.length})`);
assert.strictEqual(exportLines.length, 0, `no export statements in output (found ${exportLines.length})`);
console.log('    no import/export: PASS');

// --- Testing script test-runner ---
console.log('  Testing test-runner structure...');
const testRunner = fs.readFileSync(path.join(ROOT, 'scripts/test-runner.js'), 'utf8');
assert(testRunner.includes('spawnSync'), 'uses spawnSync to run tests');
assert(testRunner.includes('TEST_FILES'), 'defines TEST_FILES');
assert(testRunner.includes('Results:'), 'reports results');
console.log('    test-runner structure: PASS');

console.log('\nAll build tests passed!');
process.exit(0);
