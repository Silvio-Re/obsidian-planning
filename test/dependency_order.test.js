import assert from 'assert';
import { DateTime } from 'luxon';
import { computeSchedule } from '../src/scheduler.js';

console.log('Testing dependency order enforcement...\n');

const today = DateTime.fromISO('2025-01-20'); // Monday
const SCHEDULE = { startHour: 9, hoursPerDay: 8 };

// Test 1: Dependent has earlier deadline → EDF would place it first
// A (dep) has a LATER deadline, B (dependent) has an EARLIER deadline
// Without dependency enforcement, B gets scheduled before A (wrong!)
// With dependency enforcement, A must come before B
console.log('Test 1: Dependent with earlier deadline');

const items1 = [
  {
    id: 'A',
    deps: [],
    deadline: DateTime.fromISO('2025-01-27'),   // Jan 27 (later)
    duration: 4,
    title: 'Task A (dependency)',
    path: 'a', line: 1, file: 'a', priority: 2
  },
  {
    id: 'B',
    deps: ['A'],  // B depends on A
    deadline: DateTime.fromISO('2025-01-22'),   // Jan 22 (earlier)
    duration: 4,
    title: 'Task B (dependent on A)',
    path: 'b', line: 1, file: 'b', priority: 2
  }
];

const sched1 = computeSchedule(items1, [], today, SCHEDULE);
const taskA = sched1.sched.find(s => s.id === 'A');
const taskB = sched1.sched.find(s => s.id === 'B');

assert.ok(taskA, 'Task A was scheduled');
assert.ok(taskB, 'Task B was scheduled');

console.log(`  A: start=${taskA.startCal.toFixed(2)} (${today.plus({ days: Math.floor(taskA.startCal) }).toFormat('ccc dd LLL')}) end=${taskA.endCal.toFixed(2)}`);
console.log(`  B: start=${taskB.startCal.toFixed(2)} (${today.plus({ days: Math.floor(taskB.startCal) }).toFormat('ccc dd LLL')}) end=${taskB.endCal.toFixed(2)}`);

if (taskA.startCal < taskB.startCal) {
  console.log('  ✓ A scheduled before B (dependency respected)');
} else {
  console.log('  ✗ B scheduled before A (DEPENDENCY VIOLATED!)');
  console.log(`    A starts at day ${taskA.startCal.toFixed(2)}, B starts at day ${taskB.startCal.toFixed(2)}`);
  assert.fail('Dependency B→A: B runs before A');
}

// Test 2: Both have same deadline, different priorities
// B (dependent on A) has same deadline but higher priority
// EDF tie-breaks by duration (longer first), but priority doesn't matter for ordering here
console.log('\nTest 2: Same deadline, dependent should still follow dependency');

const items2 = [
  {
    id: 'A',
    deps: [],
    deadline: DateTime.fromISO('2025-01-27'),
    duration: 2,
    title: 'Task A',
    path: 'a', line: 1, file: 'a', priority: 3
  },
  {
    id: 'B',
    deps: ['A'],
    deadline: DateTime.fromISO('2025-01-27'),
    duration: 1,
    title: 'Task B',
    path: 'b', line: 1, file: 'b', priority: 1
  }
];

const sched2 = computeSchedule(items2, [], today, SCHEDULE);
const taskA2 = sched2.sched.find(s => s.id === 'A');
const taskB2 = sched2.sched.find(s => s.id === 'B');

console.log(`  A: start=${taskA2.startCal.toFixed(2)} (${today.plus({ days: Math.floor(taskA2.startCal) }).toFormat('ccc dd LLL')}) end=${taskA2.endCal.toFixed(2)}`);
console.log(`  B: start=${taskB2.startCal.toFixed(2)} (${today.plus({ days: Math.floor(taskB2.startCal) }).toFormat('ccc dd LLL')}) end=${taskB2.endCal.toFixed(2)}`);

// EDF sorts by deadline (same) then duration (longer first)
// A (2h) should be first because of duration tie-breaker — this works by coincidence
if (taskA2.startCal < taskB2.startCal) {
  console.log('  ✓ A before B (duration tie-break helped, but not guaranteed)');
  // But verify it's due to duration, not deps
  assert.strictEqual(taskA2.duration, 2, 'A is longer');
  assert.strictEqual(taskB2.duration, 1, 'B is shorter');
  console.log('    (This result is from the duration tie-breaker, not dependency enforcement)');
} else {
  console.log('  ✗ B before A (dependency violated)');
  assert.fail('Dependency B→A: B runs before A');
}

// Test 3: Chain of 3 — A→B→C, where C has the earliest deadline
// If dependencies are ignored, EDF could place C, B, A (all reversed)
console.log('\nTest 3: Chain A→B→C, C has earliest deadline');

const items3 = [
  {
    id: 'A',
    deps: [],
    deadline: DateTime.fromISO('2025-01-28'),
    duration: 1,
    title: 'Task A (root)',
    path: 'a', line: 1, file: 'a', priority: 2
  },
  {
    id: 'B',
    deps: ['A'],
    deadline: DateTime.fromISO('2025-01-27'),
    duration: 1,
    title: 'Task B (depends on A)',
    path: 'b', line: 1, file: 'b', priority: 2
  },
  {
    id: 'C',
    deps: ['B'],
    deadline: DateTime.fromISO('2025-01-26'),
    duration: 1,
    title: 'Task C (depends on B, depends on A)',
    path: 'c', line: 1, file: 'c', priority: 2
  }
];

const sched3 = computeSchedule(items3, [], today, SCHEDULE);
const taskA3 = sched3.sched.find(s => s.id === 'A');
const taskB3 = sched3.sched.find(s => s.id === 'B');
const taskC3 = sched3.sched.find(s => s.id === 'C');

console.log(`  A: start=${taskA3.startCal.toFixed(2)} end=${taskA3.endCal.toFixed(2)}`);
console.log(`  B: start=${taskB3.startCal.toFixed(2)} end=${taskB3.endCal.toFixed(2)}`);
console.log(`  C: start=${taskC3.startCal.toFixed(2)} end=${taskC3.endCal.toFixed(2)}`);

const correctOrder = taskA3.startCal < taskB3.startCal && taskB3.startCal < taskC3.startCal;
if (correctOrder) {
  console.log('  ✓ Chain order A→B→C respected');
} else {
  console.log('  ✗ Chain order VIOLATED');
  console.log(`    Expected: A < B < C`);
  console.log(`    Got: A(${taskA3.startCal.toFixed(2)}) B(${taskB3.startCal.toFixed(2)}) C(${taskC3.startCal.toFixed(2)})`);
  if (!correctOrder) assert.fail('Chain A→B→C not respected');
}

// Test 4: Two independent chains with interleaved deadlines
// Chain 1: A1→A2 (A2 has later deadline)
// Chain 2: B1→B2 (B2 has earlier deadline)
// B2's early deadline means B1 gets scheduled early too, but A2 gets deferred
// The question: does B1 come before A2 even though A2 is in a different chain?
console.log('\nTest 4: Interleaved chains with mixed deadlines');

const items4 = [
  {
    id: 'A1',
    deps: [],
    deadline: DateTime.fromISO('2025-01-25'),
    duration: 4,
    title: 'A1 (chain 1)',
    path: 'a1', line: 1, file: 'a1', priority: 2
  },
  {
    id: 'A2',
    deps: ['A1'],
    deadline: DateTime.fromISO('2025-01-28'),
    duration: 4,
    title: 'A2 (chain 1, depends on A1)',
    path: 'a2', line: 1, file: 'a2', priority: 2
  },
  {
    id: 'B1',
    deps: [],
    deadline: DateTime.fromISO('2025-01-23'),
    duration: 4,
    title: 'B1 (chain 2)',
    path: 'b1', line: 1, file: 'b1', priority: 2
  },
  {
    id: 'B2',
    deps: ['B1'],
    deadline: DateTime.fromISO('2025-01-24'),
    duration: 4,
    title: 'B2 (chain 2, depends on B1)',
    path: 'b2', line: 1, file: 'b2', priority: 2
  }
];

const sched4 = computeSchedule(items4, [], today, SCHEDULE);
const tA1 = sched4.sched.find(s => s.id === 'A1');
const tA2 = sched4.sched.find(s => s.id === 'A2');
const tB1 = sched4.sched.find(s => s.id === 'B1');
const tB2 = sched4.sched.find(s => s.id === 'B2');

console.log(`  A1: start=${tA1.startCal.toFixed(2)} end=${tA1.endCal.toFixed(2)}`);
console.log(`  A2: start=${tA2.startCal.toFixed(2)} end=${tA2.endCal.toFixed(2)}`);
console.log(`  B1: start=${tB1.startCal.toFixed(2)} end=${tB1.endCal.toFixed(2)}`);
console.log(`  B2: start=${tB2.startCal.toFixed(2)} end=${tB2.endCal.toFixed(2)}`);

// Chain order within each chain
const chain1OK = tA1.startCal < tA2.startCal;
const chain2OK = tB1.startCal < tB2.startCal;

console.log(`  Chain 1 (A1→A2): ${chain1OK ? '✓' : '✗'}`);
console.log(`  Chain 2 (B1→B2): ${chain2OK ? '✓' : '✗'}`);

if (!chain1OK || !chain2OK) {
  assert.fail('Chain order violated');
}

// Test 5: Reversed input order — chain C→B→A fed as [C, B, A]
// The ready-check matches deps (ids) against the scheduled set, so a dep-having
// task must never fall through to the cycle fallback (which ignores EDF).
// This regressed when `scheduled` only held "path:line" keys: deps are ids.
console.log('\nTest 5: Reversed chain in input order [C, B, A]');
const items5 = [
  {
    id: 'C5',
    deps: ['B5'],
    deadline: DateTime.fromISO('2025-01-27'),
    duration: 2,
    title: 'Task C (depends on B)',
    path: 'c5', line: 1, file: 'c5', priority: 2
  },
  {
    id: 'B5',
    deps: ['A5'],
    deadline: DateTime.fromISO('2025-01-27'),
    duration: 2,
    title: 'Task B (depends on A)',
    path: 'b5', line: 1, file: 'b5', priority: 2
  },
  {
    id: 'A5',
    deps: [],
    deadline: DateTime.fromISO('2025-01-27'),
    duration: 2,
    title: 'Task A (root)',
    path: 'a5', line: 1, file: 'a5', priority: 2
  }
];
const sched5 = computeSchedule(items5, [], today, SCHEDULE);
const tA5 = sched5.sched.find(s => s.id === 'A5');
const tB5 = sched5.sched.find(s => s.id === 'B5');
const tC5 = sched5.sched.find(s => s.id === 'C5');
console.log(`  A: start=${tA5.startCal.toFixed(2)} | B: start=${tB5.startCal.toFixed(2)} | C: start=${tC5.startCal.toFixed(2)}`);
const reversedOK = tA5.startCal < tB5.startCal && tB5.startCal < tC5.startCal;
if (reversedOK) {
  console.log('  ✓ Chain order A→B→C respected regardless of input order');
} else {
  console.log('  ✗ Chain order VIOLATED (fallback path took over)');
  assert.fail('Reversed chain C,B,A not respected');
}

// Test 6: EDF must not be discarded for dep-having tasks — a dependent with the
// earliest deadline must run before an unrelated task with a later deadline.
// Regressed for the same reason as Test 5 (deps never matched scheduled keys,
// so every dep-having task used the deadline-blind fallback).
console.log('\nTest 6: Dependent with earliest deadline beats unrelated later task');
const items6 = [
  {
    id: 'A6',
    deps: [],
    deadline: DateTime.fromISO('2025-01-21'), // tomorrow — earliest
    duration: 2,
    title: 'Task A (dep root)',
    path: 'a6', line: 1, file: 'a6', priority: 2
  },
  {
    id: 'B6',
    deps: ['A6'],
    deadline: DateTime.fromISO('2025-01-21'), // inherited early deadline
    duration: 2,
    title: 'Task B (depends on A)',
    path: 'b6', line: 1, file: 'b6', priority: 2
  },
  {
    id: null,
    deps: [],
    deadline: DateTime.fromISO('2025-01-31'), // much later, no deps
    duration: 2,
    title: 'Task D (unrelated, later deadline)',
    path: 'd6', line: 1, file: 'd6', priority: 2
  }
];
const sched6 = computeSchedule(items6, [], today, SCHEDULE);
const tA6 = sched6.sched.find(s => s.id === 'A6');
const tB6 = sched6.sched.find(s => s.id === 'B6');
const tD6 = sched6.sched.find(s => s.id == null && s.path === 'd6');
console.log(`  A: start=${tA6.startCal.toFixed(2)} | B: start=${tB6.startCal.toFixed(2)} | D: start=${tD6.startCal.toFixed(2)}`);
const edfOK = tA6.startCal < tD6.startCal && tB6.startCal < tD6.startCal;
if (edfOK) {
  console.log('  ✓ Both chain tasks run before the unrelated later-deadline task');
} else {
  console.log('  ✗ Unrelated later-deadline task ran before a dep-having urgent task');
  assert.fail('EDF order discarded for dep-having tasks');
}

// Summary
console.log('\n===================================');
if (chain1OK && chain2OK && correctOrder && reversedOK && edfOK) {
  console.log('All dependency ordering tests passed');
  console.log('Note: some pass by coincidence (duration tie-break) not enforcement');
}
console.log('===================================');

process.exit(0);
