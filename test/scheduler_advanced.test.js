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

// Deadline-day buffer (on purpose, do not "fix"): a deadline counts from midnight of
// its date, so finishing exactly ON the deadline's date is late — the last safe day is
// the one before the deadline. This reserves the deadline day as a review/slippage
// buffer instead of planning work into it.
// Case 1: 1h task due today (dlIdx 0) scheduled 9:00-10:00 today → endCal 0.125 > 0 → late
const itemsBuf1 = [
  { duration: 1, deadline: today, title: 'due-today', path: 'j', line: 1, file: 'j.md', id: 'B1', deps: [], priority: 2 },
];
const allocBuf1 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const schedBuf1 = scheduleWithEDF(itemsBuf1, [], allocBuf1, today);
assert.strictEqual(schedBuf1[0].endCal, 0.125, '1h task scheduled today 9:00-10:00');
assert.strictEqual(schedBuf1[0].dlIdx, 0, 'deadline today has dlIdx 0');
assert.strictEqual(schedBuf1[0].late, true, 'work on the deadline date is late by definition');

// Case 2: 1h task due tomorrow (dlIdx 1) scheduled today → endCal 0.125 <= 1 → on time
const itemsBuf2 = [
  { duration: 1, deadline: today.plus({ days: 1 }), title: 'due-tomorrow', path: 'k', line: 1, file: 'k.md', id: 'B2', deps: [], priority: 2 },
];
const allocBuf2 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const schedBuf2 = scheduleWithEDF(itemsBuf2, [], allocBuf2, today);
assert.strictEqual(schedBuf2[0].late, false, 'finishing before the deadline day (end of previous day) is on time');

// Case 3: task spilling onto the deadline date (scheduled today, 2h, due tomorrow at midnight):
// ends today+0.25 < 1 → on time. And a task that ends exactly at midnight of the deadline
// (endCal == dlIdx) is on time — the strict comparison `>` marks only work placed on the date.
const itemsBuf3 = [
  { duration: 2, deadline: today.plus({ days: 1 }), title: 'ends-today', path: 'l', line: 1, file: 'l.md', id: 'B3', deps: [], priority: 2 },
];
const allocBuf3 = createAllocator(today, workDays, {}, { startHour: 9, hoursPerDay: 8 });
const schedBuf3 = scheduleWithEDF(itemsBuf3, [], allocBuf3, today);
assert.strictEqual(schedBuf3[0].late, false, 'endCal == dlIdx boundary is on time (strict >)');

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

// --- Priority-correction loop must respect dependencies ---
// When the correction locks a high-priority late task, locked items are allocated FIRST,
// which would place the task before its own dependencies. The lock must pull the task's
// dep closure in (ancestors first) so the corrected schedule never runs a task before its deps.
console.log('  Testing priority correction vs dependencies...');
{
  const { computeSchedule } = await import('../src/scheduler.js');
  const S = { startHour: 9, hoursPerDay: 8 };
  const t0 = DateTime.fromISO('2024-01-01'); // Monday (weekday=1)

  // Repro: X (P0) depends on Y (P2); Z (P1) independent. All due today -> all late,
  // inversion among late exists -> correction locks X. Without the dep closure, the
  // schedule used to become X -> Z -> Y (X before its own dependency).
  const Y = { duration: 4, deadline: t0, title: 'Y', path: 'y', line: 1, file: 'y', id: 'y', deps: [], priority: 2 };
  const X = { duration: 4, deadline: t0, title: 'X', path: 'x', line: 1, file: 'x', id: 'x', deps: ['y'], priority: 0 };
  const Z = { duration: 4, deadline: t0, title: 'Z', path: 'z', line: 1, file: 'z', id: 'z', deps: [], priority: 1 };
  const s1 = computeSchedule([Y, X, Z], [], t0, S);
  const order1 = s1.sched.map(t => t.title);
  assert.strictEqual(order1.join(''), 'YXZ', `dep respected under correction: got ${order1.join(' -> ')}`);
  const y1 = s1.sched.find(t => t.id === 'y');
  const x1 = s1.sched.find(t => t.id === 'x');
  assert.ok(y1.startCal < x1.startCal, 'dependency Y starts before dependent X');
  assert.ok(x1.startCal < s1.sched.find(t => t.id === 'z').startCal, 'correction still hoists X before lower-priority Z');

  // Transitive closure: X -> M -> Y chain; locking X must pull M and Y first, in order.
  const Yc = { duration: 2, deadline: t0, title: 'Yc', path: 'a', line: 1, file: 'a', id: 'yc', deps: [], priority: 3 };
  const Mc = { duration: 2, deadline: t0, title: 'Mc', path: 'b', line: 1, file: 'b', id: 'mc', deps: ['yc'], priority: 3 };
  const Xc = { duration: 2, deadline: t0, title: 'Xc', path: 'c', line: 1, file: 'c', id: 'xc', deps: ['mc'], priority: 0 };
  const Wc = { duration: 2, deadline: t0, title: 'Wc', path: 'd', line: 1, file: 'd', id: 'wc', deps: [], priority: 1 };
  const s2 = computeSchedule([Yc, Mc, Xc, Wc], [], t0, S);
  const order2 = s2.sched.map(t => t.title);
  assert.strictEqual(order2.join(''), 'YcMcXcWc', `transitive dep closure: got ${order2.join(' -> ')}`);

  // Sanity: correction still hoists a dep-free P0 above a P1 (no deps to pull in).
  const lo = { duration: 4, deadline: t0, title: 'lo', path: 'e', line: 1, file: 'e', id: 'lo', deps: [], priority: 3 };
  const hi = { duration: 4, deadline: t0, title: 'hi', path: 'f', line: 1, file: 'f', id: 'hi', deps: [], priority: 0 };
  const s3 = computeSchedule([lo, hi], [], t0, S);
  assert.strictEqual(s3.sched[0].title, 'hi', 'dep-free correction still hoists the highest priority');
  assert.strictEqual(s3.sched[1].title, 'lo', 'lower priority follows');
}
console.log('  priority correction vs dependencies: PASS');

console.log('\nAll scheduler advanced tests passed!');
process.exit(0);
