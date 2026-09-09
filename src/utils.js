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
  function selectLine(path, line, tries) {
    const target = app.workspace.getLeavesOfType('markdown').find(l => 
      l.view && l.view.file && l.view.file.path === path
    );
    if (target && target.view.editor) {
      app.workspace.setActiveLeaf(target, { focus: true });
      const ed = target.view.editor;
      const len = (ed.getLine(line) || '').length;
      ed.setSelection({ line, ch: 0 }, { line, ch: len });
      ed.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: len } }, true);
      ed.focus();
    }
    else if (tries > 0) setTimeout(() => selectLine(path, line, tries - 1), 50);
  }
  return (el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = el.getAttribute('data-path');
      const l = parseInt(el.getAttribute('data-line'), 10);
      app.workspace.getLeaf('tab').openFile(app.vault.getAbstractFileByPath(p), { 
        active: true, 
        state: { line: l } 
      });
      selectLine(p, l, 12);
    });
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        const p = el.getAttribute('data-path');
        const l = parseInt(el.getAttribute('data-line'), 10);
        e.preventDefault();
        e.stopPropagation();
        app.workspace.getLeaf('tab').openFile(app.vault.getAbstractFileByPath(p), { 
          active: true, 
          state: { line: l } 
        });
        selectLine(p, l, 12);
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
