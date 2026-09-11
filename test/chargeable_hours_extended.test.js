import assert from 'assert';
import { chargeableHours } from '../src/parser.js';

console.log('Testing chargeableHours with hierarchical task structures...');

const PATH = 'Projets/Autre/Autre.md';
const NO_MARK_SET = new Set();

console.log('  Testing multi-level nesting...');

// Parent with own duration, child with duration, child without duration (→ minimum 0.1)
const child1 = { line: 5, text: "Comander des cartouches 📅 2026-09-14", subtasks: [], completed: false, status: ' ' };
const child2 = { line: 6, text: "bûcher (puissance durée...) ⏱ 2h", subtasks: [], completed: false, status: ' ' };
const parent1 = { line: 3, text: "Devis insitu 📅 2026-09-14 🔺   ⏱ 3h ", subtasks: [child1, child2], completed: false, status: ' ' };

assert.strictEqual(chargeableHours(parent1, PATH, NO_MARK_SET), 5.1, 'parent 3h + child(no dur→0.1) + child 2h = 5.1h');

// Parent has own duration, child has duration, grandchildren no duration (→ each 0.1)
const grandchild1 = { line: 10, text: "train", subtasks: [], completed: false, status: ' ' };
const grandchild2 = { line: 11, text: "hotel", subtasks: [], completed: false, status: ' ' };
const child3 = { line: 8, text: "prépa déplacement 📅 2026-09-17 ⏱ 1h", subtasks: [grandchild1, grandchild2], completed: false, status: ' ' };
const parent2 = { line: 4, text: "Épernon maj du système dic📅 2026-09-24 9:00 (⏱:: 8h)", subtasks: [child3], completed: false, status: ' ' };

assert.strictEqual(chargeableHours(parent2, PATH, NO_MARK_SET), 9.2, 'parent 8h + child 1h + grandchild1(0.1) + grandchild2(0.1) = 9.2h');

console.log('    multi-level nesting: PASS');

console.log('  Testing mixed completion...');

// Child marked completed [x] should be excluded
const completedChild = { line: 15, text: "trains ✅ 2026-09-04", subtasks: [], completed: true, status: 'x' };
const activeChild = { line: 16, text: "voiture ⏱ 0.5h", subtasks: [], completed: false, status: ' ' };
const parent3 = { line: 14, text: "prévoir le déplacement 📅 [[2026-09-03]] (⏱:: 1h)", subtasks: [completedChild, activeChild], completed: false, status: ' ' };

assert.strictEqual(chargeableHours(parent3, PATH, NO_MARK_SET), 1.5, 'parent 1h + active child 0.5h (completed excluded)');

// All children completed — only parent counts
const allDone = [
  { line: 20, text: "trains ✅ 2026-09-04", subtasks: [], completed: true, status: 'x' },
  { line: 21, text: "hotel ✅ 2026-09-04", subtasks: [], completed: true, status: 'x' },
  { line: 22, text: "voiture ✅ 2026-09-04", subtasks: [], completed: true, status: 'x' },
];
const parent4 = { line: 19, text: "prévoir le déplacement 📅 [[2026-09-03]] (⏱:: 1h)", subtasks: allDone, completed: false, status: ' ' };
assert.strictEqual(chargeableHours(parent4, PATH, NO_MARK_SET), 1, 'parent 1h, all children completed = 1h');

console.log('    mixed completion: PASS');

console.log('  Testing circular key detection via markSet...');

// markSet includes childDup's key — that subtask should be excluded
const grandchildDup = { line: 30, text: "test dup ⏱ 1h", subtasks: [], completed: false, status: ' ' };
const childDup = { line: 28, text: "prépa ⏱ 1h", subtasks: [grandchildDup], completed: false, status: ' ' };
const parentDup = { line: 27, text: "task parent ⏱ 2h", subtasks: [childDup], completed: false, status: ' ' };

// Without markSet exclusion: parent 2h + child 1h + grandchild 1h = 4h
assert.strictEqual(chargeableHours(parentDup, PATH, NO_MARK_SET), 4, 'hierarchy without markSet = 2+1+1');

// markSet excludes childDup — parent 2h only (grandchild also excluded as child's subtask)
const markSet = new Set([`${PATH}:28`]);
assert.strictEqual(chargeableHours(parentDup, PATH, markSet), 2, 'markSet excludes child+grandchild = 2+0+0');

console.log('    circular key detection: PASS');

console.log('  Testing grandchild-only duration...');

const greatGrandchild = { line: 50, text: "train 📅 2026-09-17 ⏱ 1h", subtasks: [], completed: false, status: ' ' };
const grandchildNoDur = { line: 48, text: "hotel", subtasks: [greatGrandchild], completed: false, status: ' ' };
const childNoDur = { line: 45, text: "prépa déplacement 📅 2026-09-17 ⏱ 1h", subtasks: [grandchildNoDur], completed: false, status: ' ' };
const parentNoDur = { line: 44, text: "Épernon 📅 2026-09-24 9:00 (⏱:: 8h)", subtasks: [childNoDur], completed: false, status: ' ' };

assert.strictEqual(chargeableHours(parentNoDur, PATH, NO_MARK_SET), 10, 'parent 8h + child 1h + grandchild 1h(gg 1h) + gg 1h = 10h');

// Parent has no duration, only deep grandchild has one
const deepParent = {
  line: 60, text: "no duration parent",
  subtasks: [
    { line: 61, text: "child no dur", subtasks: [
      { line: 62, text: "grandchild ⏱ 3h", subtasks: [] }
    ]}
  ],
  completed: false, status: ' '
};
assert.strictEqual(chargeableHours(deepParent, PATH, NO_MARK_SET), 3, 'deep: parent 0 + child 3h(grandchild) = 3h');

console.log('    grandchild-only duration: PASS');

console.log('  Testing zero-duration parent with positive subtasks...');

const zeroParent = {
  line: 70, text: "(⏱:: 0h)",
  subtasks: [
    { line: 71, text: "subtask 1 ⏱ 1.5h", subtasks: [] },
    { line: 72, text: "subtask 2 ⏱ 2.5h", subtasks: [] }
  ],
  completed: false, status: ' '
};
assert.strictEqual(chargeableHours(zeroParent, PATH, NO_MARK_SET), 4, 'zero parent + 1.5h + 2.5h subtasks = 4h');

console.log('  Testing no subtasks...');

const noSubtasks = { line: 80, text: "standalone ⏱ 2h", subtasks: [], completed: false, status: ' ' };
assert.strictEqual(chargeableHours(noSubtasks, PATH, NO_MARK_SET), 2, 'no subtasks = just own duration');

console.log('    no subtasks: PASS');

console.log('  Testing zero-duration with no subtasks returns minimum 0.1...');

const zeroOnly = { line: 90, text: "no duration task", subtasks: [], completed: false, status: ' ' };
assert.strictEqual(chargeableHours(zeroOnly, PATH, NO_MARK_SET), 0.1, 'zero duration → minimum 0.1h');

console.log('    zero-duration minimum: PASS');

console.log('\nAll chargeable hours extended tests passed!');
process.exit(0);
