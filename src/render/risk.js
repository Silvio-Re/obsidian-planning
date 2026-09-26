// src/render/risk.js — at-risk panel: tasks with only a thin slack margin.
// Obsidian/Dataview dependent — tested via the bundled planning.md.
import { fmtHours } from '../constants.js';
import { esc, escA, renderMd, openTask } from '../utils.js';

export function renderRisk(container, atRisk) {
  const div = container.createEl('div');
  div.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;';
  if (!atRisk.length) {
    div.innerHTML = '<div style="padding:8px;color:gray;font-size:12px;text-align:center;">No thin-margin tasks — every on-time task keeps at least a quarter day of slack before its deadline.</div>';
    return;
  }
  div.innerHTML = atRisk.map(t => `
    <div class="prow" data-path="${escA(t.path)}" data-line="${t.line}"
         style="cursor:pointer;display:flex;gap:8px;align-items:baseline;padding:4px 8px;border-bottom:1px solid rgba(128,128,128,0.15);">
      <span style="color:rgb(255,165,80);font-weight:bold;">${fmtHours(Math.max(0, t.slackHours))}h</span>
      <div style="flex:1;overflow:hidden;">
        <div>${renderMd(t.title)} <b>(${fmtHours(t.duration)}h)</b></div>
        <div style="color:gray;font-size:11px;margin-top:2px;">slack before due ${esc(t.deadline.toFormat('dd LLL yyyy'))} · ${esc(t.file)}</div>
      </div>
    </div>`).join('');
  div.querySelectorAll('.prow').forEach(el => openTask(el));
}
