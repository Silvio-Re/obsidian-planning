// src/render/gantt.js - Gantt chart rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

import { CALENDAR, ID_MARKER } from '../constants.js';

/**
 * Render Gantt chart
 * Depends on: dv, app, and schedule data
 */
export function renderGantt(container, scheduleData) {
  const { sched, meetData, today, SCHEDULE, calToDT, idToAll } = scheduleData;
  const gm = { top: 42, lab: 270, r: 20 };
  const maxCal = Math.max(...sched.map(s => Math.max(s.endCal, s.dlIdx + 1)), ...meetData.map(l => l.calE), 1);
  const gDays = Math.ceil(maxCal) + 3;

  // Build tree structure for grouping
  const root = { id: '', label: '', children: new Map(), items: [] };
  function segsOf(path) {
    const p = path.replace(/\.md$/, '');
    const parts = p.split('/');
    if (parts[0] === 'Projets') parts.shift();
    if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) parts.pop();
    return parts.length ? parts : ['(root)'];
  }
  function addEntry(path, en) {
    const parts = segsOf(path);
    let node = root;
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
  sched.forEach(s => addEntry(s.path, { k: 'task', s, start: s.startCal }));
  meetData.forEach(l => addEntry(l.path, { k: 'meet', l, start: l.calS }));

  function nodeTotal(node) {
    let sum = 0;
    for (const en of node.items) sum += en.k === 'task' ? (en.s.duration || 0) : (en.l.hours || 0);
    for (const c of node.children.values()) sum += nodeTotal(c);
    return sum;
  }
  function annotateTotals(node) {
    node.total = nodeTotal(node);
    node.children.forEach(c => annotateTotals(c));
  }
  annotateTotals(root);

  function nodeStart(node) {
    let mn = Infinity;
    node.items.forEach(e => mn = Math.min(mn, e.start));
    node.children.forEach(c => mn = Math.min(mn, nodeStart(c)));
    return mn === Infinity ? 0 : mn;
  }
  function collectEntries(node, out) {
    node.items.forEach(e => out.push(e));
    node.children.forEach(c => collectEntries(c, out));
    return out;
  }

  const collapsed = new Set();
  function flatten(node, depth, out) {
    const kids = [...node.children.values()].sort((a, b) => nodeStart(a) - nodeStart(b));
    for (const c of kids) {
      out.push({ type: 'group', node: c, depth });
      if (!collapsed.has(c.id)) {
        flatten(c, depth + 1, out);
        c.items.slice().sort((a, b) => a.start - b.start).forEach(en =>
          out.push(en.k === 'task' ? { type: 'task', s: en.s, depth: depth + 1 } : { type: 'meet', l: en.l, depth: depth + 1 })
        );
      }
    }
  }

  const gbar = container.createEl('div');
  gbar.style.cssText = 'margin:4px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
  gbar.createEl('span', { text: 'X' }).style.cssText = 'font-size:12px;color:gray;';
  const gxOut = mkBtn(gbar, '\u2212');
  const gxReset = mkBtn(gbar, 'reset');
  const gxIn = mkBtn(gbar, '+');
  gbar.createEl('span', { text: '  rows' }).style.cssText = 'font-size:12px;color:gray;';
  const gyOut = mkBtn(gbar, '\u2212');
  const gyIn = mkBtn(gbar, '+');
  const collapseAll = mkBtn(gbar, 'fold all');
  const expandAll = mkBtn(gbar, 'unfold all');
  gbar.createEl('span', { text: `  (\u25b8/\u25be fold \u25a6 Planning row stacks all)` }).style.cssText = 'color:gray;font-size:12px;';
  const gscroll = container.createEl('div');
  gscroll.style.cssText = 'overflow:auto;width:100%;max-height:460px;border:1px solid rgba(128,128,128,0.2);';

  const basePxG = Math.max(6, 900 / gDays);
  let gScaleX = 1;
  let gRowH = 24;

  function allGroupIds(node, acc) {
    node.children.forEach(c => { acc.push(c.id); allGroupIds(c, acc); });
    return acc;
  }

  function drawGantt() {
    sched.forEach(s => s.__row = null);
    meetData.forEach(l => l.__row = null);
    const visible = [];
    flatten(root, 0, visible);
    visible.push({ type: 'planning', depth: 0 });
    const pxG = basePxG * gScaleX;
    const rh = gRowH;
    const W = gm.lab + gDays * pxG + gm.r;
    const H = gm.top + visible.length * rh + 16;
    const xAt = (c) => gm.lab + c * pxG;
    const midY = (ri) => gm.top + ri * rh + rh / 2;

    let axis = '';
    let grid = '';
    for (let d = 0; d <= gDays; d++) {
      const dt = today.plus({ days: d });
      const x = xAt(d);
      if (dt.day === 1) {
        grid += `<line x1="${x}" y1="${gm.top}" x2="${x}" y2="${H - 16}" stroke="rgba(128,128,128,0.5)"/>`;
        axis += `<text x="${x + 3}" y="${gm.top - 22}" font-size="12" fill="gray">${dt.toFormat('yyyy-MM')}</text>`;
      } else if (dt.weekday === 1) {
        grid += `<line x1="${x}" y1="${gm.top}" x2="${x}" y2="${H - 16}" stroke="rgba(128,128,128,0.15)"/>`;
      } else if (dt.weekday > 5) {
        grid += `<rect x="${x}" y="${gm.top}" width="${pxG}" height="${H - 16 - gm.top}" fill="rgba(128,128,128,0.07)"/>`;
      }
    }
    const step = Math.max(1, Math.round(gDays / Math.max(1, Math.floor((gDays * pxG) / 90))));
    for (let d = 0; d <= gDays; d += step) {
      axis += `<text x="${xAt(d)}" y="${gm.top - 5}" font-size="11" text-anchor="middle" fill="gray">${today.plus({ days: d }).toFormat('MM-dd')}</text>`;
    }

    const meetBar = (l, y, ri, setRow = true) => {
      if (setRow) l.__row = ri;
      const x1 = xAt(l.calS);
      const w = Math.max(4, xAt(l.calE) - x1);
      return `<rect class="gbar" data-path="${escA(l.path)}" data-line="${l.line}" x="${x1}" y="${y}" width="${w}" height="${rh - 8}" rx="3" fill="rgba(198,120,221,0.9)" stroke="rgba(255,255,255,0.6)" cursor="pointer"><title>${esc(l.title)} \u00b7 ${l.day.toFormat('yyyy-MM-dd')} ${String(l.hour).padStart(2, '0')}:${String(l.min).padStart(2, '0')} \u00b7 ${fmtHours(l.hours)}h (locked)</title></rect>`;
    };

    const taskBars = (s, y, ri, setRow = true) => {
      if (setRow) s.__row = ri;
      let fill, stroke, strokeWidth;
      if (s.late) {
        if (s.priority === 3 || s.priority === 4) { fill = 'rgb(128,128,128)'; stroke = 'rgb(64,64,64)'; strokeWidth = 2; }
        else if (s.priority === 2) { fill = 'rgb(255,165,80)'; stroke = 'rgb(200,120,40)'; strokeWidth = 2; }
        else { fill = 'rgb(224,108,117)'; stroke = 'rgb(150,0,0)'; strokeWidth = 2; }
      } else { fill = 'rgba(97,175,239,0.9)'; stroke = 'rgba(255,255,255,0.6)'; strokeWidth = 1; }
      let o = '';
      s.segs.forEach(seg => {
        const x1 = xAt(seg.calS);
        const w = Math.max(2, xAt(seg.calE) - x1);
        o += `<rect class="gbar" data-path="${escA(s.path)}" data-line="${s.line}" x="${x1}" y="${y}" width="${w}" height="${rh - 8}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" cursor="pointer"><title>${esc(s.title)} \u00b7 ${s.duration}h \u00b7 due ${esc(s.deadline.toFormat('yyyy-MM-dd'))}${s.late ? ' \u00b7 LATE' : ''}</title></rect>`;
      });
      return o;
    };

    let rows = '';
    visible.forEach((r, ri) => {
      const y = gm.top + ri * rh;
      const ind = 6 + r.depth * 14;
      if (r.type === 'planning') {
        rows += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(128,128,128,0.5)"/><rect x="0" y="${y}" width="${W}" height="${rh}" fill="rgba(229,192,123,0.18)"/><text x="6" y="${y + rh / 2 + 4}" font-size="12" font-weight="700" fill="rgb(209,154,102)" pointer-events="none">\u25a6 Planning</text>`;
        sched.forEach(s => rows += taskBars(s, y + 5, ri, false));
        meetData.forEach(l => rows += meetBar(l, y + 5, ri, false));
        return;
      }
      if (r.type === 'group') {
        const c = r.node;
        const isColl = collapsed.has(c.id);
        const tri = isColl ? '\u25b8' : '\u25be';
        const isLeaf = c.children.size === 0;
        const icon = isLeaf ? '\u{1F4C4}' : '\u{1F4C1}';
        const col = isLeaf ? 'rgb(152,195,121)' : 'rgb(97,175,239)';
        const bg = isLeaf ? 'rgba(152,195,121,0.10)' : 'rgba(97,175,239,0.10)';
        rows += `<rect x="0" y="${y}" width="${W}" height="${rh}" fill="${bg}"/> <text x="${ind}" y="${y + rh / 2 + 4}" font-size="12" fill="${col}" pointer-events="none">${tri} ${icon} ${esc(clip(c.label, Math.max(8, 34 - r.depth * 3)))} <tspan fill="gray">(${fmtHours(c.total)}h)</tspan></text>`;
        if (isColl) {
          collectEntries(c, []).forEach(en => {
            if (en.k === 'task') rows += taskBars(en.s, y + 5, ri);
            else rows += meetBar(en.l, y + 5, ri);
          });
        }
        rows += `<rect class="gfold" data-node="${escA(c.id)}" x="0" y="${y}" width="${gm.lab}" height="${rh}" fill="transparent" cursor="pointer"/>`;
        return;
      }
      rows += `<line x1="0" y1="${y + rh}" x2="${W}" y2="${y + rh}" stroke="rgba(128,128,128,0.12)"/>`;
      if (r.type === 'meet') {
        const l = r.l;
        rows += `<text class="glabel" data-path="${escA(l.path)}" data-line="${l.line}" x="${ind + 6}" y="${y + rh / 2 + 4}" font-size="12" fill="rgb(198,120,221)" cursor="pointer">\u{1F4CC} ${esc(clip(l.title, Math.max(6, 26 - r.depth * 3)))} (${fmtHours(l.hours)}h)</text>` + meetBar(l, y + 4, ri);
        return;
      }
      const s = r.s;
      const textColor = s.late ? (s.priority === 3 || s.priority === 4 ? 'rgb(128,128,128)' : (s.priority === 2 ? 'rgb(255,165,80)' : 'rgb(224,108,117)')) : 'gray';
      rows += `<text class="glabel" data-path="${escA(s.path)}" data-line="${s.line}" x="${ind + 6}" y="${y + rh / 2 + 4}" font-size="12" fill="${textColor}" cursor="pointer">${esc(clip(s.title, Math.max(6, 26 - r.depth * 3)))} (${fmtHours(s.duration)}h)</text>` + taskBars(s, y + 4, ri);
      const dx = xAt(s.dlIdx);
      rows += `<line x1="${dx}" y1="${y + 2}" x2="${dx}" y2="${y + rh - 2}" stroke="${s.late ? 'rgb(224,108,117)' : 'rgb(152,195,121)'}" stroke-width="2" stroke-dasharray="3 2" pointer-events="none"/>`;
    });

    let arrows = '';
    sched.forEach(s => {
      if (s.__row == null) return;
      s.deps.forEach(dep => {
        const p = idToAll[dep];
        if (!p || !p.__row || p.__row === s.__row) return;
        const ex = xAt(p.endCal);
        const ey = midY(p.__row);
        const sx = xAt(s.startCal);
        const sy = midY(s.__row);
        arrows += `<path d="M ${ex} ${ey} C ${ex + 18} ${ey}, ${sx - 18} ${sy}, ${sx - 2} ${sy}" fill="none" stroke="rgb(230,160,60)" stroke-width="1.6"/><polygon points="${sx},${sy} ${sx - 8},${sy - 4} ${sx - 8},${sy + 4}" fill="rgb(230,160,60)"/>`;
      });
    });
    meetData.forEach(l => {
      if (l.__row == null) return;
      l.deps.forEach(dep => {
        const p = idToAll[dep];
        if (!p || !p.__row || p.__row === l.__row) return;
        const exVal = p.duration !== undefined ? p.endCal : p.calE;
        const ex = xAt(exVal);
        const ey = midY(p.__row);
        const sx = xAt(l.calS);
        const sy = midY(l.__row);
        arrows += `<path d="M ${ex} ${ey} C ${ex + 18} ${ey}, ${sx - 18} ${sy}, ${sx - 2} ${sy}" fill="none" stroke="rgb(230,160,60)" stroke-width="1.6"/><polygon points="${sx},${sy} ${sx - 8},${sy - 4} ${sx - 8},${sy + 4}" fill="rgb(230,160,60)"/>`;
      });
    });
    const todayL = `<line x1="${xAt(0)}" y1="${gm.top}" x2="${xAt(0)}" y2="${H - 16}" stroke="rgb(152,195,121)" stroke-width="2"/>`;
    gscroll.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block"><rect x="0" y="0" width="${gm.lab}" height="${H}" fill="rgba(128,128,128,0.04)"/>${grid}${todayL}${axis}${rows}${arrows}</svg>`;
    gscroll.querySelectorAll('.gbar').forEach(el => openTask(el));
    gscroll.querySelectorAll('.glabel').forEach(el => openTask(el));
    gscroll.querySelectorAll('.gfold').forEach(el => el.addEventListener('click', () => {
      const id = el.getAttribute('data-node');
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      drawGantt();
    }));
  }

  function gZoomX(f, r) {
    const before = gscroll.scrollLeft + (r ?? 0.5) * gscroll.clientWidth;
    const oldW = gDays * basePxG * gScaleX;
    gScaleX = Math.min(30, Math.max(0.4, gScaleX * f));
    drawGantt();
    const newW = gDays * basePxG * gScaleX;
    if (oldW > 0) gscroll.scrollLeft = before * (newW / oldW) - (r ?? 0.5) * gscroll.clientWidth;
  }

  function mkBtn(host, t) {
    const b = host.createEl('button', { text: t });
    b.style.cssText = 'cursor:pointer;padding:2px 8px;';
    return b;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escA(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function fmtHours(h) { return h.toFixed(1).replace(/\.0$/, ''); }
  function clip(s, k) { return s.length > k ? s.slice(0, k - 1) + '\u2026' : s; }

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

  gxIn.onclick = () => gZoomX(1.3, 0.5);
  gxOut.onclick = () => gZoomX(1 / 1.3, 0.5);
  gxReset.onclick = () => { gScaleX = 1; gRowH = 24; drawGantt(); gscroll.scrollLeft = 0; };
  gyIn.onclick = () => { gRowH = Math.min(48, gRowH + 4); drawGantt(); };
  gyOut.onclick = () => { gRowH = Math.max(14, gRowH - 4); drawGantt(); };
  collapseAll.onclick = () => { allGroupIds(root, []).forEach(id => collapsed.add(id)); drawGantt(); };
  expandAll.onclick = () => { collapsed.clear(); drawGantt(); };

  gscroll.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      gZoomX(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - gscroll.getBoundingClientRect().left) / gscroll.clientWidth);
    }
    else if (e.altKey) {
      e.preventDefault();
      gRowH = Math.min(48, Math.max(14, gRowH + (e.deltaY < 0 ? 2 : -2)));
      drawGantt();
    }
  }, { passive: false });

  drawGantt();
  return { sched, calToDT };
}
