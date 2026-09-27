// test/task_completer.test.js — regression tests for the click-to-complete behavior (utils.js).
// makeTaskCompleter is not exported (render modules receive it inlined by build.js), so the
// source is evaluated in a vm context — the same approach as task_opener.test.js.
// The completer flips the checkbox (- [ ] -> - [x]) and appends the ✅ marker with
// today's date to the exact task line via vault.process. The flip is what removes the
// task from the plan on refresh; the marker is what lets the Completed panel date-filter
// place it. Must be idempotent (double clicks are no-ops) and safe on non-task lines.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils.js'), 'utf8');

// Evaluate utils.js with `app` in scope (the module body guards on `dv`, which stays undefined).
function makeCompleter(app) {
  const sandbox = { app, setTimeout: (fn) => fn() };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nmakeTaskCompleter', sandbox);
  return sandbox.makeTaskCompleter(app, '2026-09-15');
}

// In-memory vault: getAbstractFileByPath returns a file object, process() applies fn atomically.
function makeVault(files) {
  const store = new Map(Object.entries(files));
  return {
    read: (p) => store.get(p),
    getAbstractFileByPath: (p) => (store.has(p) ? { path: p } : null),
    process: (file, fn) => {
      const text = store.get(file.path);
      const next = fn(text);
      store.set(file.path, next);
      return next;
    },
  };
}

console.log('Testing makeTaskCompleter (click-to-complete)...\n');

// --- 1. Appends the completion marker with today's date to the exact line ---
{
  const files = { 'Projets/a.md': '- [ ] Task one \u23f1 1h\n- [ ] Task two \u23f1 2h\n' };
  const vault = makeVault(files);
  const complete = makeCompleter({ vault });
  const ok = complete('Projets/a.md', 1);
  assert.strictEqual(ok, true, 'completion reported success');
  const lines = vault.read('Projets/a.md').split('\n');
  assert.strictEqual(lines[1], '- [x] Task two \u23f1 2h \u2705 2026-09-15',
    'checkbox flipped + marker + today appended to the exact line');
  assert.strictEqual(lines[0], '- [ ] Task one \u23f1 1h', 'other lines untouched');
  console.log('  flips checkbox and appends \u2705 + date: PASS');
}

// --- 2. Idempotent: a line already carrying ✅ is not modified again ---
{
  const files = { 'Projets/b.md': '- [ ] Done already \u23f1 1h \u2705 2026-09-10\n' };
  const vault = makeVault(files);
  const complete = makeCompleter({ vault });
  const ok = complete('Projets/b.md', 0);
  assert.strictEqual(ok, false, 'already-completed line reports no change');
  assert.strictEqual(vault.read('Projets/b.md'), '- [ ] Done already \u23f1 1h \u2705 2026-09-10\n',
    'content unchanged');
  console.log('  double completion is a no-op: PASS');
}

// --- 3. Out-of-range and missing-file calls are safe no-ops ---
{
  const files = { 'Projets/c.md': '- [ ] Solo \u23f1 1h\n' };
  const vault = makeVault(files);
  const complete = makeCompleter({ vault });
  assert.strictEqual(complete('Projets/c.md', 7), false, 'line beyond EOF is a no-op');
  assert.strictEqual(complete('Projets/nope.md', 0), false, 'missing file is a no-op');
  assert.strictEqual(vault.read('Projets/c.md'), '- [ ] Solo \u23f1 1h\n', 'content untouched');
  console.log('  bad input handled safely: PASS');
}

// --- 3b. A line without a checkbox (not a task) is left untouched ---
{
  const files = { 'Projets/prose.md': 'Just a sentence about work.\n- no checkbox here\n' };
  const vault = makeVault(files);
  const complete = makeCompleter({ vault });
  const ok = complete('Projets/prose.md', 0);
  assert.strictEqual(ok, false, 'non-task line reports no change');
  assert.strictEqual(vault.read('Projets/prose.md'), 'Just a sentence about work.\n- no checkbox here\n',
    'prose untouched');
  console.log('  non-task lines untouched: PASS');
}

// --- 4. Trailing whitespace is trimmed before appending (no double spaces) ---
{
  const files = { 'Projets/d.md': '- [ ] Padded \u23f1 1h   \nnext\n' };
  const vault = makeVault(files);
  const complete = makeCompleter({ vault });
  complete('Projets/d.md', 0);
  assert.strictEqual(vault.read('Projets/d.md').split('\n')[0], '- [x] Padded \u23f1 1h \u2705 2026-09-15',
    'checkbox flipped, trailing spaces collapsed before the marker');
  console.log('  trailing whitespace trimmed: PASS');
}

// --- 5. CRLF line keeps its \r (no mixed-EOL file) ---
{
  const files = { 'Projets/win.md': '- [ ] CRLF task \u23f1 1h\r\nnext\r\n' };
  const vault = makeVault(files);
  const complete = makeCompleter({ vault });
  const ok = complete('Projets/win.md', 0);
  assert.strictEqual(ok, true, 'CRLF task completes');
  assert.strictEqual(vault.read('Projets/win.md'), '- [x] CRLF task \u23f1 1h \u2705 2026-09-15\r\nnext\r\n',
    'line stays CRLF-terminated');
  console.log('  CRLF preserved: PASS');
}

console.log('\nAll completer tests passed!');
process.exit(0);
