// src/render_model.js - Pure, DOM-free model logic shared by the render/*.js modules.
//
// This holds the STATE + COMPUTATION behind the interactive views, with no reference to the DOM
// or to dv/app. It imports only constants.js (fully pure) and utils.js (its helpers are guarded
// against a missing dv), so every function here is unit-testable in isolation — no bundling, no
// vm sandbox, no Obsidian runtime. This is the whole point of P1.5: the render/*.js files are
// DOM glue (they build strings, attach handlers, call openTask) and still cannot be imported
// directly outside Obsidian, but the logic they run is now exercised by fast unit tests.
//
// Convention: functions moved here keep their original body verbatim (so bundled output is
// byte-identical). The tree helpers are parameterised by an explicit `collapsed` Set so tests can
// drive collapse/expand directly.

import { fmtHours } from './constants.js';
import { esc, escA, renderMd } from './utils.js';

// ---------------------------------------------------------------------------
// Shared tree construction
// ---------------------------------------------------------------------------

// Collect every group id under node (used by "fold all" / "unfold all").
export function collectGroupIds(node) {
  let ids = [];
  node.children.forEach(c => { ids.push(c.id); ids = ids.concat(collectGroupIds(c)); });
  return ids;
}

// Split a vault path into the breadcrumb segments shown as group headers.
export function segsOf(path) {
  const p = path.replace(/\.md$/, '');
  const parts = p.split('/');
  if (parts[0] === 'Projets') parts.shift();
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) parts.pop();
  return parts.length ? parts : ['(root)'];
}

// ---------------------------------------------------------------------------
// Gantt tree (Gantt uses two leaf kinds: tasks {k:'task', s, start} and meetings {k:'meet', l, start})
// ---------------------------------------------------------------------------

export function ganttNodeStart(node) {
  let mn = Infinity;
  node.items.forEach(e => mn = Math.min(mn, e.start));
  node.children.forEach(c => mn = Math.min(mn, ganttNodeStart(c)));
  return mn === Infinity ? 0 : mn;
}

export function ganttNodeTotal(node) {
  let sum = 0;
  for (const en of node.items) sum += en.k === 'task' ? (en.s.duration || 0) : (en.l.hours || 0);
  for (const c of node.children.values()) sum += ganttNodeTotal(c);
  return sum;
}

export function ganttAnnotate(node) {
  node.total = ganttNodeTotal(node);
  node.children.forEach(c => ganttAnnotate(c));
}

export function ganttCollectEntries(node, out) {
  node.items.forEach(e => out.push(e));
  node.children.forEach(c => ganttCollectEntries(c, out));
  return out;
}

export function ganttFlatten(node, collapsed, out, depth = 0) {
  const kids = [...node.children.values()].sort((a, b) => ganttNodeStart(a) - ganttNodeStart(b));
  for (const c of kids) {
    out.push({ type: 'group', node: c, depth });
    if (!collapsed.has(c.id)) {
      ganttFlatten(c, collapsed, out, depth + 1);
      c.items.slice().sort((a, b) => a.start - b.start).forEach(en =>
        out.push(en.k === 'task' ? { type: 'task', s: en.s, depth: depth + 1 } : { type: 'meet', l: en.l, depth: depth + 1 })
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Completed-tasks tree (leaf kind is always a task {k:'task', s, start}; s carries .hours)
// ---------------------------------------------------------------------------

export function completionStart(t) {
  const d = t.compDate ? Date.parse(t.compDate) : 0;
  return Number.isFinite(d) ? d : 0;
}

export function completionNodeTotal(node) {
  let sum = 0;
  for (const en of node.items) sum += en.s.hours || 0;
  for (const c of node.children.values()) sum += completionNodeTotal(c);
  return sum;
}

export function completionAnnotate(node) {
  node.total = completionNodeTotal(node);
  node.children.forEach(c => completionAnnotate(c));
}

export function completionNodeStart(node) {
  let mn = Infinity;
  node.items.forEach(e => mn = Math.min(mn, e.start));
  node.children.forEach(c => mn = Math.min(mn, completionNodeStart(c)));
  return mn === Infinity ? 0 : mn;
}

export function completionFlatten(node, collapsed, out, depth = 0) {
  const kids = [...node.children.values()].sort((a, b) => completionNodeStart(a) - completionNodeStart(b));
  for (const c of kids) {
    out.push({ type: 'group', node: c, depth });
    if (!collapsed.has(c.id)) {
      completionFlatten(c, collapsed, out, depth + 1);
      c.items.slice().sort((a, b) => a.start - b.start).forEach(en =>
        out.push(en.k === 'task' ? { type: 'task', s: en.s, depth: depth + 1 } : null)
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Execution list
// ---------------------------------------------------------------------------

// Build the execution-list DOM lines for a schedule sequence. Pure apart from the
// utils.js formatters (esc/escA/renderMd), which are safe in tests (dv is guarded).
export function buildLines(seq, calToDT) {
  const lines = [];
  let prevDate = null;
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

    lines.push(`<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid rgba(128,128,128,0.15);${lateStyle}"><span style="color:${col};font-weight:bold;float:left;width:24px;text-align:right;margin-right:8px;">${i + 1}.</span><div style="overflow:hidden;"><div style="margin-bottom:1px;">${renderMd(e.title)} <b>(${fmtHours(e.hours)}h)</b></div><div style="color:gray;font-size:11px;">${esc(e.file)} \u00b7 ${dueTxt}${e.late ? ' \u00b7 <b>LATE</b>' : ''}</div></div></div>`);
  });

  return lines;
}

// ---------------------------------------------------------------------------
// Capacity-chart zoom + pin helpers
// ---------------------------------------------------------------------------

export function clampScale(scale, min = 0.4, max = 30) {
  return Math.min(max, Math.max(min, scale));
}

// Pure: returns the new X scale and the scroll-left that keeps the anchor at position `anchor`
// (fraction of the visible width) fixed while zooming by factor `f`. `draw()` is the caller's job.
export function zoomX(f, { scaleX, totalDays, basePxPerDay, clientWidth, scrollLeft, anchor = 0.5, max = 30, min = 0.4 }) {
  const before = scrollLeft + anchor * clientWidth;
  const oldW = totalDays * basePxPerDay * scaleX;
  const nextScaleX = clampScale(scaleX * f, min, max);
  const newW = totalDays * basePxPerDay * nextScaleX;
  const nextScrollLeft = oldW > 0 ? before * (newW / oldW) - anchor * clientWidth : scrollLeft;
  return { scaleX: nextScaleX, scrollLeft: nextScrollLeft };
}

// Pure: same idea for the Y (rows) zoom.
export function zoomY(f, { scaleY, baseIH, clientHeight, scrollTop, anchor = 0.5, max = 20, min = 0.4 }) {
  const before = scrollTop + anchor * clientHeight;
  const oldH = baseIH * scaleY;
  const nextScaleY = clampScale(scaleY * f, min, max);
  const newH = baseIH * nextScaleY;
  const nextScrollTop = oldH > 0 ? before * (newH / oldH) - anchor * clientHeight : scrollTop;
  return { scaleY: nextScaleY, scrollTop: nextScrollTop };
}

// Pure pin model: toggle a day's pin in place (DOM glue re-applies visibility afterwards).
export function togglePin(pinned, day) {
  if (pinned.has(day)) pinned.delete(day); else pinned.add(day);
  return pinned;
}

export function clearPins(pinned) {
  pinned.clear();
  return pinned;
}
