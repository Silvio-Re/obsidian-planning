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
  // Select a task line in an open markdown view. `leafHint` is the leaf returned by
  // openFile(): when the file is opened in a NEW tab the workspace's typed-leaf list
  // only exposes it after the view loads, so the hint is the only reliable handle for
  // a not-already-open file. The hint MUST be passed on EVERY retry — dropping it once
  // made selection depend entirely on the racy workspace search (see task_opener.test.js).
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
    else if (tries > 0) setTimeout(() => selectLine(path, line, tries - 1, leafHint), 100);
  }
  async function openAt(el) {
    const p = el.getAttribute('data-path');
    const l = parseInt(el.getAttribute('data-line'), 10);
    // getLeaf('tab') returns a leaf whose view is replaced asynchronously; openFile
    // resolves with the same leaf once the view is ready, so await it before selecting
    // and pass it as the hint. eState is Obsidian's built-in scroll-to-line: even if the
    // JS selection below gives up on a very slow load, the editor itself positions at
    // the line when it becomes ready.
    const leaf = app.workspace.getLeaf('tab');
    try {
      await leaf.openFile(app.vault.getAbstractFileByPath(p), {
        active: true,
        eState: { line: l }
      });
    } catch {
      return; // file missing from vault / open failed — nothing to select
    }
    // view.editor can lag the resolved promise by a few frames: poll with the hint kept,
    // up to ~3s (30 × 100ms) for slow storage (network shares, cold cache).
    selectLine(p, l, 30, leaf);
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

// Initialize openTask when dv is available
if (typeof dv !== 'undefined' && dv.app) {
  openTask = makeTaskOpener(dv.app);
}
