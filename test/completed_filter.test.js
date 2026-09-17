// test/completed_filter.test.js
//
// End-to-end proof that the Completed Tasks date-range FILTER actually works: changing the
// From/To fields (typing yyyy-mm-dd, or picking in the calendar) must re-filter the visible
// task rows. This is the bug the user reported ("nothing happens once a date is selected").
//
// We run the REAL bundled planning.md in a vm (like render_bundle.test.js) but with an
// enhanced DOM mock: innerHTML parses into queryable elements, querySelectorAll resolves,
// sibling navigation + event dispatch work. The bundle inlines esc/clip/openTask from
// utils.js, so we don't hit the "non-exported helper" problem of a raw module import.

import assert from 'assert';
import vm from 'vm';
import { DateTime } from 'luxon';
import { loadBundle } from './harness/sandbox.mjs';

// ---- DOM mock with a real innerHTML parser --------------------------------
function makeElement(name) {
  const el = {
    tagName: name,
    classList: new Set(),
    _attrs: {},
    _children: [],
    _parent: null,
    _listeners: {},
    _text: '',
    value: '',
    style: {},
    get dataset() { return this._attrs; },
    set innerHTML(v) {
      // A real browser REPLACES inner HTML on assignment. The mock must clear _children
      // first, otherwise re-renders APPEND to the previous DOM and rows accumulate.
      el._children = [];
      try { el._children = parseHtml(String(v), el); } catch (_) { el._children = []; }
    },
    get innerHTML() { return el._raw ?? ''; },
    createEl(tag, opts) {
      const c = makeElement(tag);
      c._parent = this;
      this._children.push(c);
      if (opts) { if (opts.text != null) c._text = opts.text; if (opts.value != null) c.value = opts.value; if (opts.style) Object.assign(c.style, opts.style); }
      return c;
    },
    appendChild(c) { c._parent = this; this._children.push(c); return c; },
    addEventListener(type, fn) { (el._listeners[type] = el._listeners[type] || []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { el._attrs[k] = v; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k) ? el._attrs[k] : null; },
    dispatch(type) { (el._listeners[type] || []).forEach(fn => fn({ currentTarget: el, target: el })); },
    get previousElementSibling() {
      const p = el._parent; if (!p) return null;
      const i = p._children.indexOf(el); return i > 0 ? p._children[i - 1] : null;
    },
    get nextElementSibling() {
      const p = el._parent; if (!p) return null;
      const i = p._children.indexOf(el); return i >= 0 && i < p._children.length - 1 ? p._children[i + 1] : null;
    },
    querySelector(sel) { return findFirst(el, sel); },
    querySelectorAll(sel) { return findAll(el, sel); },
  };
  return el;
}

function parseAttrs(str, el) {
  // NOTE: a 3-way double|single|unquoted alternation trips a V8 regex quirk (a trailing
  // \\S+ branch wins over the quoted ones), so use the simple, reliable double-quoted form.
  // The bundler only emits double-quoted attributes, so this is sufficient for the mock DOM.
  const re = /([a-zA-Z_][\w-]*)(?:\s*=\s*"([^"]*)")?/g;
  let m;
  while ((m = re.exec(str))) {
    const key = m[1];
    const val = m[2] ?? '';
    el._attrs[key] = val;
    if (key === 'class') el.classList = new Set(val.split(/\s+/).filter(Boolean));
    if (key === 'value') el.value = val;
  }
}

// HTML void elements (input, br, img, ...) render without a trailing "/" in the bundler's
// output, so treat them as self-closing to keep the mock DOM tree correct.
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function parseHtml(html, root) {
  const stack = [root];
  let buf = '';
  let i = 0;
  function flushText() { if (buf.trim()) { stack[stack.length - 1]._text += buf; buf = ''; } }
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { buf += html.slice(i); break; }
    if (lt > i) buf += html.slice(i, lt);
    const gt = html.indexOf('>', lt);
    if (gt === -1) { buf += html.slice(lt); break; }
    const tag = html.slice(lt + 1, gt);
    if (tag.startsWith('/')) { flushText(); stack.pop(); i = gt + 1; continue; }
    const selfClose = tag.endsWith('/');
    const body = selfClose ? tag.slice(0, -1) : tag;
    const m = body.match(/^([a-zA-Z][\w-]*)/);
    const name = m ? m[1] : 'div';
    const voidLike = VOID_ELEMENTS.has(name.toLowerCase()) || selfClose;
    const el = makeElement(name);
    el._parent = stack[stack.length - 1];
    parseAttrs(body.slice(name.length), el);
    stack[stack.length - 1]._children.push(el);
    if (!voidLike) stack.push(el);
    buf = '';
    i = gt + 1;
  }
  flushText();
  return root._children;
}

function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function serialize(el) {
  let s = `<${el.tagName}`;
  (el._children || []).forEach(c => (typeof c === 'string' ? s += escHtml(c) : s += serialize(c)));
  s += `</${el.tagName}>`;
  return s;
}

function findAll(root, sel) {
  const s = sel.trim();
  const out = [];
  // A real browser querySelectorAll accepts a comma-separated selector list ('.a, .b').
  // Match if ANY part of the list matches, so multi-class queries behave like in the vault.
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  const match = (e) => {
    for (const pat of parts) {
      if (pat.startsWith('.')) {
        if (e.classList && e.classList.has(pat.slice(1))) return true;
      } else if (pat.startsWith('#')) {
        if (e.getAttribute('id') === pat.slice(1)) return true;
      } else if (String(e.tagName).toUpperCase() === pat.toUpperCase()) {
        return true;
      }
    }
    return false;
  };
  (function walk(e) {
    (e._children || []).forEach(c => { if (match(c)) out.push(c); walk(c); });
  })(root);
  return out;
}
function findFirst(root, sel) { return findAll(root, sel)[0] || null; }

// ---- Fixtures -------------------------------------------------------------
const todayISO = '2026-09-15'; // September 2026
const completedPages = [
  { file: { path: 'Projets/Formation/Recrutement.md', tasks: [
    { line: 2, completed: true, status: 'x', text: 'Tests unitaires 📅 2026-09-15 ⏱ 1h ⏫ ✅ 2026-09-15' } ] } },
  { file: { path: 'Projets/Formation/Onboarding.md', tasks: [
    { line: 3, completed: true, status: 'x', text: 'Accueil stagiaire 📅 2026-09-14 ⏱2.5h ⏫ ✅ 2026-09-14' } ] } },
  { file: { path: 'Projets/Budget.md', tasks: [
    { line: 4, completed: true, status: 'x', text: 'Devis client ⏱1h ✅ 2026-09-13' },
    { line: 5, completed: true, status: 'x', text: 'Tache sans date de completion ⏱1h' },
    { line: 6, completed: true, status: 'x', text: "Tache d'aout 2026 ⏱1h ✅ 2026-08-10" },
  ] } },
];

function render() {
  const root = makeElement();
  const dv = {
    app: {},
    pages: () => completedPages,
    date: (s) => (s === 'today' ? DateTime.fromISO(todayISO) : DateTime.fromISO(s)),
    paragraph: () => {},
    container: root,
  };
  const sandbox = {
    dv,
    document: { body: { classList: { contains: () => false } } },
    requestAnimationFrame: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    Math, Date, JSON, console, Array, Object, Set, Map,
    parseInt, parseFloat, isNaN, Infinity, RegExp, String, Number,
  };
  vm.createContext(sandbox);
  vm.runInContext(loadBundle(), sandbox);
  return root;
}

function titles(root) {
  return root.querySelectorAll('.crow')
    .map(el => {
      // Each crow's first span holds "title (hours)"; strip the " (...h)" suffix for a
      // clean title comparison (hours are validated separately in render_bundle.test.js).
      const span = el.querySelector('span') || el;
      return ((span._text || '').replace(/\s*\([^()]*\)$/, '').trim());
    })
    .filter(Boolean);
}

// ---- Assertions -----------------------------------------------------------
function run() {
  // default = current month (September): 3 tasks; August + undated hidden.
  // Branches render in ascending completion-date order (Budget 09-13, Onboarding 09-14,
  // Recrutement 09-15) -- mirroring the gantt's date sorting.
  let root = render();
  assert.deepStrictEqual(titles(root), ['Devis client', 'Accueil stagiaire', 'Tests unitaires'], 'default shows only September tasks');
  assert.strictEqual(root.querySelectorAll('.crow').length, 3, 'three task rows by default');

  // render() rebuilds the whole tree on every change, so element refs must be re-fetched
  // after each dispatch() (the old ones are detached once box.innerHTML is replaced).

  // ---- A single day: From = To = 2026-08-10 isolates the August task ----
  root = render();
  let st = findFirst(root, '.cdate-start-text');
  let et = findFirst(root, '.cdate-end-text');
  assert.ok(st && et, 'From/To text fields exist');
  st.value = '2026-08-10'; st.dispatch('input');
  et = findFirst(root, '.cdate-end-text'); // re-query: render() replaced the DOM
  et.value = '2026-08-10'; et.dispatch('input');
  assert.deepStrictEqual(titles(root), ["Tache d'aout 2026"], 'From=To single day filters to that task');
  assert.strictEqual(root.querySelectorAll('.crow').length, 1, 'one task row after narrowing to a day');

  // ---- A calendar range (change events) -> August only; dates must sync into text fields ----
  root = render();
  let sd = findFirst(root, '.cdate-start-date');
  let ed = findFirst(root, '.cdate-end-date');
  sd.value = '2026-08-01'; sd.dispatch('change');
  ed = findFirst(root, '.cdate-end-date'); // re-query after the first change rebuilt the tree
  ed.value = '2026-08-31'; ed.dispatch('change');
  assert.deepStrictEqual(titles(root), ["Tache d'aout 2026"], 'calendar range selects only August');
  // The calendar change must sync the date into the text field before filtering, so the
  // text field carries the exact picked value.
  assert.strictEqual(findFirst(root, '.cdate-start-text').value, '2026-08-01', 'start text synced from calendar');
  assert.strictEqual(findFirst(root, '.cdate-end-text').value, '2026-08-31', 'end text synced from calendar');

  // ---- A September range restores all three September tasks ----
  root = render();
  st = findFirst(root, '.cdate-start-text');
  et = findFirst(root, '.cdate-end-text');
  st.value = '2026-09-01'; st.dispatch('input');
  et = findFirst(root, '.cdate-end-text');
  et.value = '2026-09-30'; et.dispatch('input');
  assert.deepStrictEqual(titles(root), ['Devis client', 'Accueil stagiaire', 'Tests unitaires'], 'September range restores the three tasks');
  assert.strictEqual(root.querySelectorAll('.crow').length, 3, 'three task rows for the September range');

  console.log('  completed_filter: PASS');
}
run();

console.log('\nAll completed-filter tests passed!');
process.exit(0);
