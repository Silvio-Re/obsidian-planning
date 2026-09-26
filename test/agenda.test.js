// test/agenda.test.js — Today-agenda selection (src/agenda.js, pure module).
// The agenda is the dashboard's most actionable panel: exactly the scheduled
// tasks and meetings whose start falls on the schedule's reference day.
import assert from 'assert';
import { selectTodayAgenda } from '../src/agenda.js';

console.log('Testing agenda (selectTodayAgenda)...');

const row = (over) => Object.assign({ kind: 'task', startCal: 0 }, over);

// --- 1. Inclusion window: whole-day part of startCal is 0 ---
{
  const seq = [
    row({ startCal: 0 }),        // exactly midnight Monday (task starts today)
    row({ startCal: 0.25 }),     // 11:00 today
    row({ startCal: 0.9 }),      // 16:40 today, still before 17:00 end-of-day
    row({ startCal: 0.999 }),    // starts at 16:59 today
  ];
  const out = selectTodayAgenda(seq);
  assert.strictEqual(out.length, 4, 'all [0,1) starts included');
}

// --- 2. Exclusions: other days and pre-today entries ---
{
  const seq = [
    row({ startCal: 1.25 }),     // tomorrow 11:00
    row({ startCal: 1 }),       // exactly next midnight
    row({ startCal: 2.5 }),     // day after
    row({ startCal: -0.125 }),   // before today (e.g. clamped early meeting)
    row({ startCal: -1 }),
  ];
  assert.strictEqual(selectTodayAgenda(seq).length, 0, 'no out-of-window starts');
}

// --- 3. Meetings included exactly like tasks (kind is irrelevant to the filter) ---
{
  const seq = [
    row({ kind: 'meet', startCal: 0.5 }),
    row({ kind: 'meet', startCal: 0.0 }),
    row({ kind: 'meet', startCal: 1.1 }),
  ];
  const out = selectTodayAgenda(seq);
  assert.strictEqual(out.length, 2, 'today meetings included, tomorrow excluded');
  assert.ok(out.every(e => e.kind === 'meet'), 'meeting rows preserved');
}

// --- 4. A segment starting today that spills past 17:00 still belongs to today ---
{
  const seq = [row({ startCal: 0.9, endCal: 1.05 })];
  const out = selectTodayAgenda(seq);
  assert.strictEqual(out.length, 1, 'spilling segment stays on today');
  assert.strictEqual(out[0].endCal, 1.05, 'end unchanged by the selector');
}

// --- 5. Empty sequence ---
{
  assert.deepStrictEqual(selectTodayAgenda([]), [], 'empty seq yields empty agenda');
}

// --- 6. Order preserved (buildExecutionSequence sorts by startCal already) ---
{
  const seq = [
    row({ startCal: 0.75 }),
    row({ startCal: 0.1 }),
    row({ kind: 'meet', startCal: 0.4 }),
  ];
  const out = selectTodayAgenda(seq);
  assert.deepStrictEqual(out.map(e => e.startCal), [0.75, 0.1, 0.4], 'input order kept');
}

console.log('  agenda: PASS');
console.log('\nAll agenda tests passed!');
process.exit(0);
