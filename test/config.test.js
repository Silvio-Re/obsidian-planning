// test/config.test.js — USER_CONFIG and folderQuery (src/config.js, pure module).
// The config block is the one thing a user edits in the generated bundle, so its
// query-building must be exactly right for single folders, arrays, and bad input.
import assert from 'assert';
import { USER_CONFIG, folderQuery, nonWorkingSet } from '../src/config.js';

console.log('Testing config (USER_CONFIG, folderQuery)...');

// Defaults match the documented setup (README: Projets folder, 9:00-17:00, 8h/day)
assert.strictEqual(USER_CONFIG.folders, 'Projets', 'default folder is Projets');
assert.strictEqual(USER_CONFIG.startHour, 9, 'default startHour is 9');
assert.strictEqual(USER_CONFIG.hoursPerDay, 8, 'default hoursPerDay is 8');

// Single folder (string) -> quoted Dataview source
assert.strictEqual(folderQuery('Projets'), '"Projets"', 'single folder is quoted');

// Multiple folders (array) -> Dataview "or" syntax
assert.strictEqual(folderQuery(['Projets', 'Areas']), '"Projets" or "Areas"', 'array joins with or');
assert.strictEqual(folderQuery(['A', 'B', 'C']), '"A" or "B" or "C"', 'three folders');

// Whitespace / pre-quoted input tolerated
assert.strictEqual(folderQuery('  Projets  '), '"Projets"', 'surrounding spaces trimmed');
assert.strictEqual(folderQuery('"Projets"'), '"Projets"', 'already-quoted folder not double-quoted');

// Mixed array entries: empty strings dropped
assert.strictEqual(folderQuery(['Projets', '', '  ']), '"Projets"', 'empty entries dropped');

// Invalid input -> matches nothing (never the whole vault)
assert.strictEqual(folderQuery(''), '""', 'empty string matches nothing');
assert.strictEqual(folderQuery([]), '""', 'empty array matches nothing');
assert.strictEqual(folderQuery(null), '"Projets"', 'null falls back to the configured default');
assert.strictEqual(folderQuery(undefined), '"Projets"', 'undefined falls back to the configured default');
assert.strictEqual(folderQuery([42]), '""', 'non-string entries match nothing');
assert.strictEqual(folderQuery(42), '""', 'non-string scalar matches nothing');

// --- nonWorkingSet: single dates and inclusive ranges ---
assert.deepStrictEqual([...nonWorkingSet(['2026-12-25'])].sort(), ['2026-12-25'], 'single date');
assert.deepStrictEqual([...nonWorkingSet(['2026-07-20/2026-07-23'])].sort(),
  ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23'], 'inclusive range');
assert.deepStrictEqual([...nonWorkingSet(['2026-07-20 / 2026-07-21'])].sort(),
  ['2026-07-20', '2026-07-21'], 'spaces around slash tolerated');
assert.strictEqual(nonWorkingSet(['garbage', 42, null, '', '2026-13-45']).size, 0, 'invalid entries ignored');
assert.strictEqual(nonWorkingSet(null).size, 0, 'null yields an empty set');
assert.strictEqual(nonWorkingSet().size, 0, 'undefined yields an empty set');
assert.strictEqual(nonWorkingSet('2026-05-01').has('2026-05-01'), true, 'scalar string accepted');
assert.strictEqual(nonWorkingSet(['2026-07-20/2026-07-20']).size, 1, 'same-day range collapses to one day');

// The bundle places USER_CONFIG first so a user finds it immediately.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
{
  const planning = fs.readFileSync(path.join(__dirname, '..', 'planning.md'), 'utf8');
  const body = planning.replace(/^```dataviewjs\n/, '');
  const firstDecl = body.indexOf('const USER_CONFIG');
  const firstImportIdx = body.search(/^import /m);
  assert.ok(firstDecl > -1, 'USER_CONFIG is in the planning bundle');
  assert.strictEqual(firstImportIdx, -1, 'bundle has no leftover imports');
  // USER_CONFIG must appear before the scheduler/config usage and before any other const
  const firstOtherConst = body.indexOf('const P0');
  assert.ok(firstDecl < firstOtherConst, 'USER_CONFIG precedes module constants in the bundle');
  const daily = fs.readFileSync(path.join(__dirname, '..', 'daily.md'), 'utf8');
  assert.ok(daily.includes('const USER_CONFIG'), 'USER_CONFIG is in the daily bundle');
}
console.log('  config: PASS');

console.log('\nAll config tests passed!');
process.exit(0);
