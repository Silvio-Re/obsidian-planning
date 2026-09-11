import assert from 'assert';
import { DateTime } from 'luxon';
import { computeCapacity } from '../src/capacity.js';

console.log('Testing computeCapacity with real Luxon DateTime...\n');

// Jan 1, 2024 is a Monday (weekday=1)
const today = DateTime.fromISO('2024-01-01');
const SCHEDULE = { startHour: 9, hoursPerDay: 8 };

// --- Helper to create item ---
function item(duration, deadlineOffset, priority = 2, inherited = false, ownStr = '--') {
  return {
    duration,
    deadline: today.plus({ days: deadlineOffset }),
    title: `task-${deadlineOffset}`,
    path: 'p', line: 1, file: 'f.md',
    id: 'ID', deps: [],
    ownStr, inherited, priority
  };
}

// --- Basic capacity ---
console.log('  Testing basic capacity...');

// No items
const c1 = computeCapacity([], [], today, SCHEDULE);
assert.strictEqual(c1.values.length > 0, true, 'has values even with no items');
assert.strictEqual(c1.values[0], 0, 'no items, no demand, no capacity change');

// Single item
const c2 = computeCapacity([item(4, 1)], [], today, SCHEDULE);
assert(c2.values.length > 0, 'has values');
assert.strictEqual(c2.values[0], 0, 'day 0: no demand');
assert.strictEqual(c2.values[1], 4, 'day 1: 8h cap - 4h demand = 4');
console.log('    basic capacity: PASS');

// --- Meetings reduce capacity ---
console.log('  Testing meetings reduce capacity...');

const locks1 = [
  { day: today.plus({ days: 1 }), hour: 10, min: 0, hours: 2, title: 'meet', path: 'm', line: 1, file: 'm.md', id: 'M', deps: [] },
];
const c3 = computeCapacity([item(4, 1)], locks1, today, SCHEDULE);
// Day 1: meetings reduce by 2h. capHours[1] = 8 - 2 = 6.
// demand = 4. values[1] = 6 - 4 = 2.
assert(c3.values.length > 0, 'has values');
assert(c3.values[1] < c2.values[1], 'meetings reduce capacity value');
console.log('    meetings reduce capacity: PASS');

// --- Multiple items on different deadlines ---
console.log('  Testing multiple items...');

const items2 = [
  item(2, 1), // due tomorrow
  item(3, 2), // due day after
  item(1, 1), // also due tomorrow
];
const c4 = computeCapacity(items2, [], today, SCHEDULE);
// demand at day 1: 2 + 1 = 3. capHours[1] = 8. values[1] = 5.
// demand at day 2: + 3 more = 6. capHours[2] = 16. values[2] = 16 - 6 = 10.
assert.strictEqual(c4.values[0], 0, 'day 0 has no deficit');
console.log('    multiple items: PASS');

// --- Inherited deadline grouping ---
console.log('  Testing byDay grouping...');

const items3 = [
  item(2, 1, 2, false, '2024-01-02'),
  item(3, 1, 1, true, '2024-01-01'), // inherited, own deadline 2024-01-01
];
const c5 = computeCapacity(items3, [], today, SCHEDULE);
assert.strictEqual(c5.byDay['1'].length, 2, 'two items on day 1');
const inheritedOnDay1 = c5.byDay['1'].some(d => d.inherited);
const nonInheritedOnDay1 = c5.byDay['1'].some(d => !d.inherited);
assert(inheritedOnDay1 && nonInheritedOnDay1, 'has both inherited and non-inherited');
console.log('    byDay grouping: PASS');

// --- maxStack calculation ---
console.log('  Testing maxStack...');

const items4 = [
  item(5, 1),
  item(5, 1),
  item(5, 1),
];
const c6 = computeCapacity(items4, [], today, SCHEDULE);
assert(c6.maxStack >= 15, `maxStack >= 15 (got ${c6.maxStack})`);
console.log('    maxStack: PASS');

// --- Weekend handling with real dates ---
console.log('  Testing weekend handling...');

// Jan 7, 2024 is a Sunday (weekday=7). Day offset = 6
const weekendItem = item(8, 6);
assert.strictEqual(weekendItem.deadline.weekday, 7, 'day 6 = Sunday');
const c7 = computeCapacity([weekendItem], [], today, SCHEDULE);
// capHours for weekends: no capacity added. The deadline is Sunday but
// capacity was already accumulated from Mon-Fri.
// capHours[5] = 40 (5 weekdays * 8h). capHours[6] = 40 (same, no weekend capacity).
// demand at day 6: 8. value = 40 - 8 = 32.
assert(c7.values.length > 0, 'has values');
assert(c7.values[6] > 0, 'weekend has no capacity gap from capacity side');
console.log('    weekend handling: PASS');

// --- Verify real weekdays ---
assert.strictEqual(today.weekday, 1, 'Jan 1, 2024 = Monday');
assert.strictEqual(today.plus({ days: 4 }).weekday, 5, 'Jan 5 = Friday');
assert.strictEqual(today.plus({ days: 5 }).weekday, 6, 'Jan 6 = Saturday');
assert.strictEqual(today.plus({ days: 6 }).weekday, 7, 'Jan 7 = Sunday');
assert.strictEqual(today.plus({ days: 7 }).weekday, 1, 'Jan 8 = Monday');
console.log('    weekday verification: PASS');

// --- Large number of items creating deficit ---
console.log('  Testing stress test...');

const stressItems = [];
for (let d = 1; d <= 10; d++) {
  stressItems.push(item(10, d)); // 10h each, due days 1-10
}
const c8 = computeCapacity(stressItems, [], today, SCHEDULE);
assert(c8.values.length > 0, 'has values for stress test');
const minVal = Math.min(...c8.values);
assert(minVal < 0, `deficit exists: min value = ${minVal}`);
console.log('    stress test: PASS');

// --- Zero duration items ---
console.log('  Testing zero duration items...');

const items6 = [
  item(0, 1),
  item(5, 2),
];
const c9 = computeCapacity(items6, [], today, SCHEDULE);
assert(c9.values.length > 0, 'has values');
console.log('    zero duration items: PASS');

// --- No items, no locks ---
console.log('  Testing empty inputs...');

const c10 = computeCapacity([], [], today, SCHEDULE);
assert(c10.values.length > 0, 'has values for empty input');
assert.strictEqual(c10.maxStack === 1, true, 'maxStack defaults to 1 for empty');
assert.strictEqual(c10.totalDays > 0, true, 'has totalDays');
assert.strictEqual(c10.t0, 0, 't0 is 0 for today');
console.log('    empty inputs: PASS');

console.log('\nAll capacity tests passed!');
process.exit(0);
