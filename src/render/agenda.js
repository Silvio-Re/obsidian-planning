// src/render/agenda.js — "Today" panel: today's scheduled tasks and meetings as a
// compact agenda with times. Rendered at the TOP of the dashboard: it is the single
// most actionable view ("what do I do now, and when?").
// Depends on: dv, app (task openers) — tested via the bundled planning.md.

import { fmtHours } from '../constants.js';
import { esc, escA, renderMd, openTask, wireDoneButtons } from '../utils.js';

export function renderAgenda(container, agendaRows, calToDT) {
  const box = container.createEl('div');
  box.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;margin-top:4px;';

  if (!agendaRows.length) {
    box.innerHTML = '<div style="padding:8px;color:gray;font-size:12px;text-align:center;">Nothing scheduled today \u2014 no meetings and no task segments land on today.</div>';
    return;
  }

  const lines = [];
  agendaRows.forEach((e, i) => {
    // Meetings show their true clock time as written in the note (an 18:00 dinner
    // sync says 18:00); calToDT only maps into the working window. Tasks keep startCal.
    const time = e.kind === 'meet' && e.meetTrueTime != null ? e.meetTrueTime : calToDT(e.startCal).toFormat('HH:mm');
    const isMeet = e.kind === 'meet';
    const icon = isMeet ? '\u{1F4CC}' : '\u25b8';
    // Late meetings keep their purple identity (they are locked calendar events)
    // but gain the red contour + LATE tag, matching the Gantt's late-meeting look.
    const col = isMeet
      ? (e.late ? 'rgb(224,108,117)' : 'rgb(198,120,221)')
      : (e.late ? (e.priority === 2 ? 'rgb(255,165,80)' : 'rgb(224,108,117)') : 'rgb(97,175,239)');
    const lateTag = e.late ? ' · <b>LATE</b>' : '';
    const dueTxt = isMeet ? 'fixed' : `due ${esc(e.dl)}`;
    lines.push(
      `<div class="arow prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;display:flex;gap:8px;align-items:baseline;padding:3px 8px;border-bottom:1px solid rgba(128,128,128,0.15);">` +
      `<span style="color:${col};font-weight:600;white-space:nowrap;">${time}</span>` +
      `<span style="color:${col};">${icon}</span>` +
      `<div style="flex:1;overflow:hidden;"><div>${renderMd(e.title)} <b>(${fmtHours(e.hours)}h)</b></div>` +
      `<div style="color:gray;font-size:11px;">${esc(e.file)} \u00b7 ${dueTxt}${lateTag}</div></div>` +
      `<span class="done-btn" data-path="${escA(e.path)}" data-line="${e.line}" title="Mark as done for today" style="align-self:center;color:gray;cursor:pointer;padding:0 6px;user-select:none;">\u2713</span></div>`
    );
  });
  box.innerHTML = lines.join('');
  box.querySelectorAll('.prow').forEach(el => openTask(el));
  wireDoneButtons(box);
}
