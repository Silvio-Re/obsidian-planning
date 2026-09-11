import assert from 'assert';
import { DateTime } from 'luxon';
import { buildGraph } from '../src/parser.js';

console.log('Testing buildGraph with real Luxon DateTime...\n');

// Helper: create a mock task entry (as produced by collectAll)
function taskEntry(id, deps, ownDL, graphDL, priority, key) {
  return { id, deps, ownDL, graphDL, priority, key, eff: null };
}

// --- dependents map ---

console.log('  Testing dependents map...');

const simpleA = taskEntry('A', [], null, null, 2, 'a:1');
const simpleB = taskEntry('B', ['A'], null, null, 2, 'b:1');
const tasks1 = [simpleA, simpleB];
const graph1 = buildGraph(tasks1);
assert.deepStrictEqual(graph1.dependents['A'], [tasks1[1]], 'A has dependent B');

const tasks2 = [
  taskEntry('X', [], null, null, 2, 'x:1'),
  taskEntry('Y', ['X'], null, null, 2, 'y:1'),
  taskEntry('Z', ['X'], null, null, 2, 'z:1'),
];
const graph2 = buildGraph(tasks2);
assert.deepStrictEqual(graph2.dependents['X'].map(t => t.key).sort(), ['y:1', 'z:1'], 'X has dependents Y and Z');

const tasks3 = [
  taskEntry('A', [], null, null, 2, 'a:1'),
  taskEntry('B', [], null, null, 2, 'b:1'),
];
const graph3 = buildGraph(tasks3);
assert.deepStrictEqual(graph3.dependents, {}, 'no deps => empty dependents map');

const tasks4 = [
  taskEntry('A', [], null, null, 2, 'a:1'),
  taskEntry('B', ['NONEXIST'], null, null, 2, 'b:1'),
];
const graph4 = buildGraph(tasks4);
assert.deepStrictEqual(graph4.dependents['NONEXIST'].map(t => t.key), ['b:1'], 'NONEXIST dep key exists');

console.log('    dependents: PASS');

// --- effective deadline propagation with real Luxon dates ---

console.log('  Testing effective deadline propagation...');

const dl1 = DateTime.fromISO('2024-01-15');
const tasks5 = [
  taskEntry('A', [], dl1, dl1, 2, 'a:1'),
  taskEntry('B', ['A'], null, dl1, 2, 'b:1'),
];
const graph5 = buildGraph(tasks5);
// A has dependents [B]. A's effectiveDL = min(A.ownDL, A.graphDL, B.graphDL) = Jan 15
assert.strictEqual(graph5.markSet.has('a:1'), true, 'A in markSet');
assert.strictEqual(graph5.markSet.has('b:1'), true, 'B in markSet');
assert.strictEqual(tasks5[0].eff.toISODate(), '2024-01-15', 'A eff deadline = Jan 15');
assert.strictEqual(tasks5[1].eff.toISODate(), '2024-01-15', 'B eff deadline = Jan 15');
console.log('    effective deadline propagation: PASS');

// Deadline propagation with tighter deadline on dependent
const dlA = DateTime.fromISO('2024-01-20');
const dlB = DateTime.fromISO('2024-01-10');
const tasks5b = [
  taskEntry('A', [], dlA, dlA, 2, 'a:1'),
  taskEntry('B', ['A'], null, dlB, 2, 'b:1'),
];
const graph5b = buildGraph(tasks5b);
// A has dependent B. A's effDL = min(Jan 20, Jan 20, Jan 10) = Jan 10 (pulled by B's deadline)
assert.strictEqual(tasks5b[0].eff.toISODate(), '2024-01-10', 'A eff deadline pulled to B\'s Jan 10');
assert.strictEqual(tasks5b[1].eff.toISODate(), '2024-01-10', 'B eff deadline = its own Jan 10');
console.log('    deadline propagation pulls tighter: PASS');

// --- markSet ---

console.log('  Testing markSet...');

const tasks6 = [
  taskEntry('A', [], DateTime.fromISO('2024-01-01'), DateTime.fromISO('2024-01-01'), 2, 'a:1'),
  taskEntry('B', [], null, null, 2, 'b:1'),
  taskEntry('C', ['A'], null, DateTime.fromISO('2024-01-10'), 2, 'c:1'),
];
const graph6 = buildGraph(tasks6);
assert(graph6.markSet.has('a:1'), 'A in markSet (has deadline)');
assert(graph6.markSet.has('c:1'), 'C in markSet (has graphDL)');
assert(!graph6.markSet.has('b:1'), 'B NOT in markSet (no deadline)');

const tasks7 = [taskEntry('A', [], null, null, 2, 'a:1')];
const graph7 = buildGraph(tasks7);
assert(!graph7.markSet.has('a:1'), 'A with no deadlines => not in markSet');

console.log('    markSet: PASS');

// --- effectivePriority ---

console.log('  Testing effectivePriority (priority inheritance)...');

const tasks8 = [
  taskEntry('A', [], null, null, 3, 'a:1'),  // P3
  taskEntry('B', ['A'], null, null, 1, 'b:1'),  // P1, depends on A
];
const graph8 = buildGraph(tasks8);
assert.strictEqual(tasks8[1].effPriority, 1, 'B effPriority = min(P1, P3) = 1');
assert.strictEqual(tasks8[0].effPriority, 3, 'A effPriority = 3 (no deps)');

const tasks9 = [
  taskEntry('A', [], null, null, 4, 'a:1'),  // P4
  taskEntry('B', ['A'], null, null, 2, 'b:1'),  // P2
  taskEntry('C', ['B'], null, null, 0, 'c:1'),  // P0
];
const graph9 = buildGraph(tasks9);
assert.strictEqual(tasks9[2].effPriority, 0, 'C effPriority = min(P0,P2,P4) = 0');
assert.strictEqual(tasks9[1].effPriority, 2, 'B effPriority = min(P2,P4) = 2');
assert.strictEqual(tasks9[0].effPriority, 4, 'A effPriority = P4 (no deps)');

const tasks8b = [
  taskEntry('HIGH', [], null, null, 0, 'h:1'),  // P0
  taskEntry('LOW', ['HIGH'], null, null, 4, 'l:1'),  // P4, depends on P0
];
buildGraph(tasks8b);
assert.strictEqual(tasks8b[1].effPriority, 0, 'P4 task depending on P0 => effPriority = 0');

console.log('    effectivePriority: PASS');

// --- edge cases ---

console.log('  Testing edge cases...');

const tasks10 = [
  taskEntry('A', ['A'], DateTime.fromISO('2024-01-01'), DateTime.fromISO('2024-01-01'), 2, 'a:1'),
];
const graph10 = buildGraph(tasks10);
assert(graph10.markSet.has('a:1'), 'self-dep still in markSet');

const tasks11 = [
  taskEntry('X', [], null, null, 2, 'x:1'),
  taskEntry('Y', ['X', 'X'], null, null, 2, 'y:1'),
];
const graph11 = buildGraph(tasks11);
assert.deepStrictEqual(graph11.dependents['X'].map(t => t.key), ['y:1', 'y:1'], 'duplicate dep');

const d1 = DateTime.fromISO('2024-01-10');
const tasks12 = [
  taskEntry('A', [], d1, d1, 4, 'a:1'),
  taskEntry('B', ['A'], d1, d1, 3, 'b:1'),
  taskEntry('C', ['A'], d1, d1, 2, 'c:1'),
  taskEntry('D', ['B', 'C'], d1, d1, 1, 'd:1'),
];
const graph12 = buildGraph(tasks12);
assert(graph12.markSet.size === 4, 'diamond: all 4 in markSet');
assert.deepStrictEqual(graph12.dependents['A'].map(t => t.key).sort(), ['b:1', 'c:1'], 'A dep by B, C');
assert.deepStrictEqual(graph12.dependents['B'].map(t => t.key), ['d:1'], 'B dep by D');
assert.deepStrictEqual(graph12.dependents['C'].map(t => t.key), ['d:1'], 'C dep by D');

console.log('    edge cases: PASS');

console.log('\nAll graph tests passed!');
process.exit(0);
