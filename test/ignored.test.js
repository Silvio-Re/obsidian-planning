import assert from 'assert';
import { DateTime } from 'luxon';

console.log('Testing ignored task detection with real Luxon DateTime...\n');

// Jan 1, 2024 is a Monday (weekday=1)
const today = DateTime.fromISO('2024-01-01');

// Inline getIgnoreReason (from src/render/ignored.js) to avoid Obsidian utils dependency
function getIgnoreReason(d) {
  if (!d.ownDL && !d.graphDL) return 'no deadline or inherited deadline';
  if (!d.ownDL) return 'no own deadline and inherited deadline is invalid';
  if (d.locked) return 'locked task';
  return 'no effective deadline';
}

// Also test the ignored filtering logic from src/index.js:
// ignored = all.filter(r => !r.isIndented && !r.locked && !r.eff)
function isIgnored(d) {
  return !d.isIndented && !d.locked && !d.eff;
}

function task(ownDL, graphDL, eff, locked, isIndented) {
  return { ownDL, graphDL, eff, locked: locked || false, isIndented: isIndented || false };
}

// --- Reason: no deadline ---
console.log('  Testing no-deadline reason...');

const r1 = getIgnoreReason(task(null, null, null, false, false));
assert.strictEqual(r1, 'no deadline or inherited deadline', 'no deadlines => reason 1');

const r2 = getIgnoreReason(task(null, today, null, false, false));
assert.strictEqual(r2, 'no own deadline and inherited deadline is invalid', 'only graphDL => reason 2');
console.log('    no-deadline reason: PASS');

// --- Reason: locked ---
console.log('  Testing locked reason...');

const r3 = getIgnoreReason(task(today, null, null, true, false));
assert.strictEqual(r3, 'locked task', 'locked => reason 3');
console.log('    locked reason: PASS');

// --- Reason: no effective deadline ---
console.log('  Testing no-effective-deadline reason...');

const r4 = getIgnoreReason(task(today, null, null, false, false));
assert.strictEqual(r4, 'no effective deadline', 'has ownDL but no eff => reason 4');
console.log('    no-effective-deadline: PASS');

// --- isIgnored filtering ---
console.log('  Testing isIgnored filter logic...');

const ignoredTasks = [
  task(today, null, null, false, false),     // eff = null => ignored
  task(today, null, null, false, true),      // isIndented => NOT ignored
  task(today, null, null, true, false),      // locked => NOT ignored
  task(today, null, null, false, false),     // eff = null => ignored
  task(null, null, null, false, false),      // no deadlines => ignored
  task(today, null, today, false, false),    // eff = today => NOT ignored
];

const ignored = ignoredTasks.filter(isIgnored);
assert.strictEqual(ignored.length, 3, '3 tasks ignored (not indented, not locked, no eff)');
assert.strictEqual(ignored[2].ownDL?.toISODate(), undefined, 'third ignored has no ownDL');
console.log('    isIgnored filter: PASS');

// --- Verify real Luxon dates used throughout ---
console.log('  Verifying Luxon date correctness...');
assert.strictEqual(today.weekday, 1, 'Jan 1, 2024 = Monday');
assert.strictEqual(today.plus({ days: 5 }).weekday, 6, 'Jan 6 = Saturday');
assert.strictEqual(today.plus({ days: 6 }).weekday, 7, 'Jan 7 = Sunday');
const past = today.minus({ days: 1 });
assert.strictEqual(past.toISODate(), '2023-12-31', 'yesterday = Dec 31, 2023');
console.log('    Luxon date correctness: PASS');

console.log('\nAll ignored tests passed!');
process.exit(0);
