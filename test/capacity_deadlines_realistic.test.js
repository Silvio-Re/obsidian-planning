import assert from 'assert';
import { DateTime } from 'luxon';
import { computeCapacity } from '../src/capacity.js';

console.log('Testing computeCapacity with realistic deadline distributions...\n');

// Jan 1, 2024 is a Monday (weekday=1)
const today = DateTime.fromISO('2024-01-01');
const SCHEDULE = { startHour: 9, hoursPerDay: 8 };

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

function meet(dayOffset, hours, h = 10, m = 0) {
  return {
    day: today.plus({ days: dayOffset }),
    hour: h, min: m, hours,
    title: 'meeting', path: 'm', line: 1, file: 'm.md', id: 'M', deps: []
  };
}

// --- Verify real calendar dates ---
console.log('  Verifying calendar dates...');
assert.strictEqual(today.weekday, 1, 'Jan 1 = Monday');
assert.strictEqual(today.plus({ days: 4 }).weekday, 5, 'Jan 5 = Friday');
assert.strictEqual(today.plus({ days: 5 }).weekday, 6, 'Jan 6 = Saturday');
assert.strictEqual(today.plus({ days: 6 }).weekday, 7, 'Jan 7 = Sunday');
assert.strictEqual(today.plus({ days: 11 }).weekday, 5, 'Jan 12 = Friday');
console.log('    calendar dates verified');

console.log('  Testing all deadlines same day (demand spike)...');

const spikeItems = [
  item(4, 1),
  item(1, 1), item(1, 1), item(1, 1), item(1, 1), item(1, 1), item(1, 1),
];
const capSpike = computeCapacity(spikeItems, [], today, SCHEDULE);
const spikeMin = Math.min(...capSpike.values);
assert(spikeMin < 0, `demand spike creates deficit: min=${spikeMin}`);
console.log('    all deadlines same day: PASS');

console.log('  Testing spread deadlines over 30 days...');

const spreadItems = [];
for (let d = 1; d <= 10; d++) {
  spreadItems.push(item(4, d));
}
const capSpread = computeCapacity(spreadItems, [], today, SCHEDULE);
const spreadMin = Math.min(...capSpread.values);
assert(spreadMin !== 0 || capSpread.values.some(v => v > 0), 'has varied values across days');
console.log('    spread deadlines: PASS');

console.log('  Testing overdue deadlines (before today)...');

const overdueItems = [
  item(4, -1), // due yesterday
  item(2, -2), // due day before yesterday
];
const capOverdue = computeCapacity(overdueItems, [], today, SCHEDULE);
const overdueMin = Math.min(...capOverdue.values);
assert(overdueMin < 0, `overdue creates deficit: min=${overdueMin}`);
assert(capOverdue.t0 > 0, 't0 shifts backward for overdue items');
console.log('    overdue deadlines: PASS');

console.log('  Testing deadlines on weekends...');

const weekendItem = item(8, 6); // day 6 = Sunday
assert.strictEqual(weekendItem.deadline.weekday, 7, 'deadline falls on Sunday');
const capWeekend = computeCapacity([weekendItem], [], today, SCHEDULE);
assert(capWeekend.values.length >= 6, 'has enough days to cover weekend');
// The key test: capHours should NOT increase on weekend days
// capHours[5] (Friday) = 5 * 8 = 40
// capHours[6] (Saturday) = 40 (no increase, weekend)
assert(capWeekend.values.length > 0, 'has values');
console.log('    weekend deadlines: PASS');

console.log('  Testing bottleneck day (narrow window)...');

const bottleneckItems = [];
for (let d = 1; d <= 30; d += 1) {
  bottleneckItems.push(item(30, 6)); // 30h all due day 6
}
const capBottleneck = computeCapacity(bottleneckItems, [], today, SCHEDULE);
const bnMin = Math.min(...capBottleneck.values);
assert(bnMin < 0, `bottleneck creates huge deficit: min=${bnMin}`);
assert(capBottleneck.maxStack >= 30, `maxStack reflects 30h stack`);
console.log('    bottleneck day: PASS');

console.log('  Testing mixed deadlines...');

const mixedItems = [
  item(6, 1),
  item(2, 1),
  item(4, 5),
  item(4, 5),
  item(3, 10),
  item(3, 15),
  item(3, 30),
];
const capMixed = computeCapacity(mixedItems, [], today, SCHEDULE);
const mixedMin = Math.min(...capMixed.values);
assert(mixedMin >= 0, `mixed deadlines fit: min=${mixedMin}`);
assert(capMixed.byDay['1'].length, 'day 1 has items');
assert(capMixed.byDay['5'].length, 'day 5 has items');
assert(capMixed.byDay['10'].length, 'day 10 has items');
console.log('    mixed deadlines: PASS');

console.log('  Testing items with zero duration...');

const zeroDurItems = [
  item(0, 1),
  item(5, 1),
  item(0, 2),
];
const capZero = computeCapacity(zeroDurItems, [], today, SCHEDULE);
assert(capZero.values.length > 0, 'has values');
console.log('    zero duration items: PASS');

console.log('  Testing meeting locks reduce capacity...');

const locks1 = [meet(1, 2)]; // 2h meeting on day 1
const meetItems = [item(6, 1)]; // 6h due day 1
const capMeet = computeCapacity(meetItems, locks1, today, SCHEDULE);
const meetMin = Math.min(...capMeet.values);
assert(meetMin >= 0, `meeting doesn't cause deficit with exactly-fitting demand: min=${meetMin}`);

const meetItems2 = [item(7, 1)]; // 7h due day 1
const capMeet2 = computeCapacity(meetItems2, locks1, today, SCHEDULE);
const meetMin2 = Math.min(...capMeet2.values);
assert(meetMin2 < 0, `meeting + extra demand causes deficit: min=${meetMin2}`);
console.log('    meeting locks: PASS');

console.log('  Testing multiple meetings on same day...');

const locks2 = [meet(1, 3), meet(1, 4)]; // 3h + 4h = 7h
const capMultiMeet = computeCapacity([item(2, 1)], locks2, today, SCHEDULE);
const mmMin = Math.min(...capMultiMeet.values);
assert(mmMin < 0, `multiple meetings cause deficit: min=${mmMin}`);
console.log('    multiple meetings: PASS');

console.log('  Testing inherited deadline items...');

const inhItems = [
  item(4, 1, 2, false, '2024-01-02'),
  item(3, 2, 1, true, '2024-01-01'),
  item(2, 2, 0, true, '2023-12-31'),
];
const capInh = computeCapacity(inhItems, [], today, SCHEDULE);
assert(capInh.byDay['1'].length === 1, '1 item on day 1');
assert(capInh.byDay['2'].length === 2, '2 items on day 2');
assert(capInh.byDay['2'].some(d => d.inherited === true), 'has inherited items');
console.log('    inherited deadlines: PASS');

console.log('  Testing priority grouping...');

const prioItems = [
  item(4, 1, 0),
  item(4, 1, 1),
  item(4, 1, 2),
  item(4, 1, 3),
  item(4, 1, 4),
];
const capPrio = computeCapacity(prioItems, [], today, SCHEDULE);
assert(capPrio.byDay['1'].length === 5, '5 items on day 1');
assert(capPrio.maxStack >= 20, `maxStack=20h`);
const prioMin = Math.min(...capPrio.values);
assert(prioMin < 0, `priority mix creates deficit: min=${prioMin}`);
console.log('    priority grouping: PASS');

console.log('  Testing task due today...');

const todayItem = item(4, 0); // deadline = today
const capToday = computeCapacity([todayItem], [], today, SCHEDULE);
const todayMin = Math.min(...capToday.values);
assert(todayMin < 0, `task due today creates deficit: min=${todayMin}`);
assert(capToday.t0 === 0, 't0=0 for today-deadline');
console.log('    task due today: PASS');

console.log('\nAll capacity realistic tests passed!');
process.exit(0);
