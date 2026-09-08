```dataviewjs
// =============================================
// 1️⃣ DATA COLLECTION LAYER
// =============================================
const pages = dv.pages('"Projets"');

// --- Constants & Regex ---
const durRe = /(\(\u23f1:: *(\d+(?:\.\d+)?)h\))|\u23f1 *(\d+(?:\.\d+)?)h/;
const dateRe = /📅\s*\[*\s*(\d{4}-\d{2}-\d{2})(?:\s*\]*\s*(\d{1,2}):(\d{2}))?/;
const idRe = /🆔\s*([\w-]+)/u;
const blkRe = /⛔\s*([\w,\-\s]+)/u;
const PRIORITY_RANK = { "🔺": 0, "⏫": 1, "🔼": 2, "🔽": 3, "⏬": 4 };
const PRIORITY_DEFAULT = 2;
const priorityRe = /(🔺|⏫|🔼|🔽|⏬)\uFE0F?/u;

function parsePriority(text) {
    const pm = text.match(priorityRe);
    return pm ? PRIORITY_RANK[pm[1]] : PRIORITY_DEFAULT;
}
function fmtHours(h) { return h.toFixed(1).replace(/\.0$/, ""); }
function ownDur(t) { const dm = t.text.match(durRe); if (!dm) return 0; const num = dm[2] || dm[3]; return num ? parseFloat(num) : 0; }
function cleanTitle(text) { return text.replace(/[📅🆔⛔🔺⏫🔼🔽⏬\uFE0F].*/u, "").replace(durRe, "").replace(/\s+/g, " ").trim(); }
function baseName(p) { return p.split("/").pop().replace(/\.md$/, ""); }

// --- Data Collection ---
function collectAll(pages) {
    const all = [], seen = new Set(), warnings = [];
    for (const page of pages) {
        const path = page.file.path, file = baseName(path);
        const childKeys = new Set();
        const markChildren = (t) => { for (const c of t.subtasks ?? []) { childKeys.add(`${path}:${c.line}`); markChildren(c); } };
        for (const t of page.file.tasks) markChildren(t);
        
        for (const t of page.file.tasks) {
            if (t.completed || t.status === "-") continue;
            const key = `${path}:${t.line}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const km = t.text.match(dateRe), idm = t.text.match(idRe), blm = t.text.match(blkRe);
            const priority = parsePriority(t.text);
            let ownDL = null, locked = false, mDate = null, mHour = 0, mMin = 0, parsingErrors = [];

            try {
                if (km) {
                    if (km[2] != null) {
                        locked = true; mDate = dv.date(km[1]); mHour = +km[2]; mMin = +km[3];
                        if (isNaN(mHour) || mHour < 0 || mHour > 23) parsingErrors.push(`Hour invalid: ${km[2]}`);
                        if (isNaN(mMin) || mMin < 0 || mMin > 59) parsingErrors.push(`Minute invalid: ${km[3]}`);
                        if (!mDate) parsingErrors.push(`Date parse failed: ${km[1]}`);
                    } else { ownDL = dv.date(km[1]); if (!ownDL) parsingErrors.push(`Date parse failed: ${km[1]}`); }
                }
            } catch (e) { parsingErrors.push(`Exception: ${e.message}`); }

            const dur = ownDur(t);
            if (dur < 0) parsingErrors.push(`Negative duration: ${dur}h`);
            const isIndented = childKeys.has(key);

            const taskEntry = {
                key, node: t, path, file, line: t.line, ownDL, locked, mDate, mHour, mMin,
                graphDL: km ? dv.date(km[1]) : null,
                id: idm ? idm[1].replace(/[^a-zA-Z0-9_-]+$/, "") : null,
                deps: blm ? blm[1].split(",").map(s => s.trim().replace(/[^a-zA-Z0-9_-]+$/, "")).filter(Boolean) : [],
                title: cleanTitle(t.text), priority, isIndented, _parsingErrors: parsingErrors,
            };
            if (parsingErrors.length) warnings.push({ text: t.text, path, line: t.line, errors: parsingErrors });
            all.push(taskEntry);
        }
    }
    return { all, seen, warnings };
}

function buildGraph(all) {
    const dependents = {};
    all.forEach(r => r.deps.forEach(dep => (dependents[dep] = dependents[dep] || []).push(r)));
    const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);
    function effectiveDL(item) {
        let best = item.ownDL;
        const vis = new Set([item.key]), stack = [item];
        while (stack.length) {
            const cur = stack.pop();
            best = minDate(best, cur.graphDL);
            if (cur.id && dependents[cur.id]) for (const d of dependents[cur.id]) if (!vis.has(d.key)) { vis.add(d.key); stack.push(d); }
        }
        return best;
    }
    all.forEach(r => r.eff = r.locked ? null : effectiveDL(r));
    function effectivePriority(item) {
        let best = item.priority;
        const vis = new Set([item.key]), stack = [item];
        while (stack.length) {
            const cur = stack.pop();
            best = Math.min(best, cur.priority);
            for (const dep of cur.deps) {
                const depTasks = all.filter(r => r.id === dep);
                for (const dt of depTasks) if (!vis.has(dt.key)) { vis.add(dt.key); stack.push(dt); }
            }
        }
        return best;
    }
    all.forEach(r => r.effPriority = effectivePriority(r));
    const markSet = new Set(all.filter(r => r.eff).map(r => r.key));
    return { dependents, markSet };
}

function chargeableHours(node, path, markSet) {
    let sum = ownDur(node);
    for (const c of node.subtasks ?? []) { if (c.completed || c.status === "-") continue; if (markSet.has(`${path}:${c.line}`)) continue; sum += chargeableHours(c, path, markSet); }
    return sum === 0 ? 0.1 : sum;
}

function collectPlannerData(pages) {
    const { all, warnings } = collectAll(pages);
    const { dependents, markSet } = buildGraph(all);
    const items = [], locks = [];
    for (const r of all) {
        if (r.locked) {
            const h = chargeableHours(r.node, r.path, markSet);
            if (h > 0) locks.push({ day: r.mDate, hour: r.mHour, min: r.mMin, hours: h, title: r.title, path: r.path, line: r.line, file: r.file, id: r.id, deps: r.deps });
            continue;
        }
        if (!r.eff) continue;
        const hours = chargeableHours(r.node, r.path, markSet);
        items.push({ duration: hours, deadline: r.eff, title: r.title, path: r.path, line: r.line, file: r.file, id: r.id, deps: r.deps, ownStr: r.ownDL ? r.ownDL.toFormat("yyyy-MM-dd") : "—", inherited: !r.ownDL || r.eff < r.ownDL, priority: r.effPriority });
    }
    return { tasks: all, items, locks, dependents, markSet, warnings };
}

// =============================================
// 2️⃣ SCHEDULING LOGIC LAYER (Pure Functions)
// =============================================
const SCHEDULE_CONFIG = { startHour: 9, hoursPerDay: 8 };

// --- Allocator (Shared State) ---
function createAllocator(today, workDays, meetIv, SCHEDULE) {
    const freeCache = {};
    function dayFree(di) {
        if (freeCache[di]) return freeCache[di];
        const ms = (meetIv[di] || []).slice().sort((a, b) => a.s - b.s);
        const free = []; let c = 0;
        for (const mi of ms) { if (mi.s > c) free.push([c, mi.s]); c = Math.max(c, mi.e); }
        if (c < 1) free.push([c, 1]);
        return (freeCache[di] = free.filter(iv => iv[1] - iv[0] > 1e-9));
    }

    let di = 0, ivs = dayFree(0), fi = 0, pos = ivs[0] ? ivs[0][0] : 1;
    function advance() {
        while (di < workDays.length) {
            while (fi < ivs.length) { if (pos < ivs[fi][1] - 1e-9) return true; fi++; if (fi < ivs.length) pos = ivs[fi][0]; }
            di++; if (di < workDays.length) { ivs = dayFree(di); fi = 0; pos = ivs[0] ? ivs[0][0] : 1; }
        }
        return false;
    }
    return {
        allocate: (hours) => {
            const segs = []; let rem = hours;
            while (rem > 1e-9 && advance()) {
                const iv = ivs[fi], base = workDays[di].diff(today, "days").days,
                      availH = (iv[1] - pos) * SCHEDULE.hoursPerDay, take = Math.min(availH, rem), tf = take / SCHEDULE.hoursPerDay;
                segs.push({ calS: base + pos, calE: base + pos + tf });
                pos += tf; rem -= take;
            }
            return segs;
        },
        reset: () => { di = 0; ivs = dayFree(0); fi = 0; pos = ivs[0] ? ivs[0][0] : 1; }
    };
}

// --- Priority-Aware Scheduling ---
function computeSchedule(items, locks, today, SCHEDULE) {
    // Setup work days and meetings
    let sStart = today;
    while (sStart.weekday > 5) sStart = sStart.plus({ days: 1 });
    const totalWH = items.reduce((s, it) => s + it.duration, 0) + locks.reduce((s, l) => s + l.hours, 0);
    const needWD = Math.ceil(totalWH / (SCHEDULE.hoursPerDay / 2)) + 6;
    const workDays = []; { let d = sStart, guard = 0; while (workDays.length < needWD && guard++ < 9000) { if (d.weekday <= 5) workDays.push(d); d = d.plus({ days: 1 }); } }

    const wdIndex = {}; workDays.forEach((d, i) => wdIndex[d.toFormat("yyyy-MM-dd")] = i);
    const meetIv = {}; const meetData = [];
    locks.forEach(lk => {
        const i = wdIndex[lk.day.toFormat("yyyy-MM-dd")];
        const sc = lk.hour + lk.min / 60; let s = (sc - SCHEDULE.startHour) / SCHEDULE.hoursPerDay, e = s + lk.hours / SCHEDULE.hoursPerDay;
        s = Math.max(0, Math.min(1, s)); e = Math.max(s, Math.min(1, e));
        lk.calS = lk.day.diff(today, "days").days + s; lk.calE = lk.day.diff(today, "days").days + e;
        if (i != null) (meetIv[i] = meetIv[i] || []).push({ s, e });
        meetData.push({ ...lk });
    });

    // New algorithm: EDF + iterative priority correction for late tasks
    // 1. Start with EDF scheduling
    // 2. Identify late tasks
    // 3. Among late tasks, check for priority inversion
    // 4. If inversion exists, place highest priority late tasks with shortest timespan first
    // 5. Lock them in the schedule and repeat EDF on remaining tasks
    // 6. Continue until no priority inversion among late tasks
    
    function scheduleWithEDF(remainingItems, lockedItems = []) {
        const allocator = createAllocator(today, workDays, meetIv, SCHEDULE);
        
        // First, allocate time for locked items (they've been placed first)
        const lockedWithTimes = [];
        for (const lockedItem of lockedItems) {
            const dlIdx = lockedItem.deadline.diff(today, "days").days;
            const segs = lockedItem.duration <= 0 ? [{ calS: dlIdx, calE: dlIdx }] : allocator.allocate(lockedItem.duration);
            const startCal = segs.length ? segs[0].calS : dlIdx;
            const endCal = segs.length ? segs[segs.length - 1].calE : dlIdx;
            const late = endCal > dlIdx;
            
            lockedWithTimes.push({
                ...lockedItem,
                dlIdx,
                segs,
                startCal,
                endCal,
                late
            });
        }
        
        // Sort remaining items by EDF (earliest deadline first)
        const sorted = [...remainingItems].sort((a, b) => 
            a.deadline - b.deadline || b.duration - a.duration
        );
        
        const result = [];
        
        for (const item of sorted) {
            const dlIdx = item.deadline.diff(today, "days").days;
            const segs = item.duration <= 0 ? [{ calS: dlIdx, calE: dlIdx }] : allocator.allocate(item.duration);
            const startCal = segs.length ? segs[0].calS : dlIdx;
            const endCal = segs.length ? segs[segs.length - 1].calE : dlIdx;
            const late = endCal > dlIdx;
            
            result.push({
                ...item,
                dlIdx,
                segs,
                startCal,
                endCal,
                late
            });
        }
        
        return [...lockedWithTimes, ...result];
    }
    
    function hasPriorityInversionAmongLate(sched) {
        const lateTasks = sched.filter(s => s.late);
        if (lateTasks.length < 2) return false;
        
        // Sort late tasks by their start time in the schedule
        const lateTasksByTime = [...lateTasks].sort((a, b) => a.startCal - b.startCal);
        
        // Check if any higher priority late task comes after a lower priority late task
        // i.e., a task with lower priority number (higher priority) has a later startCal than a task with higher priority number (lower priority)
        for (let i = 0; i < lateTasksByTime.length; i++) {
            for (let j = i + 1; j < lateTasksByTime.length; j++) {
                // If task j has higher priority (lower number) but comes later (higher startCal)
                // This is a priority inversion
                if (lateTasksByTime[j].priority < lateTasksByTime[i].priority && 
                    lateTasksByTime[j].startCal > lateTasksByTime[i].startCal) {
                    return true;
                }
            }
        }
        return false;
    }
    
    function findHighestPriorityShortestLate(sched, lockedKeys) {
        // Only consider tasks that are NOT already locked
        const lateTasks = sched.filter(s => s.late && !lockedKeys.has(`${s.path}:${s.line}`));
        if (lateTasks.length === 0) return null;
        
        // Find the highest priority (lowest priority number) among late tasks
        const minPriority = Math.min(...lateTasks.map(t => t.priority));
        const highestPriorityLate = lateTasks.filter(t => t.priority === minPriority);
        
        // Among highest priority late tasks, find the one with shortest timespan (duration)
        let shortest = highestPriorityLate[0];
        for (const task of highestPriorityLate) {
            if (task.duration < shortest.duration) {
                shortest = task;
            }
        }
        
        return shortest;
    }
    
    // Iterative scheduling with priority correction
    // We need to track items by a unique identifier to properly remove them
    // Use the key from the original items (path:line)
    let remainingItems = [...items];
    let lockedItems = [];
    let lockedKeys = new Set();
    let finalSched = [];
    
    // Maximum iterations to prevent infinite loops
    const maxIterations = items.length * 2;
    let iteration = 0;
    
    while (iteration < maxIterations) {
        iteration++;
        
        // Schedule with current locked items
        finalSched = scheduleWithEDF(remainingItems, lockedItems);
        
        // Check if there's priority inversion among late tasks
        if (!hasPriorityInversionAmongLate(finalSched)) {
            break; // No more inversion, we're done
        }
        
        // Find the highest priority late task with shortest timespan that is NOT already locked
        const taskToLock = findHighestPriorityShortestLate(finalSched, lockedKeys);
        
        if (!taskToLock) {
            break; // No late tasks to lock
        }
        
        // Lock this task (remove from remaining, add to locked)
        // Use a unique key to identify the task
        const taskKey = `${taskToLock.path}:${taskToLock.line}`;
        lockedKeys.add(taskKey);
        remainingItems = remainingItems.filter(item => 
            `${item.path}:${item.line}` !== taskKey
        );
        lockedItems.push(taskToLock);
    }
    
    // Final schedule is the last computed one
    const sched = finalSched;

    // Build lookup maps
    const idToAll = {}; sched.forEach(s => { if (s.id) idToAll[s.id] = s; }); meetData.forEach(l => { if (l.id) idToAll[l.id] = l; });

    // Calendar utilities
    function calToDT(cal) {
        const dayOff = Math.floor(cal + 1e-9), frac = cal - dayOff;
        return today.plus({ days: dayOff, hours: SCHEDULE.startHour, minutes: Math.round(frac * SCHEDULE.hoursPerDay * 60) });
    }

    return { sched, meetData: locks, today, SCHEDULE, calToDT, idToAll, workDays };
}

// --- Capacity Calculation ---
function computeCapacity(items, locks, today, SCHEDULE) {
    const lastDeadline = items.reduce((mx, it) => (it.deadline > mx ? it.deadline : mx), today);
    const firstDeadline = items.reduce((mn, it) => (it.deadline < mn ? it.deadline : mn), lastDeadline);
    const range = Math.max(1, Math.ceil(lastDeadline.diff(today, "days").days));
    const startDate = firstDeadline < today ? firstDeadline : today;
    const endDate = today.plus({ days: 2 * range });
    const totalDays = Math.max(1, Math.round(endDate.diff(startDate, "days").days));
    const t0 = Math.round(today.diff(startDate, "days").days);

    const meetH = {}; locks.forEach(lk => { const k = lk.day.toFormat("yyyy-MM-dd"); meetH[k] = (meetH[k] || 0) + lk.hours; });

    const dateArr = [], labels = [], values = [], capHours = new Array(totalDays + 1);
    for (let d = 0; d <= totalDays; d++) { const date = startDate.plus({ days: d }); dateArr.push(date); labels.push(date.toFormat("yyyy-MM-dd")); }
    capHours[t0] = 0;
    for (let i = t0 + 1; i <= totalDays; i++) { const dk = dateArr[i].toFormat("yyyy-MM-dd"); capHours[i] = capHours[i - 1] + (dateArr[i].weekday <= 5 ? Math.max(0, SCHEDULE.hoursPerDay - (meetH[dk] || 0)) : 0); }
    for (let i = t0 - 1; i >= 0; i--) capHours[i] = 0;
    for (let d = 0; d <= totalDays; d++) { const demand = items.filter(it => it.deadline <= dateArr[d]).reduce((s, it) => s + it.duration, 0); values.push(capHours[d] - demand); }

    let fwdMin = Infinity;
    for (let d = totalDays; d >= 0; d--) { fwdMin = Math.min(fwdMin, values[d]); values[d] = fwdMin; }

    const marksData = items.map(it => ({ i: Math.round(it.deadline.diff(startDate, "days").days), date: it.deadline.toFormat("yyyy-MM-dd"), title: it.title, hours: it.duration, path: it.path, line: it.line, file: it.file, inherited: it.inherited, ownStr: it.ownStr, priority: it.priority }));
    const byDay = {}; marksData.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title)).forEach(d => { if (!byDay[d.i]) byDay[d.i] = []; byDay[d.i].push(d); });
    let maxStack = 1; Object.values(byDay).forEach(arr => { let acc = 0; arr.forEach(d => { d.accBelow = acc; acc += d.hours; }); if (acc > maxStack) maxStack = acc; });

    return { values, labels, dateArr, byDay, maxStack, totalDays, t0, startDate };
}

// =============================================
// 3️⃣ RENDERING LAYER (Pure Display)
// =============================================
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escA = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const halo = document.body.classList.contains("theme-dark") ? "rgb(0,0,0)" : "rgb(255,255,255)";
const clip = (s, k) => (s.length > k ? s.slice(0, k - 1) + "…" : s);
const renderMd = (s) => { let h = esc(s); h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/~~(.+?)~~/g, "<del>$1</del>").replace(/\x60(.+?)\x60/g, "<code>$1</code>"); return h; };

// --- DOM Helpers ---
function makeTaskOpener(app) {
    function selectLine(path, line, tries) {
        const target = app.workspace.getLeavesOfType("markdown").find(l => l.view && l.view.file && l.view.file.path === path);
        if (target && target.view.editor) { app.workspace.setActiveLeaf(target, { focus: true }); const ed = target.view.editor, len = (ed.getLine(line) || "").length; ed.setSelection({ line, ch: 0 }, { line, ch: len }); ed.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: len } }, true); ed.focus(); }
        else if (tries > 0) setTimeout(() => selectLine(path, line, tries - 1), 50);
    }
    return (el) => {
        el.addEventListener("click", (e) => { e.stopPropagation(); const p = el.getAttribute("data-path"), l = parseInt(el.getAttribute("data-line"), 10); app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(p), { active: true, state: { line: l } }); selectLine(p, l, 12); });
        el.addEventListener("auxclick", (e) => { if (e.button === 1) { const p = el.getAttribute("data-path"), l = parseInt(el.getAttribute("data-line"), 10); e.preventDefault(); e.stopPropagation(); app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(p), { active: true, state: { line: l } }); selectLine(p, l, 12); } });
    };
}
const openTask = makeTaskOpener(dv.app);
const mkBtn = (host, t) => { const b = host.createEl("button", { text: t }); b.style.cssText = "cursor:pointer;padding:2px 8px;"; return b; };

// --- Capacity Chart Renderer ---
function renderCapacity(container, capacityData, SCHEDULE) {
    const { values, labels, dateArr, byDay, maxStack, totalDays, t0 } = capacityData;
    const pinned = new Set(); const panel = container.createEl("div");

    function renderPanel() {
        if (!pinned.size) { panel.innerHTML = ""; return; }
        const targetIdx = Math.max(...pinned), targetDate = labels[targetIdx];
        const dueOn = byDay[targetIdx]?.slice().sort((a, b) => b.hours - a.hours) || [];
        const earlier = Object.values(byDay).flat().filter(d => d.i < targetIdx).sort((a, b) => a.i - b.i || b.hours - a.hours);
        const sum = (arr) => arr.reduce((s, d) => s + d.hours, 0);
        const row = (d) => `<div class="prow" data-path="${escA(d.path)}" data-line="${d.line}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid rgba(128,128,128,0.15);"><span style="color:${d.inherited ? "rgb(224,108,117)" : "rgb(97,175,239)"};font-weight:600;">${esc(d.date)}</span> — ${renderMd(d.title)} <b>(${fmtHours(d.hours)}h)</b><span style="color:gray;font-size:11px;"> · ${esc(d.file)}${d.inherited ? ` ⛔ own:${esc(d.ownStr)}` : ""}</span></div>`;
        const list = (arr) => arr.length ? arr.map(row).join("") : `<div style="color:gray;padding:3px 6px;">none</div>`;
        panel.innerHTML = `<div style="margin-top:10px;font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;"><div style="padding:6px 8px;background:rgba(97,175,239,0.12);font-weight:700;">🎯 To meet ${esc(targetDate)} — ${sum(dueOn)}h due that day + ${sum(earlier)}h earlier = <span style="color:rgb(224,108,117);">${sum(dueOn) + sum(earlier)}h total</span></div><div style="padding:5px 8px 2px;font-weight:600;">Tasks due on ${esc(targetDate)} (${dueOn.length} · ${sum(dueOn)}h)</div>${list(dueOn)}<div style="padding:8px 8px 2px;font-weight:600;">Earlier deadlines to clear first (${earlier.length} · ${sum(earlier)}h)</div>${list(earlier)}</div>`;
        panel.querySelectorAll(".prow").forEach(el => openTask(el));
    }

    const m = { l: 60, r: 20, t: 34, b: 78 }, baseIH = 150, n = values.length;
    const ymin = Math.min(0, -maxStack, ...values), ymax = Math.max(0, ...values), span = ymax - ymin || 1;
    const basePxPerDay = Math.max(5, 685 / totalDays); let scaleX = 1, scaleY = 1, lastY0 = 0;

    const bar = container.createEl("div"); bar.style.cssText = "margin-bottom:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
    bar.createEl("span", { text: "X" }).style.cssText = "font-size:12px;color:gray;";
    const xOut = mkBtn(bar, "−"), xReset = mkBtn(bar, "reset"), xIn = mkBtn(bar, "+");
    bar.createEl("span", { text: "  Y" }).style.cssText = "font-size:12px;color:gray;";
    const yOut = mkBtn(bar, "−"), yIn = mkBtn(bar, "+");
    const clearBtn = mkBtn(bar, "clear selection");
    bar.createEl("span", { text: "  (click 📅 to select a deadline)" }).style.cssText = "color:gray;font-size:12px;";

    const scroll = container.createEl("div"); scroll.style.cssText = "overflow:auto;width:100%;max-height:540px;border:1px solid rgba(128,128,128,0.2);";

    function draw() {
        const pxPerDay = basePxPerDay * scaleX, iw = totalDays * pxPerDay, ih = baseIH * scaleY, H = m.t + ih + m.b, W = m.l + m.r + iw;
        const xAt = (i) => m.l + i * pxPerDay, yAt = (v) => m.t + ih - ((v - ymin) / span) * ih, barW = Math.max(3, Math.min(16, pxPerDay * 0.6)), yZero = yAt(0); lastY0 = yZero;
        const xt = xAt(t0); let dPath = `M ${xAt(0)} ${yAt(values[0])}`; for (let i = 1; i < n; i++) dPath += ` L ${xAt(i)} ${yAt(values[i - 1])} L ${xAt(i)} ${yAt(values[i])}`;

        let g = ""; for (let k = 0; k <= 5; k++) { const v = ymin + (span * k) / 5, y = yAt(v); g += `<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="rgba(128,128,128,0.15)"/><text x="${m.l - 8}" y="${y + 4}" font-size="12" text-anchor="end" fill="gray">${v.toFixed(0)}h</text>`; }

        let weeks = "", months = ""; for (let d = 0; d <= totalDays; d++) { const dt = dateArr[d], x = xAt(d); if (dt.day === 1) { months += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="rgba(128,128,128,0.5)"/><text x="${x + 3}" y="${m.t + ih + 36}" font-size="12" fill="gray">${dt.toFormat("yyyy-MM")}</text>`; } else if (dt.weekday === 1) { weeks += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="rgba(128,128,128,0.18)"/>`; } if (dt.weekday > 5 && d < totalDays) weeks += `<rect x="${x}" y="${m.t}" width="${pxPerDay}" height="${ih}" fill="rgba(128,128,128,0.1)" pointer-events="none"/>`; }

        const step = Math.max(1, Math.round(totalDays / Math.max(1, Math.floor(iw / 90)))); for (let d = 0; d <= totalDays; d += step) g += `<text x="${xAt(d)}" y="${H - m.b + 18}" font-size="12" text-anchor="middle" fill="gray">${labels[d]}</text>`;

        let marks = ""; Object.keys(byDay).map(Number).sort((a, b) => a - b).forEach(dayIdx => {
            const arr = byDay[dayIdx], x = xAt(dayIdx), on = pinned.has(dayIdx), lineCol = on ? "rgb(97,175,239)" : "rgba(97,175,239,0.5)", vis = on ? "visible" : "hidden";
            let segs = "", lbls = ""; arr.forEach((dm, k) => {
                const yTop = yAt(-dm.accBelow), yBot = yAt(-(dm.accBelow + dm.hours)), h = yBot - yTop, fill = dm.inherited ? "rgba(224,108,117,0.85)" : "rgba(97,175,239,0.85)";
                segs += `<rect x="${x - barW / 2}" y="${yTop}" width="${barW}" height="${Math.max(1, h)}" fill="${fill}" stroke="rgba(80,80,80,0.7)" pointer-events="none"/>`;
                if (h > 18) segs += `<text x="${x}" y="${(yTop + yBot) / 2 + 4}" font-size="12" text-anchor="middle" fill="gray" pointer-events="none">${fmtHours(dm.hours)}h</text>`;
                const extra = dm.inherited ? ` ⛔(own: ${dm.ownStr})` : ""; lbls += `<text class="lbl" data-path="${escA(dm.path)}" data-line="${dm.line}" x="${x + 9}" y="${m.t + 28 + k * 17}" font-size="12" fill="rgb(97,175,239)" stroke="${halo}" stroke-width="3" paint-order="stroke" cursor="pointer" visibility="${vis}">${esc(dm.date)} — ${esc(dm.title)} (${fmtHours(dm.hours)}h) · ${esc(dm.file)}${esc(extra)}</text>`;
            }); marks += `<g class="mk" data-day="${dayIdx}"><line class="mkline" x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="${lineCol}" pointer-events="none"/>${segs}<rect class="toggle" x="${x - 9}" y="${m.t - 2}" width="18" height="18" fill="transparent" cursor="pointer"/><text x="${x}" y="${m.t + 12}" font-size="13" text-anchor="middle" pointer-events="none">📅</text>${lbls}</g>`;
        });

        const todayLine = `<line x1="${xt}" y1="${m.t}" x2="${xt}" y2="${m.t + ih}" stroke="rgb(152,195,121)" stroke-width="2" pointer-events="none"/><text x="${xt + 3}" y="${m.t + ih - 4}" font-size="12" fill="rgb(152,195,121)" pointer-events="none">today</text>`;
        scroll.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">${weeks}${months}${g}${marks}${todayLine}<line x1="${m.l}" y1="${yZero}" x2="${W - m.r}" y2="${yZero}" stroke="rgb(136,136,136)" stroke-dasharray="4 4"/><path d="${dPath}" fill="none" stroke="rgb(224,108,117)" stroke-width="2"/><text x="${m.l}" y="18" font-size="12" fill="gray">Hours owed vs. weekday-${SCHEDULE.hoursPerDay}h capacity (meetings reduce capacity) · red bar = inherited deadline</text></svg>`;

        scroll.querySelectorAll(".mk").forEach(gEl => {
            const day = parseInt(gEl.dataset.day, 10), lbls = gEl.querySelectorAll(".lbl"), line = gEl.querySelector(".mkline"), toggle = gEl.querySelector(".toggle");
            const apply = () => { const on = pinned.has(day); lbls.forEach(l => l.setAttribute("visibility", on ? "visible" : "hidden")); line.setAttribute("stroke", on ? "rgb(97,175,239)" : "rgba(97,175,239,0.5)"); };
            toggle.addEventListener("click", () => { if (pinned.has(day)) pinned.delete(day); else pinned.add(day); apply(); renderPanel(); });
            lbls.forEach(el => openTask(el));
        });
    }

    function zoomX(f, r) { const before = scroll.scrollLeft + (r ?? 0.5) * scroll.clientWidth, oldW = totalDays * basePxPerDay * scaleX; scaleX = Math.min(30, Math.max(0.4, scaleX * f)); draw(); const newW = totalDays * basePxPerDay * scaleX; if (oldW > 0) scroll.scrollLeft = before * (newW / oldW) - (r ?? 0.5) * scroll.clientWidth; }
    function zoomY(f, r) { const before = scroll.scrollTop + (r ?? 0.5) * scroll.clientHeight, oldH = baseIH * scaleY; scaleY = Math.min(20, Math.max(0.4, scaleY * f)); draw(); const newH = baseIH * scaleY; if (oldH > 0) scroll.scrollTop = before * (newH / oldH) - (r ?? 0.5) * scroll.clientHeight; }

    xIn.onclick = () => zoomX(1.3, 0.5); xOut.onclick = () => zoomX(1 / 1.3, 0.5);
    xReset.onclick = () => { scaleX = 1; scaleY = 1; draw(); scroll.scrollLeft = 0; };
    yIn.onclick = () => zoomY(1.3, 0.5); yOut.onclick = () => zoomY(1 / 1.3, 0.5);
    clearBtn.onclick = () => { pinned.clear(); draw(); renderPanel(); };
    scroll.addEventListener("wheel", (e) => {
        if (e.ctrlKey) { e.preventDefault(); zoomX(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - scroll.getBoundingClientRect().left) / scroll.clientWidth); }
        else if (e.altKey) { e.preventDefault(); zoomY(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientY - scroll.getBoundingClientRect().top) / scroll.clientHeight); }
    }, { passive: false });

    draw(); renderPanel(); requestAnimationFrame(() => { scroll.scrollLeft = t0 * basePxPerDay - scroll.clientWidth / 2; scroll.scrollTop = lastY0 - scroll.clientHeight / 2; });
}

// --- Gantt Chart Renderer ---
function renderGantt(container, scheduleData) {
    const { sched, meetData, today, SCHEDULE, calToDT, idToAll } = scheduleData;
    const gm = { top: 42, lab: 270, r: 20 };
    const maxCal = Math.max(...sched.map(s => Math.max(s.endCal, s.dlIdx + 1)), ...meetData.map(l => l.calE), 1);
    const gDays = Math.ceil(maxCal) + 3;

    // Build tree structure for grouping
    const root = { id: "", label: "", children: new Map(), items: [] };
    function segsOf(path) { const p = path.replace(/\.md$/, ""); const parts = p.split("/"); if (parts[0] === "Projets") parts.shift(); if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) parts.pop(); return parts.length ? parts : ["(root)"]; }
    function addEntry(path, en) { const parts = segsOf(path); let node = root, idAcc = ""; parts.forEach(seg => { idAcc += (idAcc ? "/" : "") + seg; if (!node.children.has(seg)) node.children.set(seg, { id: idAcc, label: seg, children: new Map(), items: [] }); node = node.children.get(seg); }); node.items.push(en); }
    sched.forEach(s => addEntry(s.path, { k: "task", s, start: s.startCal })); meetData.forEach(l => addEntry(l.path, { k: "meet", l, start: l.calS }));

    function nodeTotal(node) { let sum = 0; for (const en of node.items) sum += en.k === "task" ? (en.s.duration || 0) : (en.l.hours || 0); for (const c of node.children.values()) sum += nodeTotal(c); return sum; }
    function annotateTotals(node) { node.total = nodeTotal(node); node.children.forEach(c => annotateTotals(c)); } annotateTotals(root);
    function nodeStart(node) { let mn = Infinity; node.items.forEach(e => mn = Math.min(mn, e.start)); node.children.forEach(c => mn = Math.min(mn, nodeStart(c))); return mn === Infinity ? 0 : mn; }
    function collectEntries(node, out) { node.items.forEach(e => out.push(e)); node.children.forEach(c => collectEntries(c, out)); return out; }

    const collapsed = new Set();
    function flatten(node, depth, out) {
        const kids = [...node.children.values()].sort((a, b) => nodeStart(a) - nodeStart(b));
        for (const c of kids) { out.push({ type: "group", node: c, depth }); if (!collapsed.has(c.id)) { flatten(c, depth + 1, out); c.items.slice().sort((a, b) => a.start - b.start).forEach(en => out.push(en.k === "task" ? { type: "task", s: en.s, depth: depth + 1 } : { type: "meet", l: en.l, depth: depth + 1 })); } }
    }

    const gbar = container.createEl("div"); gbar.style.cssText = "margin:4px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
    gbar.createEl("span", { text: "X" }).style.cssText = "font-size:12px;color:gray;";
    const gxOut = mkBtn(gbar, "−"), gxReset = mkBtn(gbar, "reset"), gxIn = mkBtn(gbar, "+");
    gbar.createEl("span", { text: "  rows" }).style.cssText = "font-size:12px;color:gray;";
    const gyOut = mkBtn(gbar, "−"), gyIn = mkBtn(gbar, "+");
    const collapseAll = mkBtn(gbar, "fold all"), expandAll = mkBtn(gbar, "unfold all");
    gbar.createEl("span", { text: "  (▸/▾ fold · ▦ Planning row stacks all)" }).style.cssText = "color:gray;font-size:12px;";
    const gscroll = container.createEl("div"); gscroll.style.cssText = "overflow:auto;width:100%;max-height:460px;border:1px solid rgba(128,128,128,0.2);";

    const basePxG = Math.max(6, 900 / gDays); let gScaleX = 1, gRowH = 24;
    function allGroupIds(node, acc) { node.children.forEach(c => { acc.push(c.id); allGroupIds(c, acc); }); return acc; }

    function drawGantt() {
        sched.forEach(s => s.__row = null); meetData.forEach(l => l.__row = null);
        const visible = []; flatten(root, 0, visible); visible.push({ type: "planning", depth: 0 });
        const pxG = basePxG * gScaleX, rh = gRowH, W = gm.lab + gDays * pxG + gm.r, H = gm.top + visible.length * rh + 16;
        const xAt = (c) => gm.lab + c * pxG, midY = (ri) => gm.top + ri * rh + rh / 2;

        let axis = "", grid = ""; for (let d = 0; d <= gDays; d++) { const dt = today.plus({ days: d }), x = xAt(d); if (dt.day === 1) { grid += `<line x1="${x}" y1="${gm.top}" x2="${x}" y2="${H - 16}" stroke="rgba(128,128,128,0.5)"/>`; axis += `<text x="${x + 3}" y="${gm.top - 22}" font-size="12" fill="gray">${dt.toFormat("yyyy-MM")}</text>`; } else if (dt.weekday === 1) grid += `<line x1="${x}" y1="${gm.top}" x2="${x}" y2="${H - 16}" stroke="rgba(128,128,128,0.15)"/>`; else if (dt.weekday > 5) grid += `<rect x="${x}" y="${gm.top}" width="${pxG}" height="${H - 16 - gm.top}" fill="rgba(128,128,128,0.07)"/>`; }
        const step = Math.max(1, Math.round(gDays / Math.max(1, Math.floor((gDays * pxG) / 90)))); for (let d = 0; d <= gDays; d += step) axis += `<text x="${xAt(d)}" y="${gm.top - 5}" font-size="11" text-anchor="middle" fill="gray">${today.plus({ days: d }).toFormat("MM-dd")}</text>`;

        const meetBar = (l, y, ri, setRow = true) => { if (setRow) l.__row = ri; const x1 = xAt(l.calS), w = Math.max(4, xAt(l.calE) - x1); return `<rect class="gbar" data-path="${escA(l.path)}" data-line="${l.line}" x="${x1}" y="${y}" width="${w}" height="${rh - 8}" rx="3" fill="rgba(198,120,221,0.9)" stroke="rgba(255,255,255,0.6)" cursor="pointer"><title>${esc(l.title)} · ${l.day.toFormat("yyyy-MM-dd")} ${String(l.hour).padStart(2, "0")}:${String(l.min).padStart(2, "0")} · ${fmtHours(l.hours)}h (locked)</title></rect>`; };

        const taskBars = (s, y, ri, setRow = true) => {
            if (setRow) s.__row = ri;
            let fill, stroke, strokeWidth;
            if (s.late) {
                if (s.priority === 3 || s.priority === 4) { fill = "rgb(128,128,128)"; stroke = "rgb(64,64,64)"; strokeWidth = 2; }
                else if (s.priority === 2) { fill = "rgb(255,165,80)"; stroke = "rgb(200,120,40)"; strokeWidth = 2; }
                else { fill = "rgb(224,108,117)"; stroke = "rgb(150,0,0)"; strokeWidth = 2; }
            } else { fill = "rgba(97,175,239,0.9)"; stroke = "rgba(255,255,255,0.6)"; strokeWidth = 1; }
            let o = ""; s.segs.forEach(seg => { const x1 = xAt(seg.calS), w = Math.max(2, xAt(seg.calE) - x1); o += `<rect class="gbar" data-path="${escA(s.path)}" data-line="${s.line}" x="${x1}" y="${y}" width="${w}" height="${rh - 8}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" cursor="pointer"><title>${esc(s.title)} · ${s.duration}h · due ${esc(s.deadline.toFormat("yyyy-MM-dd"))}${s.late ? " · LATE" : ""}</title></rect>`; }); return o;
        };

        let rows = ""; visible.forEach((r, ri) => {
            const y = gm.top + ri * rh, ind = 6 + r.depth * 14;
            if (r.type === "planning") { rows += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(128,128,128,0.5)"/><rect x="0" y="${y}" width="${W}" height="${rh}" fill="rgba(229,192,123,0.18)"/><text x="6" y="${y + rh / 2 + 4}" font-size="12" font-weight="700" fill="rgb(209,154,102)" pointer-events="none">▦ Planning</text>`; sched.forEach(s => rows += taskBars(s, y + 5, ri, false)); meetData.forEach(l => rows += meetBar(l, y + 5, ri, false)); return; }
            if (r.type === "group") { const c = r.node, isColl = collapsed.has(c.id), tri = isColl ? "▸" : "▾", isLeaf = c.children.size === 0, icon = isLeaf ? "📄" : "📁", col = isLeaf ? "rgb(152,195,121)" : "rgb(97,175,239)", bg = isLeaf ? "rgba(152,195,121,0.10)" : "rgba(97,175,239,0.10)"; rows += `<rect x="0" y="${y}" width="${W}" height="${rh}" fill="${bg}"/> <text x="${ind}" y="${y + rh / 2 + 4}" font-size="12" fill="${col}" pointer-events="none">${tri} ${icon} ${esc(clip(c.label, Math.max(8, 34 - r.depth * 3)))} <tspan fill="gray">(${fmtHours(c.total)}h)</tspan></text>`; if (isColl) { collectEntries(c, []).forEach(en => { if (en.k === "task") rows += taskBars(en.s, y + 5, ri); else rows += meetBar(en.l, y + 5, ri); }); } rows += `<rect class="gfold" data-node="${escA(c.id)}" x="0" y="${y}" width="${gm.lab}" height="${rh}" fill="transparent" cursor="pointer"/>`; return; }
            rows += `<line x1="0" y1="${y + rh}" x2="${W}" y2="${y + rh}" stroke="rgba(128,128,128,0.12)"/>`;
            if (r.type === "meet") { const l = r.l; rows += `<text class="glabel" data-path="${escA(l.path)}" data-line="${l.line}" x="${ind + 6}" y="${y + rh / 2 + 4}" font-size="12" fill="rgb(198,120,221)" cursor="pointer">📌 ${esc(clip(l.title, Math.max(6, 26 - r.depth * 3)))} (${fmtHours(l.hours)}h)</text>` + meetBar(l, y + 4, ri); return; }
            const s = r.s; const textColor = s.late ? (s.priority === 3 || s.priority === 4 ? "rgb(128,128,128)" : (s.priority === 2 ? "rgb(255,165,80)" : "rgb(224,108,117)")) : "gray"; rows += `<text class="glabel" data-path="${escA(s.path)}" data-line="${s.line}" x="${ind + 6}" y="${y + rh / 2 + 4}" font-size="12" fill="${textColor}" cursor="pointer">${esc(clip(s.title, Math.max(6, 26 - r.depth * 3)))} (${fmtHours(s.duration)}h)</text>` + taskBars(s, y + 4, ri); const dx = xAt(s.dlIdx); rows += `<line x1="${dx}" y1="${y + 2}" x2="${dx}" y2="${y + rh - 2}" stroke="${s.late ? "rgb(224,108,117)" : "rgb(152,195,121)"}" stroke-width="2" stroke-dasharray="3 2" pointer-events="none"/>`;
        });

        let arrows = ""; sched.forEach(s => { if (s.__row == null) return; s.deps.forEach(dep => { const p = idToAll[dep]; if (!p || !p.__row || p.__row === s.__row) return; const ex = xAt(p.endCal), ey = midY(p.__row), sx = xAt(s.startCal), sy = midY(s.__row); arrows += `<path d="M ${ex} ${ey} C ${ex + 18} ${ey}, ${sx - 18} ${sy}, ${sx - 2} ${sy}" fill="none" stroke="rgb(230,160,60)" stroke-width="1.6"/><polygon points="${sx},${sy} ${sx - 8},${sy - 4} ${sx - 8},${sy + 4}" fill="rgb(230,160,60)"/>`; }); });
        meetData.forEach(l => { if (l.__row == null) return; l.deps.forEach(dep => { const p = idToAll[dep]; if (!p || !p.__row || p.__row === l.__row) return; const exVal = p.duration !== undefined ? p.endCal : p.calE; const ex = xAt(exVal), ey = midY(p.__row), sx = xAt(l.calS), sy = midY(l.__row); arrows += `<path d="M ${ex} ${ey} C ${ex + 18} ${ey}, ${sx - 18} ${sy}, ${sx - 2} ${sy}" fill="none" stroke="rgb(230,160,60)" stroke-width="1.6"/><polygon points="${sx},${sy} ${sx - 8},${sy - 4} ${sx - 8},${sy + 4}" fill="rgb(230,160,60)"/>`; }); });
        const todayL = `<line x1="${xAt(0)}" y1="${gm.top}" x2="${xAt(0)}" y2="${H - 16}" stroke="rgb(152,195,121)" stroke-width="2"/>`;
        gscroll.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block"><rect x="0" y="0" width="${gm.lab}" height="${H}" fill="rgba(128,128,128,0.04)"/>${grid}${todayL}${axis}${rows}${arrows}</svg>`;
        gscroll.querySelectorAll(".gbar").forEach(el => openTask(el)); gscroll.querySelectorAll(".glabel").forEach(el => openTask(el));
        gscroll.querySelectorAll(".gfold").forEach(el => el.addEventListener("click", () => { const id = el.getAttribute("data-node"); if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); drawGantt(); }));
    }

    function gZoomX(f, r) { const before = gscroll.scrollLeft + (r ?? 0.5) * gscroll.clientWidth, oldW = gDays * basePxG * gScaleX; gScaleX = Math.min(30, Math.max(0.4, gScaleX * f)); drawGantt(); const newW = gDays * basePxG * gScaleX; if (oldW > 0) gscroll.scrollLeft = before * (newW / oldW) - (r ?? 0.5) * gscroll.clientWidth; }
    gxIn.onclick = () => gZoomX(1.3, 0.5); gxOut.onclick = () => gZoomX(1 / 1.3, 0.5);
    gxReset.onclick = () => { gScaleX = 1; gRowH = 24; drawGantt(); gscroll.scrollLeft = 0; };
    gyIn.onclick = () => { gRowH = Math.min(48, gRowH + 4); drawGantt(); }; gyOut.onclick = () => { gRowH = Math.max(14, gRowH - 4); drawGantt(); };
    collapseAll.onclick = () => { allGroupIds(root, []).forEach(id => collapsed.add(id)); drawGantt(); };
    expandAll.onclick = () => { collapsed.clear(); drawGantt(); };
    gscroll.addEventListener("wheel", (e) => {
        if (e.ctrlKey) { e.preventDefault(); gZoomX(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - gscroll.getBoundingClientRect().left) / gscroll.clientWidth); }
        else if (e.altKey) { e.preventDefault(); gRowH = Math.min(48, Math.max(14, gRowH + (e.deltaY < 0 ? 2 : -2))); drawGantt(); }
    }, { passive: false });
    drawGantt();
    return { sched, calToDT };
}

// --- Execution List Renderer ---
function renderExecutionList(container, seq, calToDT) {
    const planDiv = container.createEl("div"); planDiv.style.cssText = "font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;";
    let prevDate = null; const lines = [];
    seq.forEach((e, i) => {
        const dateStr = calToDT(e.startCal).toFormat("ccc dd LLL"); const showDate = dateStr !== prevDate; if (showDate) prevDate = dateStr;
        let col, lateStyle;
        if (e.kind === "meet") { col = "rgb(198,120,221)"; lateStyle = ""; }
        else if (e.late) {
            if (e.priority === 3 || e.priority === 4) { col = "rgb(128,128,128)"; lateStyle = "background:rgba(128,128,128,0.1);"; }
            else if (e.priority === 2) { col = "rgb(255,165,80)"; lateStyle = "background:rgba(255,165,80,0.1);"; }
            else { col = "rgb(224,108,117)"; lateStyle = "background:rgba(224,108,117,0.1);"; }
        } else { col = "rgb(97,175,239)"; lateStyle = ""; }
        const dueTxt = e.kind === "meet" ? "fixed" : `due ${esc(e.dl)}`;
        if (showDate) lines.push(`<div style="background:rgba(97,175,239,0.08);padding:3px 8px;font-weight:600;color:rgb(97,175,239);font-size:12px;border-bottom:1px solid rgba(128,128,128,0.2);">${esc(dateStr)}</div>`);
        lines.push(`<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid rgba(128,128,128,0.15);${lateStyle}"><span style="color:${col};font-weight:bold;float:left;width:24px;text-align:right;margin-right:8px;">${i + 1}.</span><div style="overflow:hidden;"><div style="margin-bottom:1px;">${renderMd(e.title)} <b>(${fmtHours(e.hours)}h)</b></div><div style="color:gray;font-size:11px;">${esc(e.file)} · ${dueTxt}${e.late ? " · <b>LATE</b>" : ""}</div></div></div>`);
    });
    planDiv.innerHTML = lines.join(""); planDiv.querySelectorAll(".prow").forEach(el => openTask(el));
}

// --- Ignored Tasks Renderer ---
function getIgnoreReason(d) {
    if (!d.ownDL && !d.graphDL) return "no deadline or inherited deadline";
    if (!d.ownDL) return "no own deadline and inherited deadline is invalid";
    if (d.eff === null) return "locked task";
    return "no effective deadline";
}

function renderIgnored(container, ignored) {
    const dropDiv = container.createEl("div"); dropDiv.style.cssText = "font-size:13px;border:1px solid rgba(128,128,128,0.25);border-radius:6px;overflow:hidden;";
    dropDiv.innerHTML = ignored.slice(0, 10).map((d, idx) => `<div class="prow" data-path="${escA(d.path)}" data-line="${d.line}" style="cursor:pointer;display:flex;gap:8px;align-items:baseline;padding:4px 8px;border-bottom:1px solid rgba(128,128,128,0.15);"><span style="color:rgb(224,108,117);font-weight:bold;">${idx + 1}.</span><div style="flex:1;"><div>${renderMd(d.title)}</div><div style="color:gray;font-size:11px;margin-top:2px;">ignored: ${getIgnoreReason(d)}</div></div></div>`).join("");
    dropDiv.querySelectorAll(".prow").forEach(el => openTask(el));
    if (ignored.length > 10) dropDiv.createEl("div", { text: `... and ${ignored.length - 10} more ignored tasks.` }).style.cssText = "padding:5px;color:gray;font-size:12px;text-align:center;";
    else if (ignored.length === 0) dropDiv.createEl("div", { text: "No first-class undone tasks found that were filtered out." }).style.cssText = "padding:5px;color:gray;font-size:12px;text-align:center;";
}

// --- Parsing Errors Renderer ---
function renderParsingErrors(container, warnings) {
    const errDiv = container.createEl("div"); errDiv.style.cssText = "font-size:13px;border:1px solid rgba(128,128,0.25);border-radius:6px;overflow:hidden;";
    if (!warnings.length) { errDiv.createEl("div", { text: "No parsing errors found — all task metadata is valid." }).style.cssText = "padding:5px;color:gray;font-size:12px;text-align:center;"; return; }
    const rows = warnings.map((e, idx) => { const errorList = e.errors.map(err => `<span style="color:rgb(224,108,117);font-size:11px;">${esc(err)}</span>`).join(" · "); return `<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;padding:4px 8px;border-bottom:1px solid rgba(128,128,0.15);"><span style="color:rgb(255,165,0);font-weight:bold;min-width:24px;display:inline-block;text-align:right;margin-right:8px;">${idx + 1}.</span><div style="overflow:hidden;"><div style="margin-bottom:2px;">${renderMd(e.text)}</div><div style="color:gray;font-size:11px;">${esc(e.file)} · L${e.line} · ${errorList}</div></div></div>`; });
    errDiv.innerHTML = rows.join(""); errDiv.querySelectorAll(".prow").forEach(el => openTask(el));
    if (warnings.length > 10) errDiv.createEl("div", { text: `... and ${warnings.length - 10} more parsing errors.` }).style.cssText = "padding:5px;color:gray;font-size:12px;text-align:center;";
}

// =============================================
// 4️⃣ MAIN ORCHESTRATOR
// =============================================
const { tasks: all, items, locks, dependents, markSet, warnings: parsingWarnings } = collectPlannerData(pages);

if (!items.length) {
    dv.paragraph("No tasks with a duration and an (own or inherited) deadline found.");
} else {
    // --- Duplicate ID Warning ---
    const idCounts = new Map(); all.forEach(t => { if (t.id == null) return; idCounts.set(t.id, (idCounts.get(t.id) || 0) + 1); });
    const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();
    if (dupIds.length) {
        const dupWarn = dv.container.createEl("div", { text: "" }); dupWarn.style.cssText = "margin-top:12px;font-weight:700;font-size:13px;color:rgb(224,108,117);";
        dupWarn.innerHTML = `⚠ Duplicate task id${dupIds.length > 1 ? "s" : ""}: ${dupIds.map(id => `${id} (${idCounts.get(id)}×)`).join(", ")}`;
    }

    const today = dv.date("today");
    const SCHEDULE = { ...SCHEDULE_CONFIG };

    // ===== LOGIC PHASE =====
    const scheduleData = computeSchedule(items, locks, today, SCHEDULE);
    const capacityData = computeCapacity(items, locks, today, SCHEDULE);

    // ===== DEFICIT SUMMARY (needs schedule results) =====
    const { sched } = scheduleData;
    const deficitSummary = dv.container.createEl("div", { text: "" });
    deficitSummary.style.cssText = "margin-top:12px;font-weight:700;font-size:13px;color:rgb(224,108,117);";
    const late = sched.filter(s => s.late).length;
    const planned = items.reduce((s, it) => s + it.duration, 0);
    const peakDeficit = capacityData.values.length ? -Math.min(0, ...capacityData.values) : 0;
    deficitSummary.innerHTML = `${late} late ${late === 1 ? "task" : "tasks"} · peak deficit ${fmtHours(peakDeficit)}h · ${fmtHours(planned)}h planned`;

    // ===== RENDERING PHASE =====
    const wrap = dv.container.createEl("div");

    // Capacity Chart
    dv.container.createEl("div", { text: "Capacity Chart" }).style.cssText = "margin-top:16px;font-weight:700;font-size:13px;";
    renderCapacity(wrap, capacityData, SCHEDULE);

    // Gantt Chart
    dv.container.createEl("div", { text: `EDF schedule (single resource · weekday ${SCHEDULE.hoursPerDay}h · meetings fixed)` }).style.cssText = "margin-top:16px;font-weight:700;font-size:13px;";
    renderGantt(wrap, scheduleData);

    // Execution List
    const seq = [...sched.map(s => ({ kind: "task", startCal: s.startCal, endCal: s.endCal, title: s.title, hours: s.duration, path: s.path, line: s.line, file: s.file, late: s.late, dl: s.deadline.toFormat("dd LLL yyyy"), priority: s.priority })), ...locks.map(l => ({ kind: "meet", startCal: l.calS, endCal: l.calE, title: l.title, hours: l.hours, path: l.path, line: l.line, file: l.file, late: false, dl: l.day.toFormat("dd LLL yyyy") }))].sort((a, b) => a.startCal - b.startCal);
    dv.container.createEl("div", { text: "Planning — execution order" }).style.cssText = "margin-top:16px;font-weight:700;font-size:13px;";
    renderExecutionList(wrap, seq, scheduleData.calToDT);

    // Ignored Tasks
    const ignored = all.filter(r => !r.isIndented && !r.locked && !r.eff);
    dv.container.createEl("div", { text: "Ignored first-class undone tasks (to review, correct or delete)" }).style.cssText = "margin-top:16px;font-weight:700;font-size:13px;color:rgb(224,108,117);";
    renderIgnored(dv.container, ignored);

    // Parsing Errors
    dv.container.createEl("div", { text: "Parsing errors (tasks with malformed metadata)" }).style.cssText = "margin-top:16px;font-weight:700;font-size:13px;color:rgb(255,165,0);";
    renderParsingErrors(dv.container, parsingWarnings);
}
```
