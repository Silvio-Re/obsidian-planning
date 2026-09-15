// test/harness/sandbox.mjs — shared harness for end-to-end render tests.
//
// The render modules (render/*.js) import NON-exported helpers from utils.js (esc, clip,
// renderMd, openTask…), so they only work AFTER build.js has inlined everything into one
// flat file. We therefore run the BUNDLED planning.md in a vm sandbox with a mocked
// Obsidian `dv` + DOM, then assert on the generated SVG/HTML. This mirrors exactly what
// DataviewJS executes in the note.

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { DateTime } from 'luxon';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANNING_MD = path.join(__dirname, '..', '..', 'planning.md');

// Strip the ```dataviewjs fence so the body is plain runnable JS.
export function loadBundle() {
  const md = fs.readFileSync(PLANNING_MD, 'utf8');
  return md.replace(/^```dataviewjs\n/, '').replace(/\n```\s*$/, '');
}

// Minimal DOM element mock — enough for the renderers to build innerHTML + attach listeners.
export function makeEl(tag = 'div') {
  const el = {
    tagName: tag,
    style: {},
    _children: [],
    innerHTML: '',
    text: '',
    value: '',
    scrollLeft: 0,
    scrollTop: 0,
    get clientWidth() { return 900; },
    get clientHeight() { return 500; },
    classList: { contains: () => false },
    _listeners: {},
    createEl(childTag, opts) {
      const c = makeEl(childTag);
      if (opts) {
        if (opts.text != null) c.text = opts.text;
        if (opts.value != null) c.value = opts.value;
      }
      this._children.push(c);
      return c;
    },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 500, right: 900, bottom: 500 }; },
    scrollIntoView() {},
    focus() {},
    getLine() { return ''; },
    setSelection() {},
    appendChild(c) { this._children.push(c); return c; },
  };
  return el;
}

// Run the bundled dashboard against a set of fake Obsidian pages.
export function runBundle(pages, { today = '2026-09-15' } = {}) {
  const code = loadBundle();
  const root = makeEl();

  const dv = {
    app: {},
    pages: () => pages,
    date: (s) => (s === 'today' ? DateTime.fromISO(today) : DateTime.fromISO(s)),
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
  vm.runInContext(code, sandbox);
  return root;
}

// Depth-first walk over the mock DOM tree.
export function walkTree(el, visit) {
  visit(el);
  (el._children || []).forEach((c) => walkTree(c, visit));
}

// Return the innerHTML of the Gantt container (discriminated by the gantt-only "gbar" class).
export function findGanttSVG(root) {
  let found = null;
  walkTree(root, (el) => {
    if (!found && typeof el.innerHTML === 'string' && el.innerHTML.includes('class="gbar"')) {
      found = el.innerHTML;
    }
  });
  return found;
}

// Return the innerHTML of the execution-list container (rows carry class="prow"; meetings say "fixed").
export function findExecHTML(root) {
  let found = null;
  walkTree(root, (el) => {
    if (!found && typeof el.innerHTML === 'string' && el.innerHTML.includes('class="prow"') && el.innerHTML.includes('fixed')) {
      found = el.innerHTML;
    }
  });
  return found;
}
