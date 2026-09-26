// src/utils.js - Shared utility functions for rendering modules
// These are Obsidian/Dataview dependent - not testable outside Obsidian

// Helper functions for HTML escaping
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escA(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderMd(s) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  return h;
}

function clip(s, k) {
  return s.length > k ? s.slice(0, k - 1) + '\u2026' : s;
}

// Task opener utility - creates a function to open tasks in Obsidian
function makeTaskOpener(app) {
  // Select a task line in an open markdown view. `leafHint` is the leaf returned by the
  // synchronous part of openFile(): when the file is opened in a NEW tab the workspace's
  // leaf list only exposes it after the view loads, so searching leaves alone races the
  // load and gives up after the retries. Preferring the hint first, then falling back to
  // the workspace search, makes the line selection work for left and middle click alike.
  function selectLine(path, line, tries, leafHint) {
    // Prefer an already-open leaf (avoids hijacking a duplicate new tab), then fall back
    // to the opened leaf as hint — when the file opens in a NEW tab the workspace's leaf
    // list only exposes it after the view loads, so the hint is the only reliable handle.
    const candidates = [];
    for (const l of app.workspace.getLeavesOfType('markdown')) candidates.push(l);
    if (leafHint) candidates.push(leafHint);
    const target = candidates.find(l =>
      l && l.view && l.view.file && l.view.file.path === path && l.view.editor
    );
    if (target) {
      app.workspace.setActiveLeaf(target, { focus: true });
      const ed = target.view.editor;
      const len = (ed.getLine(line) || '').length;
      ed.setSelection({ line, ch: 0 }, { line, ch: len });
      ed.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: len } }, true);
      ed.focus();
    }
    else if (tries > 0) setTimeout(() => selectLine(path, line, tries - 1), 50);
  }
  function openAt(el) {
    const p = el.getAttribute('data-path');
    const l = parseInt(el.getAttribute('data-line'), 10);
    // getLeaf('tab') returns a leaf whose view is replaced asynchronously; openFile
    // resolves with the same leaf, so pass it through as the selection hint.
    const leaf = app.workspace.getLeaf('tab');
    leaf.openFile(app.vault.getAbstractFileByPath(p), {
      active: true,
      state: { line: l }
    });
    selectLine(p, l, 12, leaf);
  }
  return (el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openAt(el);
    });
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        openAt(el);
      }
    });
  };
}

// Shared openTask instance (will be initialized in main)
let openTask = null;

// Mark a task line as completed by appending the \u2705 completion marker with
// today's date, via vault.process (atomic read-modify-write). Returns true when
// the line was modified. Refuses when the line already carries a completion
// date or when the line index is out of range, so double clicks are no-ops.
function makeTaskCompleter(app, todayISO) {
  return (path, line) => {
    try {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file || file.path !== path) return false;
      let changed = false;
      app.vault.process(file, (text) => {
        const lines = text.split('\n');
        if (line < 0 || line >= lines.length) return text;
        if (/\u2705/.test(lines[line])) return text;
        lines[line] = lines[line].replace(/\s*$/, '') + ' \u2705 ' + todayISO;
        changed = true;
        return lines.join('\n');
      });
      return changed;
    } catch (_) {
      return false;
    }
  };
}

// Shared completeTask instance (initialized in main, once today is known).
let completeTask = null;

// Initialize openTask when dv is available
if (typeof dv !== 'undefined' && dv.app) {
  openTask = makeTaskOpener(dv.app);
  completeTask = makeTaskCompleter(dv.app, dv.date('today').toFormat('yyyy-MM-dd'));
}

// Attach the \u2713 done-buttons inside a rendered panel. Each button marks its
// task line completed (\u2705 today) in the source note; the row then greys out.
// The click stops propagation so the row's own open-on-click keeps working, and
// a successful completion disables the button to make double clicks no-ops.
function wireDoneButtons(panel) {
  panel.querySelectorAll('.done-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (btn.dataset.done === '1') return;
      const ok = completeTask && completeTask(btn.getAttribute('data-path'), parseInt(btn.getAttribute('data-line'), 10));
      if (ok) {
        btn.dataset.done = '1';
        btn.style.color = 'rgb(129,181,98)';
        btn.style.fontWeight = 'bold';
        btn.title = 'Completed today \u2014 refresh to see the plan update';
      }
    });
  });
}
