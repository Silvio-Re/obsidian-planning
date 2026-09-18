import assert from 'assert';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('Testing render modules...');

// --- Test capacity_chart.js module structure ---
console.log('  Testing capacity_chart exports...');
const capChartSrc = fs.readFileSync(path.join(ROOT, 'src/render/capacity_chart.js'), 'utf8');
assert(capChartSrc.includes('export function renderCapacity'), 'exports renderCapacity');
assert(capChartSrc.includes('<svg'), 'renders SVG');
assert(capChartSrc.includes('renderCapacity'), 'function is renderCapacity');
console.log('    capacity_chart structure: PASS');

// --- Test gantt.js module structure ---
console.log('  Testing gantt exports...');
const ganttSrc = fs.readFileSync(path.join(ROOT, 'src/render/gantt.js'), 'utf8');
assert(ganttSrc.includes('export function renderGantt'), 'exports renderGantt');
assert(ganttSrc.includes('renderGantt'), 'function name is renderGantt');
console.log('    gantt structure: PASS');

// --- Test execution_list.js module structure ---
console.log('  Testing execution_list exports...');
const execListSrc = fs.readFileSync(path.join(ROOT, 'src/render/execution_list.js'), 'utf8');
assert(execListSrc.includes('export function renderExecutionList'), 'exports renderExecutionList');
assert(execListSrc.includes('renderExecutionList'), 'function name is renderExecutionList');
console.log('    execution_list structure: PASS');

// --- Test parsing_errors.js module structure ---
console.log('  Testing parsing_errors exports...');
const parseErrSrc = fs.readFileSync(path.join(ROOT, 'src/render/parsing_errors.js'), 'utf8');
assert(parseErrSrc.includes('export function renderParsingErrors'), 'exports renderParsingErrors');
assert(parseErrSrc.includes('renderParsingErrors'), 'function name is renderParsingErrors');
console.log('    parsing_errors structure: PASS');

// --- Test ignored.js module structure ---
console.log('  Testing ignored exports...');
const ignoredSrc = fs.readFileSync(path.join(ROOT, 'src/render/ignored.js'), 'utf8');
assert(ignoredSrc.includes('export function renderIgnored'), 'exports renderIgnored');
assert(ignoredSrc.includes('getIgnoreReason'), 'exports getIgnoreReason');
console.log('    ignored structure: PASS');

// --- Test render files import from utils ---
console.log('  Testing render imports...');
const allRenderFiles = fs.readdirSync(path.join(ROOT, 'src/render'));
for (const f of allRenderFiles) {
  const content = fs.readFileSync(path.join(ROOT, 'src/render', f), 'utf8');
  // Render files pull shared helpers from utils.js directly (capacity_chart, gantt…), or reuse the
  // shared grouped tree from completed.js (daily_notes.js) — both are valid shared-code imports.
  assert(
    content.includes("from '../utils.js'") || content.includes("from './completed.js'"),
    `${f} imports shared helpers (utils.js or the completed tree)`
  );
}
console.log('    all render files import utils: PASS');

// --- Test render files import from constants ---
console.log('  Testing constants imports...');
const allRenderContents = allRenderFiles.map(f => fs.readFileSync(path.join(ROOT, 'src/render', f), 'utf8'));
const constantsImporters = allRenderContents.filter(c => c.includes("from '../constants.js'"));
assert(constantsImporters.length >= 3, 'most render files import from constants');
console.log('    render module imports: PASS');

console.log('\nAll rendering tests passed!');
process.exit(0);
