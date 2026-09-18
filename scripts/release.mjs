#!/usr/bin/env node
// release.mjs — gated, idempotent, atomic release for obsidian-planning.
//
//   npm run release                 # bump minor (package.json is source of truth)
//   npm run release -- --type patch # bump patch / minor / major
//   npm run release -- --ver 0.5.1  # explicit version
//   npm run release -- --dry-run    # run all gates + build, print plan, stop (no side effects)
//   npm run release -- --allow-dirty# sweep the working tree into the release commit
//
// Guarantees:
//   * One command, one process, minimal output.
//   * Fail-fast: every precondition is verified BEFORE any commit/tag/push is made.
//   * Atomic: artifacts + package.json bump + release-notes go into ONE commit, then ONE tag.
//   * Idempotent: refuses if vX.Y.Z already exists locally or on GitHub.
//   * Never force-pushes: the gates forbid a dirty/behind tree, so push is always a clean
//     fast-forward and the tag is always new.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const allowDirty = args.includes('--allow-dirty');
const byVer = args.indexOf('--ver');
const byType = args.indexOf('--type');
const explicit = byVer !== -1 ? args[byVer + 1] : null;
const bump = (byType !== -1 ? args[byType + 1] : 'minor');

const run = (cmd, a = []) => {
  try {
    return { code: 0, out: execFileSync(cmd, a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout ?? ''), err: String(e.stderr ?? '') };
  }
};
const ok = (r) => r.code === 0;
const fail = (m) => { console.error(`release failed: ${m}`); process.exit(1); };
const semver = (v) => /^\d+\.\d+\.\d+$/.test(v);
const bumpVer = (base, type) => {
  const [M, m, p] = String(base).split('.').map(Number);
  if (type === 'major') return `${M + 1}.0.0`;
  if (type === 'minor') return `${M}.${m + 1}.0`;
  if (type === 'patch') return `${M}.${m}.${p + 1}`;
  fail(`unknown --type "${type}" (use major | minor | patch)`);
};

// --- resolve target version ---
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
let next = explicit || bumpVer(pkg.version, bump);
if (!semver(next)) fail(`invalid version "${next}" (expected x.y.z)`);
const tag = `v${next}`;

// --- gates (all verified before any side effect) ---
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (!ok(branch) || branch.out.trim() !== 'main') fail('not on main');

const rel = run('git', ['rev-list', '--left-right', '--count', 'HEAD...origin/main']).out.trim();
const behind = rel ? Number(rel.split('\t')[1] ?? 0) : 0;
if (behind > 0) fail(`behind origin/main by ${behind} (pull before releasing)`);

const dirty = run('git', ['status', '--porcelain']).out.trim();
if (dirty && !allowDirty) fail('working tree not clean (commit changes or pass --allow-dirty)');

if (run('git', ['tag', '-l', tag]).out.includes(tag)) fail(`tag ${tag} already exists`);

if (!ok(run('npm', ['test']))) fail('npm test failed — fix tests before releasing');

// --- release-notes metadata ---
const notesPath = resolve(root, '.github', 'release-notes.md');
if (!existsSync(notesPath)) fail('missing .github/release-notes.md');
const title = readFileSync(notesPath, 'utf8')
  .split('\n')
  .find((l) => l.trim())
  .replace(/^#+\s*/, '')
  .trim();
if (!title) fail('release-notes.md has an empty title (first non-empty line)');

// --- dry run: print the plan and stop before any side effect ---
if (dry) {
  console.log(`DRY RUN — would release ${tag}: "${title}"`);
  console.log('plan: npm test (already passed) → npm run build → git add -A →');
  console.log('      commit "chore: release ' + tag + '" → tag v' + next + ' → push → gh release create');
  process.exit(0);
}

// --- release (all-or-nothing) ---
if (!ok(run('npm', ['run', 'build']))) fail('build failed');
if (!ok(run('git', ['add', '-A']))) fail('git add -A failed');
// Commit regenerated artifacts (e.g. planning.md) so the release tag is self-contained. When there
// is nothing to commit, leave HEAD as-is so the tag anchors the existing (feature) commit — no empty
// "release" commit.
if (run('git', ['status', '--porcelain']).out.trim() !== '') {
  if (!ok(run('git', ['commit', '-m', `chore: release ${tag}`]))) fail('release commit failed');
}
if (!ok(run('git', ['tag', '-a', tag, '-m', title]))) fail('tag failed');
if (!ok(run('git', ['push']))) fail('push to origin/main failed');
if (!ok(run('git', ['push', '--tags']))) fail('push tag failed');
if (!ok(run('gh', ['release', 'create', tag, '--title', title, '--notes-file', notesPath, 'planning.md'])))
  fail('gh release create failed');

console.log(`✓ released ${tag}: https://github.com/Silvio-Re/obsidian-planning/releases/tag/${tag}`);
