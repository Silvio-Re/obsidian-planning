// src/render/completed.js - Completed tasks tree (Obsidian/Dataview dependent)
// Renders finished ([x]) tasks as a foldable project/subproject tree that mirrors the
// FIRST COLUMN of the Gantt chart: group headers with cumulative hours, task rows with
// individual hours, ▸/▾ fold/unfold, depth indentation, click-to-open tasks.
//
// Example output (group header + task rows):
//   ▾ 📂 Formation (3.25h)
//     Formulaire de demande de formation (1h) ✅ 2026-09-15
//   ▸ 📂 Budget (1.5h)
//
// This is a direct copy of the gantt.js first-column logic, fed with the completed list.

import { fmtHours, CHECK, completionKey, filterByCompletionRange, isCompleteDate, currentMonth, monthStartKey, monthEndKey } from '../constants.js';
import { esc, escA, clip, openTask } from '../utils.js';

/**
 * Render completed tasks as a foldable tree by project/subproject.
 * Depends on: dv, app, and the completed-tasks list (from the parser).
 *
 * @param {HTMLElement} container
 * @param {Array<{path:string, line:number, title:string, hours:number, compDate:string|null}>} completed
 * @param {DateTime|Date} today
 */
export function renderCompleted(container, completed, today) {
  const geo = { pad: 6, step: 14, max: 460 };

  const box = container.createEl('div');
  box.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,128,0.2);border-radius:6px;overflow:hidden;margin-top:4px;';

  // Only tasks that have a completion date are ever shown.
  const done = (completed || []).filter(t => t.compDate);

  if (!done.length) {
    box.innerHTML = '<div style="padding:8px;color:gray;font-size:12px;text-align:center;">No completed tasks found.</div>';
    return;
  }

  // Default range = the current month (From = 1st, To = last day).
  const cur = currentMonth(today);
  const startKey = monthStartKey(cur.year, cur.month);
  const endKey = monthEndKey(cur.year, cur.month);

  // --- Build the project/subproject tree (near-identical to gantt.js first column) ---
  const cRoot = { id: '', label: '', children: new Map(), items: [] };

  function cSegsOf(path) {
    const p = path.replace(/\.md$/, '');
    const parts = p.split('/');
    if (parts[0] === 'Projets') parts.shift();
    if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) parts.pop();
    return parts.length ? parts : ['(root)'];
  }
  function cStartOf(t) {
    // Order completed tasks within a branch by completion date (the gantt uses scheduling start).
    const d = t.compDate ? Date.parse(t.compDate) : 0;
    return Number.isFinite(d) ? d : 0;
  }
  function cAddEntry(path, en) {
    const parts = cSegsOf(path);
    let node = cRoot;
    let idAcc = '';
    parts.forEach(seg => {
      idAcc += (idAcc ? '/' : '') + seg;
      if (!node.children.has(seg)) {
        node.children.set(seg, { id: idAcc, label: seg, children: new Map(), items: [] });
      }
      node = node.children.get(seg);
    });
    node.items.push(en);
  }

  // Cumulative hours for a node = sum of its task hours + all descendant group totals.
  function cNodeTotal(node) {
    let sum = 0;
    for (const en of node.items) sum += en.s.hours || 0;
    for (const c of node.children.values()) sum += cNodeTotal(c);
    return sum;
  }
  function cAnnotate(node) {
    node.total = cNodeTotal(node);
    node.children.forEach(c => cAnnotate(c));
  }

  // Earliest completion date among a node's descendants (used to sort branches).
  function cNodeStart(node) {
    let mn = Infinity;
    node.items.forEach(e => mn = Math.min(mn, e.start));
    node.children.forEach(c => mn = Math.min(mn, cNodeStart(c)));
    return mn === Infinity ? 0 : mn;
  }

  const cCollapsed = new Set();
  function cFlatten(node, depth, out) {
    const kids = [...node.children.values()].sort((a, b) => cNodeStart(a) - cNodeStart(b));
    for (const c of kids) {
      out.push({ type: 'group', node: c, depth });
      if (!cCollapsed.has(c.id)) {
        cFlatten(c, depth + 1, out);
        c.items.slice().sort((a, b) => a.start - b.start).forEach(en =>
          out.push(en.k === 'task' ? { type: 'task', s: en.s, depth: depth + 1 } : null)
        );
      }
    }
    return out;
  }

  function cGroupRow(c, depth) {
    const isColl = cCollapsed.has(c.id);
    const tri = isColl ? '\u25b8' : '\u25be';
    const isLeaf = c.children.size === 0;
    const icon = isLeaf ? '\u{1F4C4}' : '\u{1F4C1}';
    const col = isLeaf ? 'rgb(152,195,121)' : 'rgb(97,175,239)';
    const bg = isLeaf ? 'rgba(152,195,121,0.10)' : 'rgba(97,175,239,0.10)';
    const ind = geo.pad + depth * geo.step;
    const label = esc(clip(c.label, Math.max(8, 34 - depth * 3)));
    return (
      `<div class="cgroup" data-node="${escA(c.id)}" data-label="${escA(c.label)}" ` +
      `style="display:flex;align-items:center;gap:4px;padding:3px 8px;padding-left:${ind}px;` +
      `border-bottom:1px solid rgba(128,128,128,0.1);background:${bg};cursor:pointer;">` +
      `<span style="color:${col}">${tri}</span><span style="color:${col}">${icon}</span>` +
      `<span style="color:${col};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span>` +
      `<span style="color:gray;font-size:12px;white-space:nowrap;">(${fmtHours(c.total)}h)</span></div>`
    );
  }

  function cTaskRow(t, depth) {
    const ind = geo.pad + depth * geo.step;
    const title = esc(clip(t.title, Math.max(6, 26 - depth * 3)));
    const date = t.compDate ? `<span style="color:gray;font-size:12px;white-space:nowrap;"> ${CHECK} ${esc(t.compDate)}</span>` : '';
    return (
      `<div class="crow" data-path="${escA(t.path)}" data-line="${t.line}" ` +
      `style="display:flex;align-items:center;gap:4px;padding:3px 8px;padding-left:${ind}px;` +
      `border-bottom:1px solid rgba(128,128,128,0.1);">` +
      `<span style="color:gray;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;">${title} (${fmtHours(t.hours)}h)</span>` +
      `${date}</div>`
    );
  }

  function rowsHtml() {
    const rows = cFlatten(cRoot, 0, []);
    let html = '';
    rows.forEach(r => {
      if (r.type === 'group') html += cGroupRow(r.node, r.depth);
      else if (r.type === 'task') html += cTaskRow(r.s, r.depth);
    });
    return html;
  }

  // Rebuild the tree from a visible (already date-filtered) task list and recompute totals.
  function build(visible) {
    cRoot.id = '';
    cRoot.label = '';
    cRoot.children = new Map();
    cRoot.items = [];
    visible.forEach(t => cAddEntry(t.path, { k: 'task', s: t, start: cStartOf(t) }));
    cAnnotate(cRoot);
  }

  // The text field is authoritative for reading the range; it falls back to the default
  // (current month) when empty/incomplete.
  function readRange() {
    const ts = box.querySelectorAll('.cdate-start-text');
    const te = box.querySelectorAll('.cdate-end-text');
    const s = ts.length ? ts[0].value : '';
    const e = te.length ? te[0].value : '';
    return { start: isCompleteDate(s) ? s : startKey, end: isCompleteDate(e) ? e : endKey };
  }

  // Build the toolbar with the CURRENT range baked into the inputs, so a rebuild does not
  // discard a user's selection.
  function buildToolbar(start, end) {
    return '<div style="margin:4px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
      '<label style="font-size:12px;color:var(--text-muted);">From</label>' +
      `<input class="cdate-start-date" type="date" value="${start}" style="padding:2px 18px 2px 4px;width:140px;">` +
      `<input class="cdate-start-text" type="text" inputmode="date" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxlength="10" value="${start}" style="padding:2px 4px;width:110px;">` +
      '<label style="font-size:12px;color:var(--text-muted);">To</label>' +
      `<input class="cdate-end-date" type="date" value="${end}" style="padding:2px 18px 2px 4px;width:140px;">` +
      `<input class="cdate-end-text" type="text" inputmode="date" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxlength="10" value="${end}" style="padding:2px 4px;width:110px;">` +
      '<button type="button" class="cfoldall" style="cursor:pointer;padding:2px 8px;">fold all</button>' +
      '<button type="button" class="cunfoldall" style="cursor:pointer;padding:2px 8px;">unfold all</button></div>';
  }

  const listWrap = '<div style="overflow:auto;max-height:' + geo.max + 'px;">';

  function render() {
    const { start, end } = readRange();
    const visible = filterByCompletionRange(done, start, end);
    build(visible);

    box.innerHTML = buildToolbar(start, end) + listWrap + rowsHtml() + '</div>';

    // Re-bind handlers after each rebuild (querySelectorAll is a no-op in the test mock).
    box.querySelectorAll('.cfoldall').forEach(b => b.onclick = () => {
      cFlatten(cRoot, 0, []).filter(r => r.type === 'group').forEach(r => cCollapsed.add(r.node.id));
      render();
    });
    box.querySelectorAll('.cunfoldall').forEach(b => b.onclick = () => { cCollapsed.clear(); render(); });
    box.querySelectorAll('.cgroup').forEach(g => g.addEventListener('click', () => {
      const id = g.getAttribute('data-node');
      if (!id) return;
      if (cCollapsed.has(id)) cCollapsed.delete(id); else cCollapsed.add(id);
      render();
    }));
    box.querySelectorAll('.crow').forEach(el => openTask(el));

    // Date filters: typing a date (or picking one in the calendar) re-filters the tree and
    // keeps the date/text fields in sync. Each date field sits right after its text field,
    // so a text field's previous sibling is its date field and vice versa.
    box.querySelectorAll('.cdate-start-text, .cdate-end-text').forEach(f =>
      f.addEventListener('input', e => {
        const el = e.currentTarget;
        if (isCompleteDate(el.value)) {
          const dateEl = el.previousElementSibling;
          if (dateEl) dateEl.value = el.value;
          render();
        }
      }),
    );
    box.querySelectorAll('.cdate-start-date, .cdate-end-date').forEach(f =>
      f.addEventListener('change', e => {
        const el = e.currentTarget;
        const textEl = el.nextElementSibling;
        if (textEl) textEl.value = el.value;
        render();
      }),
    );
  }

  render();
}
