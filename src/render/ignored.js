// src/render/ignored.js - Ignored tasks rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

/**
 * Get reason why a task was ignored
 */
export function getIgnoreReason(d) {
  if (!d.ownDL && !d.graphDL) return 'no deadline or inherited deadline';
  if (!d.ownDL) return 'no own deadline and inherited deadline is invalid';
  if (d.eff === null) return 'locked task';
  return 'no effective deadline';
}

/**
 * Render ignored tasks
 * Depends on: dv, app, and ignored tasks list
 */
export function renderIgnored(container, ignored) {
  const dropDiv = container.createEl('div');
  dropDiv.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;';
  dropDiv.innerHTML = ignored.slice(0, 10).map((d, idx) => `
    <div class="prow" data-path="${escA(d.path)}" data-line="${d.line}" 
         style="cursor:pointer;display:flex;gap:8px;align-items:baseline;padding:4px 8px;border-bottom:1px solid rgba(128,128,128,0.15);">
      <span style="color:rgb(224,108,117);font-weight:bold;">${idx + 1}.</span>
      <div style="flex:1;">
        <div>${renderMd(d.title)}</div>
        <div style="color:gray;font-size:11px;margin-top:2px;">ignored: ${esc(getIgnoreReason(d))}</div>
      </div>
    </div>`).join('');

  dropDiv.querySelectorAll('.prow').forEach(el => openTask(el));

  if (ignored.length > 10) {
    dropDiv.createEl('div', { text: `... and ${ignored.length - 10} more ignored tasks.` })
      .style.cssText = 'padding:5px;color:gray;font-size:12px;text-align:center;';
  }
  else if (ignored.length === 0) {
    dropDiv.createEl('div', { text: 'No first-class undone tasks found that were filtered out.' })
      .style.cssText = 'padding:5px;color:gray;font-size:12px;text-align:center;';
  }
}

// Helper functions shared with other render modules
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escA(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function renderMd(s) { let h = esc(s); h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/~~(.+?)~~/g, '<del>$1</del>').replace(/`(.+?)`/g, '<code>$1</code>'); return h; }

function makeTaskOpener(app) {
  function selectLine(path, line, tries) {
    const target = app.workspace.getLeavesOfType('markdown').find(l => l.view && l.view.file && l.view.file.path === path);
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
      app.workspace.getLeaf('tab').openFile(app.vault.getAbstractFileByPath(p), { active: true, state: { line: l } });
      selectLine(p, l, 12);
    });
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        const p = el.getAttribute('data-path');
        const l = parseInt(el.getAttribute('data-line'), 10);
        e.preventDefault();
        e.stopPropagation();
        app.workspace.getLeaf('tab').openFile(app.vault.getAbstractFileByPath(p), { active: true, state: { line: l } });
        selectLine(p, l, 12);
      }
    });
  };
}

const openTask = makeTaskOpener(dv.app);
