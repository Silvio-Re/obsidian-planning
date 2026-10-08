import assert from 'assert';
import {
  segsOf, completionStart, completionNodeTotal, completionAnnotate,
  completionNodeStart, completionFlatten,
  clampScale, zoomX, zoomY, togglePin, clearPins
} from '../src/render_model.js';

console.log('Testing render_model pure helpers (direct import, no bundle)...\n');

// --- segsOf: vault path -> breadcrumb segments ---
assert.deepStrictEqual(segsOf('Projets/A/B.md'), ['A', 'B'], 'plain path');
assert.deepStrictEqual(segsOf('Projets/A/A.md'), ['A'], 'trailing duplicate segment dropped');
assert.deepStrictEqual(segsOf('C/D.md'), ['C', 'D'], 'no Projets prefix: kept as-is');
assert.deepStrictEqual(segsOf('X.md'), ['X'], 'single file');
assert.deepStrictEqual(segsOf('Projets/X.md'), ['X'], 'Projets prefix stripped');
console.log('  segsOf: PASS');

// --- completionStart: completion date -> sort key ---
const t0 = Date.UTC(2026, 0, 2);
assert.strictEqual(completionStart({ compDate: '2026-01-02' }), t0, 'valid compDate parsed as ms');
assert.strictEqual(completionStart({ compDate: 'not-a-date' }), 0, 'invalid compDate -> 0');
assert.strictEqual(completionStart({}), 0, 'missing compDate -> 0');
console.log('  completionStart: PASS');

// --- completed tree helpers ---
function cNode(id, items = [], children = []) {
  return { id, label: id, items, children: new Map(children.map(c => [c.id, c])) };
}
const leaf = (h, start) => ({ k: 'task', s: { hours: h }, start });
const gA = cNode('A', [leaf(3, 2), leaf(2, 4)]);
const gB = cNode('B', [leaf(4, 1)]);
const gA1 = cNode('A1', [leaf(4, 6)]);
gA.children.set('A1', gA1);
const root = cNode('root', [], [gA, gB]);

assert.strictEqual(completionNodeTotal(gA), 3 + 2 + 4, 'node total sums subtree hours');
completionAnnotate(root);
assert.strictEqual(gA.total, 9, 'annotate sets .total');
assert.strictEqual(root.total, 13, 'root total = 3+2+4+4');

assert.strictEqual(completionNodeStart(gB), 1, 'node start = min leaf start');
assert.strictEqual(completionNodeStart(gA), 2, 'subtree start recurses');
assert.strictEqual(completionNodeStart(cNode('empty')), 0, 'empty node -> 0');

// Flatten: groups sorted by start, leaves sorted by start, depth tracked
const out = completionFlatten(root, new Set(), []);
assert.deepStrictEqual(
  out.map(e => e.type === 'group' ? `g:${e.node.id}@${e.depth}` : `t:${e.s.hours}@${e.depth}`),
  // Note: subgroups are emitted BEFORE the parent's own leaves (depth-first,
  // groups-first at every level) — the established tree order.
  ['g:B@0', 't:4@1', 'g:A@0', 'g:A1@1', 't:4@2', 't:3@1', 't:2@1'],
  'flatten order (by start), depth, and leaf sort'
);
const outCollapsed = completionFlatten(root, new Set(['A']), []);
assert.deepStrictEqual(
  outCollapsed.map(e => e.type === 'group' ? `g:${e.node.id}` : `t:${e.s.hours}`),
  ['g:B', 't:4', 'g:A'],
  'collapsed group hides its whole subtree'
);
console.log('  completion tree helpers: PASS');

// --- clampScale ---
assert.strictEqual(clampScale(50), 30, 'clamped to max');
assert.strictEqual(clampScale(0.1), 0.4, 'clamped to min');
assert.strictEqual(clampScale(5), 5, 'in-range value untouched');
console.log('  clampScale: PASS');

// --- zoomX: anchor stays fixed while zooming ---
const zx = zoomX(2, { scaleX: 1, totalDays: 10, basePxPerDay: 10, clientWidth: 50, scrollLeft: 10 });
assert.strictEqual(zx.scaleX, 2, 'scale doubles');
assert.strictEqual(zx.scrollLeft, 45, 'scroll-left keeps the anchor point fixed');
// anchor invariant: (scrollLeft + 0.5*clientWidth) scales with the width
assert.strictEqual(zx.scrollLeft + 0.5 * 50, 2 * (10 + 0.5 * 50), 'anchor math');
const zxClamped = zoomX(100, { scaleX: 1, totalDays: 10, basePxPerDay: 10, clientWidth: 50, scrollLeft: 10 });
assert.strictEqual(zxClamped.scaleX, 30, 'zoom-in clamps at max');
const zxZero = zoomX(2, { scaleX: 1, totalDays: 0, basePxPerDay: 10, clientWidth: 50, scrollLeft: 7 });
assert.strictEqual(zxZero.scrollLeft, 7, 'zero width: scroll-left unchanged');
console.log('  zoomX: PASS');

// --- zoomY ---
const zy = zoomY(2, { scaleY: 1, baseIH: 20, clientHeight: 100, scrollTop: 10 });
assert.strictEqual(zy.scaleY, 2, 'scale doubles');
assert.strictEqual(zy.scrollTop, 70, 'scroll-top keeps the anchor row fixed');
console.log('  zoomY: PASS');

// --- pin model ---
const pins = new Set([3]);
assert.strictEqual(togglePin(pins, 3).has(3), false, 'toggle removes a pinned day');
assert.strictEqual(togglePin(pins, 5).has(5), true, 'toggle pins a new day');
assert.strictEqual(clearPins(new Set([1, 2])).size, 0, 'clearPins empties the set');
console.log('  pin helpers: PASS');

console.log('\nAll render_model tests passed!');
process.exit(0);
