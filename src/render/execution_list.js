// src/render/execution_list.js - Execution list rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

/**
 * Render execution list
 * Depends on: dv, app, and schedule data
 */
export function renderExecutionList(container, seq, calToDT) {
  const planDiv = container.createEl('div');
  planDiv.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;';
  let prevDate = null;
  const lines = [];

  seq.forEach((e, i) => {
    const dateStr = calToDT(e.startCal).toFormat('ccc dd LLL');
    const showDate = dateStr !== prevDate;
    if (showDate) prevDate = dateStr;

    let col, lateStyle;
    if (e.kind === 'meet') { col = 'rgb(198,120,221)'; lateStyle = ''; }
    else if (e.late) {
      if (e.priority === 3 || e.priority === 4) { col = 'rgb(128,128,128)'; lateStyle = 'background:rgba(128,128,128,0.1);'; }
      else if (e.priority === 2) { col = 'rgb(255,165,80)'; lateStyle = 'background:rgba(255,165,80,0.1);'; }
      else { col = 'rgb(224,108,117)'; lateStyle = 'background:rgba(224,108,117,0.1);'; }
    } else { col = 'rgb(97,175,239)'; lateStyle = ''; }

    const dueTxt = e.kind === 'meet' ? 'fixed' : `due ${esc(e.dl)}`;

    if (showDate) {
      lines.push(`<div style="background:rgba(97,175,239,0.08);padding:3px 8px;font-weight:600;color:rgb(97,175,239);font-size:12px;border-bottom:1px solid rgba(128,128,128,0.2);">${esc(dateStr)}</div>`);
    }

    lines.push(`<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid rgba(128,128,128,0.15);${lateStyle}"><span style="color:${col};font-weight:bold;float:left;width:24px;text-align:right;margin-right:8px;">${i + 1}.</span><div style="overflow:hidden;"><div style="margin-bottom:1px;">${renderMd(e.title)} <b>(${fmtHours(e.hours)}h)</b></div><div style="color:gray;font-size:11px;">${esc(e.file)} \u00b7 ${dueTxt}${e.late ? ' \u00b7 <b>LATE</b>' : ''}</div></div></div>`);
  });

  planDiv.innerHTML = lines.join('');
  planDiv.querySelectorAll('.prow').forEach(el => openTask(el));
}

// Helper functions shared with other render modules
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escA(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function fmtHours(h) { return h.toFixed(1).replace(/\.0$/, ''); }
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
