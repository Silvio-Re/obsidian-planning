import assert from 'assert';
import { chargeableHours } from '../src/parser.js';

console.log('Testing chargeableHours...');

// Helper: create a node with text and optional subtasks
function mkNode(text, children = [], line = 0) {
  const n = { text, line };
  if (children.length) n.subtasks = children;
  return n;
}

// Helper: completed node (excluded)
function done(text, line = 0) {
  const n = { text, completed: true, status: 'x', line };
  return n;
}

// Helper: cancelled node (excluded)
function cancelled(text, line = 0) {
  const n = { text, completed: false, status: '-', line };
  return n;
}

// Single node, no subtasks
assert.strictEqual(chargeableHours(mkNode('(⏱:: 5h)'), 'a', new Set()), 5, 'single node 5h');
assert.strictEqual(chargeableHours(mkNode('(⏱:: 2.5h)'), 'b', new Set()), 2.5, 'single node 2.5h');

// Zero own duration defaults to 0.1h minimum
assert.strictEqual(chargeableHours(mkNode('no duration here'), 'c', new Set()), 0.1, 'zero duration => 0.1h minimum');

// Subtasks are included
const n2 = mkNode('(⏱:: 3h)', [mkNode('(⏱:: 2h)'), mkNode('(⏱:: 1h)')], 0);
assert.strictEqual(chargeableHours(n2, 'd', new Set()), 6, '3 + 2 + 1 = 6h');

// Nested subtasks
const n3 = mkNode('(⏱:: 1h)', [mkNode('(⏱:: 2h)', [mkNode('(⏱:: 3h)'), mkNode('(⏱:: 4h)')], 1)], 0);
assert.strictEqual(chargeableHours(n3, 'e', new Set()), 10, '1 + 2 + 3 + 4 = 10h');

// Completed subtasks excluded
const n4 = mkNode('(⏱:: 3h)', [mkNode('(⏱:: 2h)'), done('(⏱:: 5h)')], 0);
assert.strictEqual(chargeableHours(n4, 'f', new Set()), 5, '3 + 2 (completed 5 excluded) = 5h');

// Cancelled subtasks excluded
const n5 = mkNode('(⏱:: 3h)', [mkNode('(⏱:: 2h)'), cancelled('(⏱:: 10h)')], 0);
assert.strictEqual(chargeableHours(n5, 'g', new Set()), 5, '3 + 2 (cancelled 10 excluded) = 5h');

// Mix of complete, cancelled, and active
const n6 = mkNode('(⏱:: 1h)', [
  done('(⏱:: 3h)'),
  cancelled('(⏱:: 2h)'),
  mkNode('(⏱:: 4h)')
], 0);
assert.strictEqual(chargeableHours(n6, 'h', new Set()), 5, '1 + 4 = 5h (3+2 excluded)');

// markSet excludes subtasks already counted at parent level
const child = mkNode('(⏱:: 3h)', [], 1);
const parent = mkNode('(⏱:: 2h)', [child], 0);
const markSet1 = new Set(['top:1']);  // child's key
assert.strictEqual(chargeableHours(parent, 'top', markSet1), 2, 'child excluded by markSet = 2h');

// markSet excludes mid entirely (including its subtasks)
const grandchild = mkNode('(⏱:: 4h)', [], 2);
const grandchild2 = mkNode('(⏱:: 1h)', [], 3);
const mid = mkNode('(⏱:: 3h)', [grandchild, grandchild2], 1);
const top = mkNode('(⏱:: 2h)', [mid], 0);
const markSet2 = new Set(['top:1']);  // mid excluded → grandchildren never visited
assert.strictEqual(chargeableHours(top, 'top', markSet2), 2, 'top(2) + mid(excluded) = 2h');

// markSet only excludes grandchildren (mid counted)
const markSet3 = new Set(['top:2', 'top:3']);  // grandchild and grandchild2 excluded, mid NOT excluded
assert.strictEqual(chargeableHours(top, 'top', markSet3), 5, 'top(2) + mid(3) = 5h');

// Deep nested with markSet
const n8 = mkNode('(⏱:: 1h)', [
  mkNode('(⏱:: 2h)', [mkNode('(⏱:: 3h)')], 1),
  done('(⏱:: 99h)')
], 0);
assert.strictEqual(chargeableHours(n8, 'deep', new Set()), 6, '1 + 2 + 3 = 6h');

// No subtasks at all
assert.strictEqual(chargeableHours(mkNode('(⏱:: 7h)'), 'solo', new Set()), 7, 'no subtasks = 7h');

// Decimal hours
assert.strictEqual(chargeableHours(mkNode('(⏱:: 0.5h)'), 'small', new Set()), 0.5, '0.5h');
assert.strictEqual(chargeableHours(mkNode('(⏱:: 1.5h)'), 'half', new Set()), 1.5, '1.5h');

// Format without ::
const n9 = mkNode('⏱ 8h actual work', [], 0);
assert.strictEqual(chargeableHours(n9, 'fmt', new Set()), 8, '⏱ 8h format = 8h');

// Mixed formats in children
const n10 = mkNode('(⏱:: 2h)', [mkNode('⏱ 3h')], 0);
assert.strictEqual(chargeableHours(n10, 'mix', new Set()), 5, 'mixed formats: 2 + 3 = 5h');

console.log('  chargeableHours: PASS');

console.log('\nAll chargeable hours tests passed!');
process.exit(0);
