// test/task_opener.test.js — regression tests for the click-to-open task behavior (utils.js).
// makeTaskOpener is not exported (render modules receive it inlined by build.js), so the source
// is evaluated in a vm context — the same approach the render harness uses for the bundle.
// Pitfall fixed here: openFile() replaces the new tab's view asynchronously, so searching
// workspace leaves alone raced the load and gave up after 12 retries — the line was never
// selected, for BOTH left click and middle click. The fix passes the opened leaf as a hint.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils.js'), 'utf8');

// Evaluate utils.js with `app` in scope (the module body guards on `dv`, which stays undefined).
function makeOpener(app) {
  const sandbox = { app, setTimeout: (fn) => fn() };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nmakeTaskOpener', sandbox);
  return sandbox.makeTaskOpener(app);
}

function makeEl(path, line) {
  return {
    _attrs: { 'data-path': path, 'data-line': String(line) },
    _handlers: {},
    getAttribute(k) { return this._attrs[k]; },
    addEventListener(type, fn) { this._handlers[type] = fn; },
  };
}

// Mock workspace: NO leaf exposes the file at first (simulating a newly opened tab whose
// view hasn't loaded). Only the leaf returned by getLeaf('tab') ever gets an editor.
function makeApp() {
  const tabLeaf = { view: null };
  const app = {
    opened: null,
    workspace: {
      getLeaf: () => tabLeaf,
      getLeavesOfType: () => [tabLeaf],
      setActiveLeaf: (l) => { app.activeLeaf = l; },
    },
    vault: { getAbstractFileByPath: (p) => ({ path: p }) },
    activeLeaf: null,
    _tabLeaf: tabLeaf,
  };
  return app;
}

console.log('Testing makeTaskOpener (left + middle click line selection)...\n');

// The view "loads" synchronously inside openFile (Promise resolution), then the editor exists.
function loadedViewApp(filePath) {
  const app = makeApp();
  app._tabLeaf.openFile = (file, opts) => {
    app.opened = { file: file.path, state: opts.state };
    app._tabLeaf.view = {
      file: { path: file.path },
      editor: {
        _selected: null,
        getLine: () => 'task line content',
        setSelection: (from, to) => { app._tabLeaf.view.editor._selected = { from, to }; },
        scrollIntoView: () => {},
        focus: () => {},
      },
    };
    return Promise.resolve(app._tabLeaf);
  };
  return app;
}

// --- left click: the line must be selected even though the leaf list search would fail ---
{
  const app = loadedViewApp();
  const opener = makeOpener(app);
  const el = makeEl('Projets/task.md', 3);
  opener(el);
  el._handlers.click({ stopPropagation: () => {} });
  assert.strictEqual(app.opened.file, 'Projets/task.md', 'file opened at the right path');
  assert.strictEqual(app.opened.state.line, 3, 'openFile got the line state');
  const sel = app._tabLeaf.view.editor._selected;
  assert.ok(sel, 'editor line selection happened (no silent give-up)');
  assert.strictEqual(sel.from.line, 3, 'selection starts at the task line');
  assert.strictEqual(sel.from.ch, 0, 'selection starts at column 0');
  assert.strictEqual(sel.to.line, 3, 'selection ends on the task line');
  assert.strictEqual(sel.to.ch, 'task line content'.length, 'selection spans the whole line');
  assert.strictEqual(app.activeLeaf, app._tabLeaf, 'the opened leaf was activated');
  console.log('  left click selects the task line: PASS');
}

// --- middle click (auxclick, button 1): same behavior ---
{
  const app = loadedViewApp();
  const opener = makeOpener(app);
  const el = makeEl('Projets/other.md', 7);
  opener(el);
  let prevented = false;
  el._handlers.auxclick({ button: 1, preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  assert.ok(prevented, 'middle click default (autoscroll) is prevented');
  assert.strictEqual(app.opened.file, 'Projets/other.md', 'file opened');
  assert.strictEqual(app.opened.state.line, 7, 'line state passed');
  const sel = app._tabLeaf.view.editor._selected;
  assert.ok(sel && sel.from.line === 7, 'middle click also selects the task line');
  console.log('  middle click selects the task line: PASS');
}

// --- auxclick with another button (e.g. right click, button 2) must be ignored ---
{
  const app = loadedViewApp();
  const opener = makeOpener(app);
  const el = makeEl('Projets/none.md', 1);
  opener(el);
  el._handlers.auxclick({ button: 2, preventDefault: () => {}, stopPropagation: () => {} });
  assert.strictEqual(app.opened, null, 'non-middle auxclick does not open anything');
  console.log('  right-click auxclick ignored: PASS');
}

// --- when the file is ALREADY open in an existing leaf, the hint is skipped and that
//     leaf's editor is used (the candidates list prefers a matching editor over the hint) ---
{
  const app = loadedViewApp();
  const opener = makeOpener(app);
  const existingLeaf = {
    view: {
      file: { path: 'Projets/task.md' },
      editor: {
        _selected: null,
        getLine: () => 'existing line',
        setSelection: (from, to) => { existingLeaf.view.editor._selected = { from, to }; },
        scrollIntoView: () => {},
        focus: () => {},
      },
    },
  };
  app.workspace.getLeavesOfType = () => [existingLeaf, app._tabLeaf];
  const el = makeEl('Projets/task.md', 5);
  opener(el);
  el._handlers.click({ stopPropagation: () => {} });
  assert.ok(existingLeaf.view.editor._selected, 'existing leaf editor gets the selection');
  assert.strictEqual(existingLeaf.view.editor._selected.from.line, 5, 'selection at line 5 in the existing leaf');
  assert.strictEqual(app.activeLeaf, existingLeaf, 'existing leaf activated');
  assert.strictEqual(app._tabLeaf.view.editor._selected, null, 'new-tab editor NOT selected when the file was already open');
  console.log('  already-open file selects in its existing leaf: PASS');
}

console.log('\nAll task opener tests passed!');
process.exit(0);
