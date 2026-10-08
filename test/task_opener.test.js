// test/task_opener.test.js — regression tests for the click-to-open task behavior (utils.js).
// makeTaskOpener is not exported (render modules receive it inlined by build.js), so the source
// is evaluated in a vm context — the same approach the render harness uses for the bundle.
// Pitfalls fixed here, each with a dedicated test:
//  1. openFile() replaces the new tab's view asynchronously — the code now AWAITS the
//     promise before selecting, so a not-already-open file gets its line selected reliably.
//  2. The leaf hint was dropped on every retry (setTimeout omitted the argument), so for a
//     not-already-open file all retries fell back to the racy workspace search. The hint must
//     survive every retry.
//  3. eState (Obsidian's built-in scroll-to-line) is passed so a very slow load still ends
//     up positioned at the line even if the JS selection gives up.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils.js'), 'utf8');

// Evaluate utils.js with `app` in scope (the module body guards on `dv`, which stays undefined).
// `timer` controls the setTimeout the opener uses for its selection retries: by default retries
// run synchronously (fast tests); pass the REAL setTimeout for the delayed-load regression test.
function makeOpener(app, timer = (fn) => fn()) {
  const sandbox = { app, setTimeout: timer };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nmakeTaskOpener', sandbox);
  return sandbox.makeTaskOpener(app);
}

// Yield long enough for the async openAt (awaited openFile) chain to settle.
const tick = () => new Promise((r) => setImmediate(r));

function makeEl(path, line) {
  return {
    _attrs: { 'data-path': path, 'data-line': String(line) },
    _handlers: {},
    getAttribute(k) { return this._attrs[k]; },
    addEventListener(type, fn) { this._handlers[type] = fn; },
  };
}

function makeEditorView(filePath, lineText = 'task line content') {
  const view = {
    file: { path: filePath },
    editor: {
      _selected: null,
      getLine: () => lineText,
      setSelection: (from, to) => { view.editor._selected = { from, to }; },
      scrollIntoView: () => {},
      focus: () => {},
    },
  };
  return view;
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

// The view "loads" synchronously inside openFile (Promise resolution), then the editor exists.
function loadedViewApp(filePath) {
  const app = makeApp();
  app._tabLeaf.openFile = (file, opts) => {
    app.opened = { file: file.path, opts };
    app._tabLeaf.view = makeEditorView(file.path);
    return Promise.resolve(app._tabLeaf);
  };
  return app;
}

console.log('Testing makeTaskOpener (left + middle click line selection)...\n');

// --- left click: the line must be selected even though the leaf list search would fail ---
{
  const app = loadedViewApp('Projets/task.md');
  const opener = makeOpener(app);
  const el = makeEl('Projets/task.md', 3);
  opener(el);
  el._handlers.click({ stopPropagation: () => {} });
  await tick(); // openAt awaits openFile before selecting
  assert.strictEqual(app.opened.file, 'Projets/task.md', 'file opened at the right path');
  assert.strictEqual(app.opened.opts.eState.line, 3, 'openFile got eState.line (built-in scroll-to-line)');
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
  const app = loadedViewApp('Projets/other.md');
  const opener = makeOpener(app);
  const el = makeEl('Projets/other.md', 7);
  opener(el);
  let prevented = false;
  el._handlers.auxclick({ button: 1, preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  await tick();
  assert.ok(prevented, 'middle click default (autoscroll) is prevented');
  assert.strictEqual(app.opened.file, 'Projets/other.md', 'file opened');
  assert.strictEqual(app.opened.opts.eState.line, 7, 'line eState passed');
  const sel = app._tabLeaf.view.editor._selected;
  assert.ok(sel && sel.from.line === 7, 'middle click also selects the task line');
  console.log('  middle click selects the task line: PASS');
}

// --- auxclick with another button (e.g. right click, button 2) must be ignored ---
{
  const app = loadedViewApp('Projets/none.md');
  const opener = makeOpener(app);
  const el = makeEl('Projets/none.md', 1);
  opener(el);
  el._handlers.auxclick({ button: 2, preventDefault: () => {}, stopPropagation: () => {} });
  await tick();
  assert.strictEqual(app.opened, null, 'non-middle auxclick does not open anything');
  console.log('  right-click auxclick ignored: PASS');
}

// --- THE REGRESSION (not-already-open file, slow view load):
//     openFile resolves BEFORE the editor exists on the leaf, and the workspace search can
//     NEVER find the file (new tab not exposed until fully loaded). The line must still be
//     selected — via the hint, on a retry, with real async timers. ---
{
  const app = makeApp();
  app.workspace.getLeavesOfType = () => []; // the hint is the ONLY handle
  app._tabLeaf.openFile = (file, opts) => {
    app.opened = { file: file.path, opts };
    return Promise.resolve(app._tabLeaf); // promise resolves immediately...
  };
  // ...but the view/editor only appears 60ms later (editor lags the resolved promise)
  const realSetTimeout = setTimeout;
  const unref = realSetTimeout(() => { app._tabLeaf.view = makeEditorView('Projets/slow.md'); }, 60);
  if (unref && typeof unref.unref === 'function') unref.unref(); // don't hang the test runner
  // real async retries at the real 100ms poll interval — attempt 0 fails (~0ms), the view
  // appears at 60ms, and the 100ms retry must find it via the hint.
  const opener = makeOpener(app, (fn, ms) => realSetTimeout(fn, ms));
  const el = makeEl('Projets/slow.md', 4);
  opener(el);
  el._handlers.click({ stopPropagation: () => {} });
  // attempt 0 fails (~0ms, view not there), retries run every 100ms; by 400ms the
  // 60ms-old view must have been found via the hint on some retry.
  await new Promise((r) => realSetTimeout(r, 400));
  assert.ok(app._tabLeaf.view, 'slow view eventually loaded');
  const sel = app._tabLeaf.view.editor._selected;
  assert.ok(sel, 'slow load: selection still happens (hint kept on every retry)');
  assert.strictEqual(sel.from.line, 4, 'slow load: selection at the right line');
  assert.strictEqual(app.activeLeaf, app._tabLeaf, 'slow load: hint leaf activated');
  console.log('  not-already-open file (slow async load) selects the line: PASS');
}

// --- the view NEVER loads: retries are bounded and the give-up is silent ---
{
  const app = makeApp();
  let retryCalls = 0;
  app._tabLeaf.openFile = (file, opts) => {
    app.opened = { file: file.path, opts };
    return Promise.resolve(app._tabLeaf); // resolved, but the view never appears
  };
  const opener = makeOpener(app, (fn) => { retryCalls++; fn(); }); // sync retries, counted
  const el = makeEl('Projets/ghost.md', 2);
  opener(el);
  el._handlers.click({ stopPropagation: () => {} });
  await tick();
  assert.strictEqual(app.opened.file, 'Projets/ghost.md', 'open was attempted');
  assert.strictEqual(retryCalls, 30, 'exactly 30 retries (bounded, no infinite loop)');
  assert.strictEqual(app._tabLeaf.view, null, 'no view, no selection — and no throw');
  assert.strictEqual(app.activeLeaf, null, 'nothing was activated');
  console.log('  never-loading view: bounded silent give-up: PASS');
}

// --- openFile itself REJECTS (file missing from vault): swallow, select nothing ---
{
  const app = makeApp();
  app._tabLeaf.openFile = () => Promise.reject(new Error('no such file'));
  const opener = makeOpener(app);
  const el = makeEl('Projets/gone.md', 5);
  opener(el);
  let threw = null;
  try { el._handlers.click({ stopPropagation: () => {} }); } catch (e) { threw = e; }
  await tick();
  await tick();
  assert.strictEqual(threw, null, 'rejection does not escape the click handler');
  assert.strictEqual(app.activeLeaf, null, 'nothing was activated');
  console.log('  missing-file rejection handled silently: PASS');
}

// --- when the file is ALREADY open in an existing leaf, the hint is skipped and that
//     leaf's editor is used (the candidates list prefers a matching editor over the hint) ---
{
  const app = loadedViewApp('Projets/task.md');
  const opener = makeOpener(app);
  const existingLeaf = { view: makeEditorView('Projets/task.md', 'existing line') };
  app.workspace.getLeavesOfType = () => [existingLeaf, app._tabLeaf];
  const el = makeEl('Projets/task.md', 5);
  opener(el);
  el._handlers.click({ stopPropagation: () => {} });
  await tick();
  assert.ok(existingLeaf.view.editor._selected, 'existing leaf editor gets the selection');
  assert.strictEqual(existingLeaf.view.editor._selected.from.line, 5, 'selection at line 5 in the existing leaf');
  assert.strictEqual(app.activeLeaf, existingLeaf, 'existing leaf activated');
  assert.strictEqual(app._tabLeaf.view.editor._selected, null, 'new-tab editor NOT selected when the file was already open');
  console.log('  already-open file selects in its existing leaf: PASS');
}

console.log('\nAll task opener tests passed!');
process.exit(0);
