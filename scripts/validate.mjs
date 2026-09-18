// scripts/validate.mjs — syntax-check every source file and the bundled planning.md body.
// build.js does blind string concatenation and never validates JS, so a syntax error in
// src/*.js silently lands in planning.md and breaks the whole dashboard in Obsidian.
// This runs as `pretest` (and can be run standalone with `node scripts/validate.mjs`).

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(full));
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function checkNode(file) {
  try {
    execSync(`node --check "${file}"`, { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch (e) {
    const msg = (e.stderr && e.stderr.toString()) || e.message;
    console.error(`  \u2717 ${path.relative(ROOT, file)}\n    ${msg.trim()}`);
    return false;
  }
}

let ok = true;
const srcFiles = walk(path.join(ROOT, 'src'));
console.log('Syntax checking ' + srcFiles.length + ' source files...');
for (const f of srcFiles) {
  if (!checkNode(f)) ok = false;
}

// Each bundled release file's body (fences stripped) is validated as an ESM module, so a syntax
// error in src/*.js can't silently land in a release file and break it in Obsidian.
const BUNDLED_FILES = ['planning.md', 'daily.md'];
for (const mdName of BUNDLED_FILES) {
  const mdPath = path.join(ROOT, mdName);
  if (!fs.existsSync(mdPath)) {
    console.error(`  ! ${mdName} not found \u2014 run \`npm run build\` first`);
    ok = false;
    continue;
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const body = md.replace(/^```dataviewjs\n/, '').replace(/\n```\s*$/, '');
  const tmp = path.join(os.tmpdir(), `${mdName.replace(/[^a-z0-9]/gi, '-')}-check-` + process.pid + '.mjs');
  fs.writeFileSync(tmp, body);
  try {
    if (!checkNode(tmp)) ok = false;
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
  console.log(`  checking bundled ${mdName} body`);
}

console.log(ok ? '  All syntax checks passed.' : '  Syntax checks FAILED.');
process.exit(ok ? 0 : 1);
