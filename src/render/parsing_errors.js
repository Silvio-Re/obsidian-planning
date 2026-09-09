// src/render/parsing_errors.js - Parsing errors rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

/**
 * Render parsing errors
 * Depends on: dv, app, and warnings list
 */
export function renderParsingErrors(container, warnings) {
  const errDiv = container.createEl('div');
  errDiv.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,0.25);border-radius:6px;overflow:hidden;';

  if (!warnings.length) {
    errDiv.createEl('div', { text: 'No parsing errors found - all task metadata is valid.' })
      .style.cssText = 'padding:5px;color:gray;font-size:12px;text-align:center;';
    return;
  }

  const rows = warnings.map((e, idx) => {
    const errorList = e.errors.map(err => `<span style="color:rgb(224,108,117);font-size:11px;">${esc(err)}</span>`).join(' \u00b7 ');
    return `<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;padding:4px 8px;border-bottom:1px solid rgba(128,128,0.15);">
      <span style="color:rgb(255,165,0);font-weight:bold;min-width:24px;display:inline-block;text-align:right;margin-right:8px;">${idx + 1}.</span>
      <div style="overflow:hidden;">
        <div style="margin-bottom:2px;">${renderMd(e.text)}</div>
        <div style="color:gray;font-size:11px;">${esc(e.file)} \u00b7 L${e.line} \u00b7 ${errorList}</div>
      </div>
    </div>`;
  });

  errDiv.innerHTML = rows.join('');
  errDiv.querySelectorAll('.prow').forEach(el => openTask(el));

  if (warnings.length > 10) {
    errDiv.createEl('div', { text: `... and ${warnings.length - 10} more parsing errors.` })
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
