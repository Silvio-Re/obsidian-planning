import assert from 'assert';
import { buildGraph } from '../src/parser.js';

console.log('Testing buildGraph with realistic dependency chains...');

function makeTask(key, ownDL, id, deps, graphDL) {
  return {
    key, path: key.split(':')[0], line: parseInt(key.split(':')[1]),
    ownDL, id, deps: deps || [], graphDL,
    node: { line: parseInt(key.split(':')[1]), text: '' },
    title: `Task ${key}`, priority: 2, isIndented: false
  };
}

console.log('  Testing single dependency chain...');

const taskA = makeTask('proj/A:1', null, 'taskA', ['taskB'], new Date('2026-10-10'));
const taskB = makeTask('proj/B:2', new Date('2026-10-05'), 'taskB', [], new Date('2026-10-05'));
const taskC = makeTask('proj/C:3', new Date('2026-10-01'), 'taskC', [], new Date('2026-10-01'));
const items1 = [taskA, taskB, taskC];

const graph1 = buildGraph(items1);

assert.strictEqual(graph1.dependents.taskB.length, 1, 'taskA depends on taskB');
assert.strictEqual(graph1.dependents.taskB[0].id, 'taskA', 'taskB dep points to taskA');
assert.strictEqual(graph1.dependents.taskB[0].key, 'proj/A:1', 'correct key for dependent');

// eff should be set
assert.ok(taskA.eff !== undefined, 'A has eff deadline computed');
assert.ok(taskB.eff !== undefined, 'B has eff deadline computed');

console.log('    single dependency chain: PASS');

console.log('  Testing chained dependencies A→B→C...');

const cTask = makeTask('proj/C:10', new Date('2026-09-15'), 'depC', [], new Date('2026-09-15'));
const bTask = makeTask('proj/B:11', new Date('2026-09-20'), 'depB', ['depC'], new Date('2026-09-20'));
const aTask = makeTask('proj/A:12', null, 'depA', ['depB'], new Date(null));
const items2 = [aTask, bTask, cTask];

const graph2 = buildGraph(items2);

assert.deepStrictEqual(aTask.deps, ['depB'], 'A depends on B');
assert.deepStrictEqual(bTask.deps, ['depC'], 'B depends on C');
assert.strictEqual(graph2.dependents.depC.length, 1, 'C has one dependent (B)');
assert.strictEqual(graph2.dependents.depB.length, 1, 'B has one dependent (A)');

console.log('    chained dependencies: PASS');

console.log('  Testing diamond dependency (A and B both depend on C)...');

const cDiamond = makeTask('proj/C:20', null, 'diamondC', [], new Date('2026-10-01'));
const aDiamond = makeTask('proj/A:21', null, 'diamondA', ['diamondC'], new Date('2026-10-10'));
const bDiamond = makeTask('proj/B:22', null, 'diamondB', ['diamondC'], new Date('2026-10-15'));
const items3 = [cDiamond, aDiamond, bDiamond];

const graph3 = buildGraph(items3);

assert.strictEqual(graph3.dependents.diamondC.length, 2, 'diamondC has 2 dependents');
assert.ok(graph3.dependents.diamondC.find(t => t.key === 'proj/A:21'), 'A depends on diamondC');
assert.ok(graph3.dependents.diamondC.find(t => t.key === 'proj/B:22'), 'B depends on diamondC');

console.log('    diamond dependency: PASS');

console.log('  Testing self-loop prevention...');

const selfTask = makeTask('proj/S:30', null, 'selfLoop', ['selfLoop'], new Date('2026-10-01'));
const items4 = [selfTask];

// buildGraph should not infinite-loop; it uses a visited set
const graph4 = buildGraph(items4);

assert.strictEqual(items4.length, 1, 'self-loop task is still in the graph');
assert.ok(true, 'no infinite loop from self-dependency');
assert.strictEqual(graph4.dependents.selfLoop.length, 1, 'self-loop registered in dependents');

console.log('    self-loop prevention: PASS');

console.log('  Testing broken dependency (non-existent ID)...');

const orphanTask = makeTask('proj/O:40', null, 'orphanTask', ['nonexistent123'], new Date('2026-10-01'));
const items5 = [orphanTask];

const graph5 = buildGraph(items5);

assert.strictEqual(graph5.dependents.nonexistent123.length, 1, 'broken dep registered but no target');
assert.strictEqual(orphanTask.deps.length, 1, 'task still has its dep array');

console.log('    broken dependency: PASS');

console.log('  Testing multiple deps on same target...');

const taskMulti = makeTask('proj/M:50', null, 'multiDep', ['sharedDep1', 'sharedDep2'], new Date(null));
const shared1 = makeTask('proj/S:51', null, 'sharedDep1', [], new Date('2026-10-05'));
const shared2 = makeTask('proj/S:52', null, 'sharedDep2', [], new Date('2026-10-10'));
const items6 = [taskMulti, shared1, shared2];

const graph6 = buildGraph(items6);

assert.strictEqual(graph6.dependents.sharedDep1.length, 1, 'sharedDep1 has 1 dependent');
assert.strictEqual(graph6.dependents.sharedDep2.length, 1, 'sharedDep2 has 1 dependent');
assert.deepStrictEqual(taskMulti.deps, ['sharedDep1', 'sharedDep2'], 'multi-deps preserved');

console.log('    multiple deps on same target: PASS');

console.log('  Testing no dependencies...');

const noDepTask = makeTask('proj/N:60', new Date('2026-09-15'), 'noDep', [], new Date('2026-09-15'));
const items7 = [noDepTask];

const graph7 = buildGraph(items7);

assert.strictEqual(graph7.dependents.noDep, undefined, 'noDep has no dependents');

console.log('    no dependencies: PASS');

console.log('  Testing tasks with no ID (no dependents entry)...');

const noIdTask = makeTask('proj/N:70', new Date('2026-09-15'), null, [], new Date('2026-09-15'));
const dependsOnNoId = makeTask('proj/N:71', null, 'dependsOnNoId', [], []);
dependsOnNoId.deps = ['noIdTask'];
const items8 = [noIdTask, dependsOnNoId];

const graph8 = buildGraph(items8);

// The dep reference is registered in the dependents map
assert.strictEqual(graph8.dependents.noIdTask.length, 1, 'dep registered even though noIdTask has no id field');

console.log('    no-ID tasks: PASS');

console.log('  Testing effective deadline computation (locked=false)...');

// Task A has no ownDL and no downstream deadline constraint → eff=null
// Task B has ownDL=Sep 20, downstream=A (no deadline) → eff=Sep 20
// Task C has ownDL=Sep 10, downstream=B(Sep 20) → eff=min(Sep 10, Sep 20)=Sep 10
const taskC_eff = makeTask('proj/C:80', new Date('2026-09-10'), 'cEff', [], new Date('2026-09-10'));
const taskB_eff = makeTask('proj/B:81', new Date('2026-09-20'), 'bEff', ['cEff'], new Date('2026-09-20'));
const taskA_eff = makeTask('proj/A:82', null, 'aEff', ['bEff'], null);
const items9 = [taskA_eff, taskB_eff, taskC_eff];

const graph9 = buildGraph(items9);

assert.strictEqual(taskA_eff.deps.length, 1, 'A has 1 dep');
assert.strictEqual(taskA_eff.deps[0], 'bEff', 'A depends on bEff');
assert.strictEqual(taskB_eff.deps.length, 1, 'B has 1 dep');
assert.strictEqual(taskB_eff.deps[0], 'cEff', 'B depends on cEff');
assert.strictEqual(taskC_eff.deps.length, 0, 'C has no deps');

// eff: A has no downstream deadlines → null; B has ownDL=Sep 20; C has ownDL=Sep 10
assert.strictEqual(taskA_eff.eff, null, 'A eff is null (no downstream constraint)');
assert.strictEqual(taskB_eff.eff.toDateString(), new Date('2026-09-20').toDateString(), 'B eff=Sep 20');
assert.strictEqual(taskC_eff.eff.toDateString(), new Date('2026-09-10').toDateString(), 'C eff=Sep 10 (min of downstream)');

console.log('    effective deadline computation: PASS');

console.log('  Testing locked task (eff=null)...');

const lockedTask = makeTask('proj/L:90', new Date('2026-09-15'), 'lockedTask', [], new Date('2026-09-15'));
lockedTask.locked = true;
const items10 = [lockedTask];

const graph10 = buildGraph(items10);

assert.strictEqual(graph10.dependents.lockedTask, undefined, 'locked task has no dependents from deps');
assert.strictEqual(lockedTask.eff, null, 'locked task eff is null');

console.log('    locked task: PASS');

console.log('  Testing empty graph...');

const graph11 = buildGraph([]);
assert.deepStrictEqual(Object.keys(graph11.dependents), [], 'empty dependents map');

console.log('    empty graph: PASS');

console.log('\nAll graph realistic tests passed!');
process.exit(0);
