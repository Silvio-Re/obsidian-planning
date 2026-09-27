// test/risk.test.js — at-risk slack computation (src/risk.js, pure module).
// Slack = working capacity between a task's scheduled finish and its deadline,
// minus the duration of every other task that finishes after it but shares or
// precedes that deadline. At risk = positive slack below a quarter working day.
import assert from 'assert';
import { DateTime } from 'luxon';
import { computeSlack, computeAtRisk } from '../src/risk.js';

console.log('Testing risk (computeSlack, computeAtRisk)...');

const today = DateTime.fromISO('2026-09-14'); // Monday
const SCHEDULE = { startHour: 9, hoursPerDay: 8 };
// Five consecutive workdays: Mon 14 .. Fri 18
const workDays = [0, 1, 2, 3, 4].map(i => today.plus({ days: i }));
const meetIv = {}; // no meetings

const task = (over) => Object.assign({
  duration: 2, endCal: 0.25, dlIdx: 2, late: false,
  path: 'P.md', line: 1, file: 'P.md', title: 'T',
  deadline: today.plus({ days: 2 }),
}, over);

// --- 1. Full-day slack: task finishes 0.25, deadline day 2 → 1.75 days free ---
{
  const slacked = computeSlack([task({})], workDays, meetIv, SCHEDULE, today);
  assert.strictEqual(slacked.length, 1);
  // window (0.25, 2]: days 0 overlap 0.75 + day 1 full 1.0 = 1.75 cal → 14h
  assert.ok(Math.abs(slacked[0].slackHours - 14) < 1e-9, 'slack is capacity window × hoursPerDay, got ' + slacked[0].slackHours);
  assert.strictEqual(computeAtRisk(slacked, SCHEDULE).length, 0, 'comfortable slack is not at risk');
  console.log('  window capacity computed exactly: PASS');
}

// --- 2. Competing work consumes slack ---
{
  // t1 finishes at 0.25, due day 2. t2 (3h) finishes after t1, also due day 2.
  const slacked = computeSlack([
    task({ title: 't1' }),
    task({ title: 't2', duration: 3, endCal: 1.5, line: 2 }),
  ], workDays, meetIv, SCHEDULE, today);
  const t1 = slacked.find(t => t.title === 't1');
  assert.ok(Math.abs(t1.slackHours - (14 - 3)) < 1e-9, 'competing duration subtracted');
  console.log('  competing demand subtracted: PASS');
}

// --- 3. At-risk: small positive slack flagged; late tasks excluded ---
{
  // t finishes 0.25 into day 0, deadline at day 0 midnight (dlIdx 0) → on time
  // with 0.75 cal = 6h slack... make it tighter: finish 0.9, dlIdx 1 → 0.1 + 1 = 1.1 cal = 8.8h.
  // Tighter still: finish 0.75 day0, dlIdx 0.8? dlIdx is day-midnight, so minimum positive
  // slack is bounded by the day. Use a meeting eating the free window instead.
  const meetIv2 = { 0: [{ s: 0.4, e: 1 }] }; // afternoon meeting on day 0
  const slacked = computeSlack([task({ endCal: 0.25, dlIdx: 1 })], workDays, meetIv2, SCHEDULE, today);
  // window (0.25, 1]: day 0 free 0.25..0.4 = 0.15 cal → 1.2h slack → at risk (< 2h threshold)
  assert.ok(Math.abs(slacked[0].slackHours - 1.2) < 1e-9, 'meeting reduces slack, got ' + slacked[0].slackHours);
  const risky = computeAtRisk(slacked, SCHEDULE);
  assert.strictEqual(risky.length, 1, 'thin positive slack flagged at risk');
  console.log('  thin slack flagged at risk: PASS');
}

// --- 4. Late tasks never appear in the at-risk list ---
{
  const slacked = computeSlack([task({ late: true, endCal: 3, dlIdx: 2 })], workDays, meetIv, SCHEDULE, today);
  assert.strictEqual(computeAtRisk(slacked, SCHEDULE).length, 0, 'late task not double-reported');
  console.log('  late tasks excluded: PASS');
}

// --- 5. Tasks with earlier deadlines do not eat a later task's slack ---
{
  // t1 due day 1 finishes day 1; t2 due day 3 finishes day 2. t1's deadline < t2's,
  // but t1 finishes BEFORE t2, so it does not compete for t2's post-finish window.
  const slacked = computeSlack([
    task({ title: 'early', endCal: 1.25, dlIdx: 1 }),
    task({ title: 'later', endCal: 2.25, dlIdx: 3, line: 2 }),
  ], workDays, meetIv, SCHEDULE, today);
  const later = slacked.find(t => t.title === 'later');
  // window (2.25, 3]: day 2 remaining 0.75 + day 3 full 1.0... wait dlIdx 3 means deadline
  // midnight of day 3, so window (2.25, 3] = 0.75 of day 2 = 6h.
  assert.ok(Math.abs(later.slackHours - 6) < 1e-9, 'only same-window competitors counted, got ' + later.slackHours);
  console.log('  earlier-deadline tasks do not compete: PASS');
}

// --- 5b. A late sibling sharing the deadline must NOT eat an on-time task's slack ---
{
  const slacked = computeSlack([
    task({ title: 'onTime', endCal: 1.0, dlIdx: 2 }),
    task({ title: 'late', endCal: 2.5, dlIdx: 2, late: true, line: 2 }),
  ], workDays, meetIv, SCHEDULE, today);
  const onTime = slacked.find(t => t.title === 'onTime');
  // window (1, 2] = 1 cal = 8h; the late sibling (4h... use duration 4) must not subtract.
  assert.ok(Math.abs(onTime.slackHours - 8) < 1e-9,
    'late sibling excluded from competing, got ' + onTime.slackHours);
  console.log('  late siblings excluded from slack: PASS');
}

// --- 6. At-risk sorted worst first ---
{
  const slacked = [
    { late: false, slackHours: 1.5, duration: 2 },
    { late: false, slackHours: 0.5, duration: 2 },
    { late: false, slackHours: 1.0, duration: 2 },
  ];
  const risky = computeAtRisk(slacked, SCHEDULE);
  assert.deepStrictEqual(risky.map(t => t.slackHours), [0.5, 1.0, 1.5], 'sorted ascending');
  console.log('  worst first: PASS');
}

console.log('  risk: PASS');
console.log('\nAll risk tests passed!');
process.exit(0);
