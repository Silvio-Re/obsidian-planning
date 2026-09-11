import assert from 'assert';
import { DateTime } from 'luxon';
import { createAllocator, scheduleWithEDF } from '../src/scheduler.js';

console.log('Testing scheduler advanced (createAllocator, scheduleWithEDF)...');

// Real Luxon DateTime — Jan 1, 2024 is a Monday (weekday=1)
const today = DateTime.fromISO('2024-01-01');

// Build a realistic workDays array (weekdays only)
const workDays = [];
for (let i = 0; i < 14; i++) {
  const d = today.plus({ days: i });
  if (d.weekday <= 5) workDays.push(d);
}

// --- createAllocator tests ---
console.log('  Testing createAllocator...');

// Simple allocator with no meetings
const meetIv1 = {}; // no meetings
const alloc1 = createAllocator(today, workDays, meetIv1, { startHour: 9, hoursPerDay: 8 });

// Allocate 2h — should fit on day 0 (Jan 1) from 9:00
const segs1 = alloc1.allocate(2);
assert.strictEqual(segs1.length, 1, '2h alloc = 1 segment');
assert.strictEqual(segs1[0].calS, 0, 'starts at day 0 fraction 0');
assert.strictEqual(segs1[0].calE, 0.25, 'ends at day 0 fraction 0.25 (2h/8h)');

// Allocate remaining 6h on same day
alloc1.reset();
const segs2 = alloc1.allocate(2); // 2h
assert.strictEqual(segs2.length, 1, 'first 2h = 1 seg');
const segs3 = alloc1.allocate(6); // 6h remaining on day 0
assert.strictEqual(segs3.length, 1, '6h = 1 seg');
assert.strictEqual(segs3[0].calS, 0.25, 'starts where prev ended');
assert.strictEqual(segs3[0].calE, 1, 'fills day 0 (8h)');

// Allocate 1h — should go to day 1 (Jan 2)
const alloc4 = createAllocator(today, workDays, meetIv1, { startHour: 9, hoursPerDay: 8 });
const segs4 = alloc4.allocate(10); // 8h day 0 + 2h day 1
assert.strictEqual(segs4.length, 2, '10h = 2 segments (crosses day)');
assert.strictEqual(segs4[0].calE, 1, 'first seg fills day 0');
assert.strictEqual(segs4[1].calS, 1, 'second seg starts day 1');

// With meetings blocking part of the day
// Meeting on day 0 from 10:00-12:00 (hour 1 to 2, relative to 9:00 start)
// So free: 9-10 (1h), 12-17 (5h) = 6h total
const meetIv2 = {};
meetIv2[0] = [{ s: 1 / 8, e: 3 / 8 }]; // 2h meeting on day 0 (10:00-12:00)
const alloc5 = createAllocator(today, workDays, meetIv2, { startHour: 9, hoursPerDay: 8 });
const segs5 = alloc5.allocate(1);
assert.strictEqual(segs5.length, 1, '1h alloc = 1 segment');
assert.strictEqual(segs5[0].calS, 0, 'starts at day 0');
assert.strictEqual(segs5[0].calE, 0.125, '1h out of 8h = 0.125 fraction');

// Allocate 6h — should take 1h (morning) + 5h (afternoon)
alloc5.reset();
const segs6 = alloc5.allocate(6);
assert.strictEqual(segs6.length, 2, '6h with meeting = 2 segments');
assert.strictEqual(segs6[0].calE, 0.125, 'first seg: 1h morning');
assert.strictEqual(segs6[1].calS, 0.375, 'second seg: after meeting (12:00/8h=0.375)');
assert.strictEqual(segs6[1].calE, 1, 'fills remaining 5h to end of day');

// Weekend skipping: allocate 16h across Mon-Wed (should skip Sat/Sun)
const allocWeekend = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const segsWeekend = allocWeekend.allocate(16);
assert.strictEqual(segsWeekend.length, 2, '16h = 2 segments (Mon + Tue)');
assert.strictEqual(segsWeekend[0].calE, 1, 'first seg fills Mon');
assert.strictEqual(segsWeekend[1].calE, 2, 'second seg fills Tue');

console.log('    createAllocator: PASS');

// --- scheduleWithEDF tests ---
console.log('  Testing scheduleWithEDF...');

// No locks, two tasks with different deadlines
const items1 = [
  { duration: 2, deadline: today.plus({ days: 1 }), title: 'later', path: 'a', line: 1, file: 'a.md', id: 'A', deps: [], priority: 2 },
  { duration: 2, deadline: today, title: 'sooner', path: 'b', line: 1, file: 'b.md', id: 'B', deps: [], priority: 2 },
];
const alloc10 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched1 = scheduleWithEDF(items1, [], alloc10, today);

// EDF: sooner deadline first
assert.strictEqual(sched1[0].title, 'sooner', 'EDF: sooner deadline first');
assert.strictEqual(sched1[1].title, 'later', 'EDF: later deadline second');

// Locked items scheduled first, then EDF
const locks1 = [
  { duration: 2, day: today, hour: 9, min: 0, title: 'meet', path: 'c', line: 1, file: 'c.md', id: 'M', deps: [], deadline: today.plus({ days: 1 }) },
];
const alloc11 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched2 = scheduleWithEDF(items1, locks1, alloc11, today);

assert.strictEqual(sched2[0].title, 'meet', 'locked item scheduled first');
assert.strictEqual(sched2[1].title, 'sooner', 'EDF: sooner next');
assert.strictEqual(sched2[2].title, 'later', 'EDF: later last');

// Zero-duration task
const items2 = [
  { duration: 0, deadline: today, title: 'instant', path: 'd', line: 1, file: 'd.md', id: 'I', deps: [], priority: 2 },
  { duration: 2, deadline: today.plus({ days: 1 }), title: 'normal', path: 'e', line: 1, file: 'e.md', id: 'N', deps: [], priority: 2 },
];
const alloc12 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched3 = scheduleWithEDF(items2, [], alloc12, today);
assert.strictEqual(sched3[0].title, 'instant', 'zero-duration task scheduled');

// Equal deadlines: longer duration first (stable sort)
const items3 = [
  { duration: 1, deadline: today, title: 'short', path: 'f', line: 1, file: 'f.md', id: 'S', deps: [], priority: 2 },
  { duration: 3, deadline: today, title: 'long', path: 'g', line: 1, file: 'g.md', id: 'L', deps: [], priority: 2 },
];
const alloc13 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched4 = scheduleWithEDF(items3, [], alloc13, today);
// b.duration - a.duration = 3 - 1 = 2 > 0, so 'long' comes first
assert.strictEqual(sched4[0].title, 'long', 'equal deadline: longer duration first');
assert.strictEqual(sched4[1].title, 'short', 'equal deadline: shorter duration second');

// Late detection: deadline is today, but task needs more than 1 day
const items4 = [
  { duration: 10, deadline: today, title: 'overloaded', path: 'h', line: 1, file: 'h.md', id: 'O', deps: [], priority: 2 },
];
const alloc14 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched5 = scheduleWithEDF(items4, [], alloc14, today);
assert.strictEqual(sched5[0].late, true, 'task needing more than 1 day with deadline today is late');

// On-time: deadline is 2 days out, task needs 2h
const items5 = [
  { duration: 2, deadline: today.plus({ days: 2 }), title: 'on-time', path: 'i', line: 1, file: 'i.md', id: 'T', deps: [], priority: 2 },
];
const alloc15 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched6 = scheduleWithEDF(items5, [], alloc15, today);
assert.strictEqual(sched6[0].late, false, 'task with distant deadline is not late');

// No items, no locks
const alloc16 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const sched7 = scheduleWithEDF([], [], alloc16, today);
assert.strictEqual(sched7.length, 0, 'empty schedule');

// Verify date math with real Luxon
const d = DateTime.fromISO('2024-01-01');
assert.strictEqual(d.weekday, 1, 'Jan 1, 2024 = Monday');
assert.strictEqual(d.plus({ days: 4 }).weekday, 5, 'Jan 5 = Friday');
assert.strictEqual(d.plus({ days: 5 }).weekday, 6, 'Jan 6 = Saturday');
assert.strictEqual(d.plus({ days: 6 }).weekday, 7, 'Jan 7 = Sunday');
assert.strictEqual(d.plus({ days: 7 }).weekday, 1, 'Jan 8 = Monday');
console.log('    scheduleWithEDF: PASS');

console.log('\nAll scheduler advanced tests passed!');
process.exit(0);
