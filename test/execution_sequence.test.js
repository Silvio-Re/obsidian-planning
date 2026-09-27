import assert from 'assert';
import { DateTime } from 'luxon';
import { computeSchedule } from '../src/scheduler.js';
import { buildExecutionSequence } from '../src/execution_sequence.js';

// A meeting is a fixed block at a user-specified time. When that time falls OUTSIDE
// working hours (e.g. 17:30 when the day ends at 17:00), the meeting must stay on its
// REQUESTED date in the execution list (it must NOT roll to the next calendar day), and
// in the Gantt its bar extends visually past the working day into the next working day,
// while the next working day's first task still starts at 09:00 (it is not pushed back).
// This suite covers that behaviour end-to-end (scheduler display + execution sequence).

console.log('Testing out-of-working-hours meetings stay on their requested date\n');

const today = DateTime.fromISO('2026-09-23T00:00'); // Wednesday (working day)
const SCHEDULE = { startHour: 9, hoursPerDay: 8 };

// A meeting lock. `day` is date-only (midnight, as dv.date gives); hour/min carry the time.
function meet(id, hour, min, hours) {
  return { day: today, hour, min, hours, title: `Meet ${id}`, path: id, line: 1, file: id, id, deps: [], priority: 2 };
}
// A task with a deadline `days` after today.
function task(id, duration, days = 0) {
  return { id, duration, deadline: today.plus({ days }), title: `Task ${id}`, path: id, line: 1, file: id, deps: [], ownStr: '--', inherited: true, priority: 2 };
}
function meetAt(result, id) { return result.meetData.find(m => m.id === id); }

// 1. Post-working-hours meeting (17:30, 4h): its display calS/calE are UNCLAMPED so the
//    Gantt bar extends past the working day (fraction 1.0 == end of the working day).
{
  const sched = computeSchedule([], [meet('M', 17, 30, 4)], today, SCHEDULE);
  const m = meetAt(sched, 'M');
  const dayIdx = m.day.diff(today, 'days').days;
  assert.strictEqual(dayIdx, 0, 'meeting day is the reference day');
  assert.ok(m.calS > dayIdx + 1, `calS (${m.calS}) must be past the working-day end (${dayIdx + 1})`);
  assert.ok(m.calE > m.calS, 'bar spans the meeting duration');
  const spanDays = m.calE - m.calS;
  assert.strictEqual(spanDays, 4 / 8, 'bar width equals the meeting duration (4h)');
  assert.ok(m.calS - dayIdx > 1 - 1e-9 && m.calS - dayIdx < 1 + 0.1, 'meeting starts just past the working day (17:30)');
  console.log('  1. post-hours meeting calS/calE extend past working day: PASS');
}

// 2. In the execution list, the post-hours meeting stays on its REQUESTED date: its display
//    start is clamped back into its own day (< dayIdx + 1) and it carries meetDateStr.
{
  const sched = computeSchedule([], [meet('M', 17, 30, 4)], today, SCHEDULE);
  const seq = buildExecutionSequence([], sched.meetData, today);
  assert.strictEqual(seq.length, 1, 'one meeting row');
  const row = seq[0];
  assert.strictEqual(row.kind, 'meet');
  assert.strictEqual(row.meetDateStr, 'Wed 23 Sep', 'groups on the requested date, not the next day');
  // today is the reference day, so dayIdx == 0: the display start must stay in [0, 1).
  assert.ok(row.startCal >= 0 && row.startCal < 1, `startCal (${row.startCal}) clamped into the requested day`);
  console.log('  2. post-hours meeting grouped on its requested date in list: PASS');
}

// 3. A pre-working-hours meeting (08:00, 2h) extends BEFORE the working day in the Gantt
//    (calS < dayIdx) but still groups on its requested date in the list.
{
  const sched = computeSchedule([], [meet('P', 8, 0, 2)], today, SCHEDULE);
  const m = meetAt(sched, 'P');
  assert.ok(m.calS < m.day.diff(today, 'days').days + 1, 'pre-hours meeting starts before the working day');
  const seq = buildExecutionSequence([], sched.meetData, today);
  assert.strictEqual(seq[0].meetDateStr, 'Wed 23 Sep', 'pre-hours meeting also stays on its date');
  console.log('  3. pre-hours meeting extends before the day, still on its date: PASS');
}

// 4. In-hours meeting (14:00, 1h) is unchanged: calS/calE within the working day [0,1].
{
  const sched = computeSchedule([], [meet('H', 14, 0, 1)], today, SCHEDULE);
  const m = meetAt(sched, 'H');
  assert.ok(m.calS >= 0 && m.calS <= 1, 'in-hours meeting starts within the day');
  assert.ok(m.calE >= 0 && m.calE <= 1, 'in-hours meeting ends within the day');
  const seq = buildExecutionSequence([], sched.meetData, today);
  assert.strictEqual(seq[0].meetDateStr, 'Wed 23 Sep');
  console.log('  4. in-hours meeting unchanged (within [0,1]): PASS');
}

// 5. The meeting reserves only in-hours time: a post-hours meeting reserves NO working
//    time on its day, so the next working day's first task still starts at 09:00 (cal 1.0)
//    and is NOT pushed later by the meeting.
{
  // 4x2h tasks (8h) fill the whole working day; the 5th spills to the next day.
  const items = [task('a', 2, 0), task('b', 2, 0), task('c', 2, 0), task('d', 2, 0), task('e', 2, 1)];
  const sched = computeSchedule(items, [meet('M', 17, 30, 4)], today, SCHEDULE);
  const e = sched.sched.find(s => s.id === 'e');
  assert.ok(e, 'the overflow task is scheduled');
  assert.ok(Math.abs(e.startCal - 1.0) < 1e-9, `overflow task starts at 09:00 next day (cal 1.0), got ${e.startCal}`);
  // Cross-check: the same setup WITHOUT the meeting schedules the overflow task identically.
  const sched0 = computeSchedule(items, [], today, SCHEDULE);
  const e0 = sched0.sched.find(s => s.id === 'e');
  assert.ok(Math.abs(e0.startCal - 1.0) < 1e-9, 'without meeting, overflow task also starts at 09:00');
  console.log('  5. post-hours meeting does not push the next working day (task at 09:00): PASS');
}

// 6. The meeting still blocks in-hours time when it straddles the working-day end
//    (16:00, 4h => 16:00-17:00 occupies 1h, the rest is past hours). A task cannot be
//    placed in that in-hours slot.
{
  const items = [task('z', 1, 0)]; // 1h task, wants to start 09:00 on the meeting day
  const sched = computeSchedule(items, [meet('S', 16, 0, 4)], today, SCHEDULE);
  const m = meetAt(sched, 'S');
  const z = sched.sched.find(s => s.id === 'z');
  assert.ok(m.calS < 1 && m.calE > 1, 'straddling meeting bar crosses the working-day end');
  // The in-hours part [16:00,17:00] = fraction [0.875,1.0] is locked; the task at 09:00 is free.
  assert.ok(Math.abs(z.startCal - 0.0) < 1e-9, 'task keeps 09:00 (only the 16:00-17:00 slot is locked)');
  console.log('  6. straddling meeting still locks only its in-hours portion: PASS');
}

// 7. TRUE-CLOCK-ORDER SORT. The display clamp maps both a pre-hours meeting (08:00)
//    and a day-start task (09:00) to startCal 0, but the execution list and agenda
//    print real clock times, so the meeting must still come FIRST.
{
  const items = [task('a', 2, 1)]; // 2h task, starts 09:00 on the meeting's day
  const sched = computeSchedule(items, [meet('P', 8, 0, 1)], today, SCHEDULE);
  const seq = buildExecutionSequence(sched.sched, sched.meetData, today);
  assert.strictEqual(seq.length, 2, 'one meeting + one task');
  assert.strictEqual(seq[0].kind, 'meet', 'pre-hours meeting sorts before the 09:00 task');
  assert.strictEqual(seq[0].meetTrueTime, '08:00', 'meeting keeps its true time');
  assert.ok(Math.floor(seq[0].startCal) === Math.floor(seq[1].startCal), 'both still group on the same day');
  console.log('  7. pre-hours meeting (08:00) sorts before a 09:00 task: PASS');
}

// 8. Post-hours meeting stays LAST on its requested day — the true-position sort
//    must not push it into the next day's group (day key is the clamped display day).
{
  const items = [task('a', 8, 1), task('b', 2, 2)];
  const sched = computeSchedule(items, [meet('N', 23, 30, 0.5)], today, SCHEDULE);
  const seq = buildExecutionSequence(sched.sched, sched.meetData, today);
  const meetIdx = seq.findIndex(e => e.kind === 'meet');
  const meetRow = seq[meetIdx];
  assert.ok(Math.floor(meetRow.startCal) === 0, 'post-hours meeting groups on its requested day');
  const dayZeroRows = seq.filter(e => Math.floor(e.startCal) === 0);
  assert.strictEqual(seq.indexOf(meetRow), seq.lastIndexOf(dayZeroRows[dayZeroRows.length - 1]), 'post-hours meeting is the last row of its day');
  const firstNextDay = seq.find(e => Math.floor(e.startCal) === 1);
  assert.ok(firstNextDay && firstNextDay.kind === 'task', 'next-day tasks still come after it');
  console.log('  8. post-hours meeting stays last on its day, not rolled to the next: PASS');
}

console.log('\nAll out-of-working-hours meeting tests passed!');
