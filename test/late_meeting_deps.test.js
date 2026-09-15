import assert from 'assert';
import { DateTime } from 'luxon';
import { computeSchedule } from '../src/scheduler.js';

// A meeting (lock) is a fixed block and cannot itself be late. But if a task
// that must be performed BEFORE the meeting (one of the meeting's deps) is
// late, the meeting must be flagged `displayLate` so the UI highlights it like
// a late task. This suite exercises computeSchedule's displayLate logic.

console.log('Testing meeting displayLate (late prerequisite tasks)\n');

const today = DateTime.fromISO('2025-01-20'); // Monday
const SCHEDULE = { startHour: 9, hoursPerDay: 8 };

// Helper: a task that WILL be late (deadline today but needs a full extra day)
function lateTask(id) {
  return { id, deps: [], deadline: today, duration: 10, title: `Late ${id}`, path: id, line: 1, file: id, priority: 2 };
}
// Helper: a task that stays on time
function onTimeTask(id, daysOut = 5) {
  return { id, deps: [], deadline: today.plus({ days: daysOut }), duration: 2, title: `On ${id}`, path: id, line: 1, file: id, priority: 2 };
}
// Helper: a meeting lock
function meet(id, deps, day = today, hour = 14) {
  return { day, hour, min: 0, hours: 1, title: `Meet ${id}`, path: id, line: 1, file: id, id, deps };
}

function findMeet(result, id) {
  return result.meetData.find(m => m.id === id);
}

// 1. Meeting whose only prerequisite is LATE -> displayLate true
{
  const sched = computeSchedule([lateTask('A')], [meet('M', ['A'])], today, SCHEDULE);
  const a = sched.sched.find(s => s.id === 'A');
  const m = findMeet(sched, 'M');
  assert.strictEqual(a.late, true, 'prereq A is genuinely late');
  assert.strictEqual(m.displayLate, true, 'meeting M flagged late when prereq is late');
  console.log('  1. late prereq -> meeting displayLate: PASS');
}

// 2. Meeting whose prerequisite is on-time -> displayLate false
{
  const sched = computeSchedule([onTimeTask('A')], [meet('M', ['A'])], today, SCHEDULE);
  const a = sched.sched.find(s => s.id === 'A');
  const m = findMeet(sched, 'M');
  assert.strictEqual(a.late, false, 'prereq A on time');
  assert.strictEqual(m.displayLate, false, 'meeting not flagged when prereq on time');
  console.log('  2. on-time prereq -> not late: PASS');
}

// 3. Meeting with no prerequisites -> displayLate false
{
  const sched = computeSchedule([onTimeTask('A')], [meet('M', [])], today, SCHEDULE);
  const m = findMeet(sched, 'M');
  assert.strictEqual(m.displayLate, false, 'no deps -> never late');
  console.log('  3. no deps -> not late: PASS');
}

// 4. Meeting with several prerequisites, at least one LATE -> displayLate true
{
  const sched = computeSchedule([lateTask('A'), onTimeTask('B'), lateTask('C')], [meet('M', ['A', 'B', 'C'])], today, SCHEDULE);
  const m = findMeet(sched, 'M');
  assert.strictEqual(m.displayLate, true, 'any late prereq flags the meeting');
  console.log('  4. one late among many -> meeting late: PASS');
}

// 5. Meeting depends on an id that is not in the schedule -> not counted
{
  const sched = computeSchedule([onTimeTask('A')], [meet('M', ['ghost'])], today, SCHEDULE);
  const m = findMeet(sched, 'M');
  assert.strictEqual(m.displayLate, false, 'unsatisfiable/unknown prereq does not flag late');
  console.log('  5. unknown prereq -> not late: PASS');
}

// 6. displayLate is set on the original lock objects returned by computeSchedule
{
  const locks = [meet('M', ['A'])];
  const sched = computeSchedule([lateTask('A')], locks, today, SCHEDULE);
  assert.strictEqual(sched.meetData, locks, 'meetData is the same lock array');
  assert.strictEqual(locks[0].displayLate, true, 'original lock object mutated with displayLate');
  console.log('  6. flag lives on returned lock objects: PASS');
}

console.log('\nAll late-meeting-dependency tests passed!');
process.exit(0);
