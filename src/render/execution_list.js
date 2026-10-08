// src/render/execution_list.js - Execution list rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

import { fmtHours } from '../constants.js';
import { esc, escA, renderMd, openTask } from '../utils.js';

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
    // Meetings keep their requested calendar date (a post-working-hours meeting must
    // show on that day, not roll to the next). Other rows fall back to startCal.
    const dateStr = e.meetDateStr || calToDT(e.startCal).toFormat('ccc dd LLL');
    const showDate = dateStr !== prevDate;
    if (showDate) prevDate = dateStr;

    let col, lateStyle;
    if (e.kind === 'meet') {
      if (e.late) {
        col = e.priority === 3 || e.priority === 4 ? 'rgb(128,128,128)' : (e.priority === 2 ? 'rgb(255,165,80)' : 'rgb(224,108,117)');
        lateStyle = 'background:rgba(224,108,117,0.1);';
      } else { col = 'rgb(198,120,221)'; lateStyle = ''; }
    }
    else if (e.late) {
      if (e.priority === 3 || e.priority === 4) { col = 'rgb(128,128,128)'; lateStyle = 'background:rgba(128,128,128,0.1);'; }
      else if (e.priority === 2) { col = 'rgb(255,165,80)'; lateStyle = 'background:rgba(255,165,80,0.1);'; }
      else { col = 'rgb(224,108,117)'; lateStyle = 'background:rgba(224,108,117,0.1);'; }
    } else { col = 'rgb(97,175,239)'; lateStyle = ''; }

    const dueTxt = e.kind === 'meet' ? 'fixed' : `due ${esc(e.dl)}`;

    if (showDate) {
      lines.push(`<div style="background:rgba(97,175,239,0.08);padding:3px 8px;font-weight:600;color:rgb(97,175,239);font-size:12px;border-bottom:1px solid rgba(128,128,128,0.2);">${esc(dateStr)}</div>`);
    }

    lines.push(`<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;display:flex;gap:8px;align-items:baseline;padding:3px 6px;border-bottom:1px solid rgba(128,128,128,0.15);${lateStyle}"><span style="color:${col};font-weight:bold;float:left;width:24px;text-align:right;margin-right:8px;">${i + 1}.</span><div style="flex:1;overflow:hidden;"><div style="margin-bottom:1px;">${renderMd(e.title)} <b>(${fmtHours(e.hours)}h)</b></div><div style="color:gray;font-size:11px;">${esc(e.file)} \u00b7 ${dueTxt}${e.late ? ' \u00b7 <b>LATE</b>' : ''}</div></div></div>`);
  });

  planDiv.innerHTML = lines.join('');
  planDiv.querySelectorAll('.prow').forEach(el => openTask(el));
}
