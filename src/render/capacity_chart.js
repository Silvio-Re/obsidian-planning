// src/render/capacity_chart.js - Capacity chart rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

import { fmtHours } from '../constants.js';
import { esc, escA, renderMd, makeTaskOpener, openTask } from '../utils.js';

/**
 * Render Capacity chart
 * Depends on: dv, app, and capacity data
 */
export function renderCapacity(container, capacityData, SCHEDULE) {
  const { values, labels, dateArr, byDay, maxStack, totalDays, t0 } = capacityData;
  const pinned = new Set();
  const panel = container.createEl('div');

  function renderPanel() {
    if (!pinned.size) { panel.innerHTML = ''; return; }
    const targetIdx = Math.max(...pinned);
    const targetDate = labels[targetIdx];
    const dueOn = byDay[targetIdx]?.slice().sort((a, b) => b.hours - a.hours) || [];
    const earlier = Object.values(byDay).flat().filter(d => d.i < targetIdx).sort((a, b) => a.i - b.i || b.hours - a.hours);
    const sum = (arr) => arr.reduce((s, d) => s + d.hours, 0);
    const row = (d) => `<div class="prow" data-path="${escA(d.path)}" data-line="${d.line}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid rgba(128,128,128,0.15);"><span style="color:${d.inherited ? 'rgb(224,108,117)' : 'rgb(97,175,239)'};font-weight:600;">${esc(d.date)}</span> - ${renderMd(d.title)} <b>(${fmtHours(d.hours)}h)</b><span style="color:gray;font-size:11px;"> - ${esc(d.file)}${d.inherited ? ` - own:${esc(d.ownStr)}` : ''}</span></div>`;
    const list = (arr) => arr.length ? arr.map(row).join('') : `<div style="color:gray;padding:3px 6px;">none</div>`;
    panel.innerHTML = `<div style="margin-top:10px;font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;"><div style="padding:6px 8px;background:rgba(97,175,239,0.12);font-weight:700;">To meet ${esc(targetDate)} - ${sum(dueOn)}h due that day + ${sum(earlier)}h earlier = <span style="color:rgb(224,108,117);">${sum(dueOn) + sum(earlier)}h total</span></div><div style="padding:5px 8px 2px;font-weight:600;">Tasks due on ${esc(targetDate)} (${dueOn.length} - ${sum(dueOn)}h)</div>${list(dueOn)}<div style="padding:8px 8px 2px;font-weight:600;">Earlier deadlines to clear first (${earlier.length} - ${sum(earlier)}h)</div>${list(earlier)}</div>`;
    panel.querySelectorAll('.prow').forEach(el => openTask(el));
  }

  const m = { l: 60, r: 20, t: 34, b: 78 };
  const baseIH = 150;
  const n = values.length;
  const ymin = Math.min(0, -maxStack, ...values);
  const ymax = Math.max(0, ...values);
  const span = ymax - ymin || 1;
  const basePxPerDay = Math.max(5, 685 / totalDays);
  let scaleX = 1;
  let scaleY = 1;
  let lastY0 = 0;

  const bar = container.createEl('div');
  bar.style.cssText = 'margin-bottom:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
  bar.createEl('span', { text: 'X' }).style.cssText = 'font-size:12px;color:gray;';
  const xOut = mkBtn(bar, '-');
  const xReset = mkBtn(bar, 'reset');
  const xIn = mkBtn(bar, '+');
  bar.createEl('span', { text: '  Y' }).style.cssText = 'font-size:12px;color:gray;';
  const yOut = mkBtn(bar, '-');
  const yIn = mkBtn(bar, '+');
  const clearBtn = mkBtn(bar, 'clear selection');
  bar.createEl('span', { text: '  (click calendar to select a deadline)' }).style.cssText = 'color:gray;font-size:12px;';

  const scroll = container.createEl('div');
  scroll.style.cssText = 'overflow:auto;width:100%;max-height:540px;border:1px solid rgba(128,128,128,0.2);';

  function mkBtn(host, t) {
    const b = host.createEl('button', { text: t });
    b.style.cssText = 'cursor:pointer;padding:2px 8px;';
    return b;
  }

  const halo = document.body.classList.contains('theme-dark') ? 'rgb(0,0,0)' : 'rgb(255,255,255)';

  function draw() {
    const pxPerDay = basePxPerDay * scaleX;
    const iw = totalDays * pxPerDay;
    const ih = baseIH * scaleY;
    const H = m.t + ih + m.b;
    const W = m.l + m.r + iw;
    const xAt = (i) => m.l + i * pxPerDay;
    const yAt = (v) => m.t + ih - ((v - ymin) / span) * ih;
    const barW = Math.max(3, Math.min(16, pxPerDay * 0.6));
    const yZero = yAt(0);
    lastY0 = yZero;

    let dPath = `M ${xAt(0)} ${yAt(values[0])}`;
    for (let i = 1; i < n; i++) {
      dPath += ` L ${xAt(i)} ${yAt(values[i - 1])} L ${xAt(i)} ${yAt(values[i])}`;
    }

    let g = '';
    for (let k = 0; k <= 5; k++) {
      const v = ymin + (span * k) / 5;
      const y = yAt(v);
      g += `<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="rgba(128,128,128,0.15)"/><text x="${m.l - 8}" y="${y + 4}" font-size="12" text-anchor="end" fill="gray">${v.toFixed(0)}h</text>`;
    }

    let weeks = '';
    let months = '';
    for (let d = 0; d <= totalDays; d++) {
      const dt = dateArr[d];
      const x = xAt(d);
      if (dt.day === 1) {
        months += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="rgba(128,128,128,0.5)"/><text x="${x + 3}" y="${m.t + ih + 36}" font-size="12" fill="gray">${dt.toFormat('yyyy-MM')}</text>`;
      } else if (dt.weekday === 1) {
        weeks += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="rgba(128,128,128,0.18)"/>`;
      }
      if (dt.weekday > 5 && d < totalDays) {
        weeks += `<rect x="${x}" y="${m.t}" width="${pxPerDay}" height="${ih}" fill="rgba(128,128,128,0.1)" pointer-events="none"/>`;
      }
    }

    const step = Math.max(1, Math.round(totalDays / Math.max(1, Math.floor(iw / 90))));
    for (let d = 0; d <= totalDays; d += step) {
      g += `<text x="${xAt(d)}" y="${H - m.b + 18}" font-size="12" text-anchor="middle" fill="gray">${labels[d]}</text>`;
    }

    let marks = '';
    Object.keys(byDay).map(Number).sort((a, b) => a - b).forEach(dayIdx => {
      const arr = byDay[dayIdx];
      const x = xAt(dayIdx);
      const on = pinned.has(dayIdx);
      const lineCol = on ? 'rgb(97,175,239)' : 'rgba(97,175,239,0.5)';
      const vis = on ? 'visible' : 'hidden';
      let segs = '';
      let lbls = '';
      arr.forEach((dm, k) => {
        const yTop = yAt(-dm.accBelow);
        const yBot = yAt(-(dm.accBelow + dm.hours));
        const h = yBot - yTop;
        const fill = dm.inherited ? 'rgba(224,108,117,0.85)' : 'rgba(97,175,239,0.85)';
        segs += `<rect x="${x - barW / 2}" y="${yTop}" width="${barW}" height="${Math.max(1, h)}" fill="${fill}" stroke="rgba(80,80,80,0.7)" pointer-events="none"/>`;
        if (h > 18) segs += `<text x="${x}" y="${(yTop + yBot) / 2 + 4}" font-size="12" text-anchor="middle" fill="gray" pointer-events="none">${fmtHours(dm.hours)}h</text>`;
        const extra = dm.inherited ? ` - own:${dm.ownStr}` : '';
        lbls += `<text class="lbl" data-path="${escA(dm.path)}" data-line="${dm.line}" x="${x + 9}" y="${m.t + 28 + k * 17}" font-size="12" fill="rgb(97,175,239)" stroke="${halo}" stroke-width="3" paint-order="stroke" cursor="pointer" visibility="${vis}">${esc(dm.date)} - ${esc(dm.title)} (${fmtHours(dm.hours)}h) - ${esc(dm.file)}${esc(extra)}</text>`;
      });
      marks += `<g class="mk" data-day="${dayIdx}"><line class="mkline" x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="${lineCol}" pointer-events="none"/>${segs}<rect class="toggle" x="${x - 9}" y="${m.t - 2}" width="18" height="18" fill="transparent" cursor="pointer"/><text x="${x}" y="${m.t + 12}" font-size="13" text-anchor="middle" pointer-events="none">calendar</text>${lbls}</g>`;
    });

    const todayLine = `<line x1="${xAt(t0)}" y1="${m.t}" x2="${xAt(t0)}" y2="${m.t + ih}" stroke="rgb(152,195,121)" stroke-width="2" pointer-events="none"/><text x="${xAt(t0) + 3}" y="${m.t + ih - 4}" font-size="12" fill="rgb(152,195,121)" pointer-events="none">today</text>`;
    scroll.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">${weeks}${months}${g}${marks}${todayLine}<line x1="${m.l}" y1="${yZero}" x2="${W - m.r}" y2="${yZero}" stroke="rgb(136,136,136)" stroke-dasharray="4 4"/><path d="${dPath}" fill="none" stroke="rgb(224,108,117)" stroke-width="2"/><text x="${m.l}" y="18" font-size="12" fill="gray">Hours owed vs. weekday-${SCHEDULE.hoursPerDay}h capacity (meetings reduce capacity) - red bar = inherited deadline</text></svg>`;

    scroll.querySelectorAll('.mk').forEach(gEl => {
      const day = parseInt(gEl.dataset.day, 10);
      const lbls = gEl.querySelectorAll('.lbl');
      const line = gEl.querySelector('.mkline');
      const toggle = gEl.querySelector('.toggle');
      const apply = () => {
        const on = pinned.has(day);
        lbls.forEach(l => l.setAttribute('visibility', on ? 'visible' : 'hidden'));
        line.setAttribute('stroke', on ? 'rgb(97,175,239)' : 'rgba(97,175,239,0.5)');
      };
      toggle.addEventListener('click', () => {
        if (pinned.has(day)) pinned.delete(day); else pinned.add(day);
        apply(); renderPanel();
      });
      lbls.forEach(el => openTask(el));
    });
  }

  function zoomX(f, r) {
    const before = scroll.scrollLeft + (r ?? 0.5) * scroll.clientWidth;
    const oldW = totalDays * basePxPerDay * scaleX;
    scaleX = Math.min(30, Math.max(0.4, scaleX * f));
    draw();
    const newW = totalDays * basePxPerDay * scaleX;
    if (oldW > 0) scroll.scrollLeft = before * (newW / oldW) - (r ?? 0.5) * scroll.clientWidth;
  }

  function zoomY(f, r) {
    const before = scroll.scrollTop + (r ?? 0.5) * scroll.clientHeight;
    const oldH = baseIH * scaleY;
    scaleY = Math.min(20, Math.max(0.4, scaleY * f));
    draw();
    const newH = baseIH * scaleY;
    if (oldH > 0) scroll.scrollTop = before * (newH / oldH) - (r ?? 0.5) * scroll.clientHeight;
  }

  xIn.onclick = () => zoomX(1.3, 0.5);
  xOut.onclick = () => zoomX(1 / 1.3, 0.5);
  xReset.onclick = () => { scaleX = 1; scaleY = 1; draw(); scroll.scrollLeft = 0; };
  yIn.onclick = () => zoomY(1.3, 0.5);
  yOut.onclick = () => zoomY(1 / 1.3, 0.5);
  clearBtn.onclick = () => { pinned.clear(); draw(); renderPanel(); };

  scroll.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoomX(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - scroll.getBoundingClientRect().left) / scroll.clientWidth);
    }
    else if (e.altKey) {
      e.preventDefault();
      zoomY(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientY - scroll.getBoundingClientRect().top) / scroll.clientHeight);
    }
  }, { passive: false });

  draw();
  renderPanel();
  requestAnimationFrame(() => {
    scroll.scrollLeft = t0 * basePxPerDay - scroll.clientWidth / 2;
    scroll.scrollTop = lastY0 - scroll.clientHeight / 2;
  });
}
