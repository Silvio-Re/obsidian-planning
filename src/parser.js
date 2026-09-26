// src/parser.js - Data collection and parsing for Obsidian tasks
// This file uses dv and Obsidian-specific data structures
// It's NOT testable outside Obsidian

import { CALENDAR, ID_MARKER, BLOCK_MARKER, PRIORITY_DEFAULT, priorityRe, durRe, dateRe, idRe, blkRe, completionRe, parsePriority, ownDur, cleanTitle, baseName } from './constants.js';

// --- Completion extraction (shared, pure) ---
// Parses the completion metadata of a finished ([x]) task. Kept pure (only `text` + identity
// fields) so both `collectAll` (main dashboard) and the daily-note view parse ✅ completion
// dates identically — a single source of truth for what "done" means.
export function extractCompletedTask({ text, path, file, line }) {
  const km = text.match(dateRe);
  const dm = text.match(completionRe);
  const noComp = text.replace(completionRe, '');
  return {
    title: cleanTitle(noComp),
    path,
    file,
    line,
    dlStr: km ? km[1] : null,
    hours: ownDur({ text }),
    priority: parsePriority(text),
    compDate: dm ? dm[1] : null,
  };
}

// --- Data Collection ---
export function collectAll(pages) {
  const all = [];
  const seen = new Set();
  const warnings = [];
  const completed = [];

  // --- Pass 1: collect every task's ID so dependencies can be validated ---
  // A dep can reference a task defined anywhere in the vault (any page, any order),
  // so the known-ID set must be complete before any ⛔ can be checked. Subtasks are
  // visited explicitly: Dataview lists them flat inside file.tasks, but recursing
  // keeps the set correct under either shape.
  const knownIds = new Set();
  const collectId = (t) => {
    if (t.status !== '-' && !t.completed) {
      const idm = t.text.match(idRe);
      if (idm) knownIds.add(idm[1].replace(/[^a-zA-Z0-9_-]+$/, ''));
    }
    for (const c of t.subtasks ?? []) collectId(c);
  };
  for (const page of pages) {
    for (const t of page.file.tasks) collectId(t);
  }


  for (const page of pages) {
    const path = page.file.path;
    const file = baseName(path);
    const childKeys = new Set();

    const markChildren = (t) => {
      for (const c of t.subtasks ?? []) {
        childKeys.add(`${path}:${c.line}`);
        markChildren(c);
      }
    };

    for (const t of page.file.tasks) markChildren(t);

    for (const t of page.file.tasks) {
      if (t.status === '-') continue;
      // Completed ([x]) tasks are kept only for the completion log; they are never scheduled.
      if (t.completed) {
        completed.push(extractCompletedTask({ text: t.text, path, file, line: t.line }));
        continue;
      }
      const key = `${path}:${t.line}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const km = t.text.match(dateRe);
      const idm = t.text.match(idRe);
      const blm = t.text.match(blkRe);
      const priority = parsePriority(t.text);
      let ownDL = null;
      let locked = false;
      let mDate = null;
      let mHour = 0;
      let mMin = 0;
      const parsingErrors = [];

      try {
        if (km) {
          if (km[2] != null) {
            locked = true;
            mDate = dv.date(km[1]);
            mHour = +km[2];
            mMin = +km[3];
            if (isNaN(mHour) || mHour < 0 || mHour > 23) parsingErrors.push(`Hour invalid: ${km[2]}`);
            if (isNaN(mMin) || mMin < 0 || mMin > 59) parsingErrors.push(`Minute invalid: ${km[3]}`);
            if (!mDate) parsingErrors.push(`Date parse failed: ${km[1]}`);
          } else {
            ownDL = dv.date(km[1]);
            if (!ownDL) parsingErrors.push(`Date parse failed: ${km[1]}`);
          }
        }
      } catch (e) {
        parsingErrors.push(`Exception: ${e.message}`);
      }

      const dur = ownDur(t);
      if (dur < 0) parsingErrors.push(`Negative duration: ${dur}h`);
      const isIndented = childKeys.has(key);

      const taskEntry = {
        key,
        node: t,
        path,
        file,
        line: t.line,
        ownDL,
        locked,
        mDate,
        mHour,
        mMin,
        graphDL: km ? dv.date(km[1]) : null,
        id: idm ? idm[1].replace(/[^a-zA-Z0-9_-]+$/, '') : null,
        deps: blm ? blm[1].split(',').map(s => s.trim().replace(/[^a-zA-Z0-9_-]+$/, '')).filter(Boolean) : [],
        title: cleanTitle(t.text),
        priority,
        isIndented,
        _parsingErrors: parsingErrors,
      };

      // Unknown dependency check (pass 2, once all IDs are known): a ⛔ pointing at an
      // ID that no task carries is a typo or a stale reference — the scheduler can never
      // satisfy it, so surface it like any other malformed metadata instead of silently
      // scheduling the task as if it had no constraint. Completed and cancelled tasks
      // don't count as dependency targets: a dep on finished work is not a scheduling
      // constraint, and treating it as known would hide a stale reference.
      const unknownDeps = taskEntry.deps.filter(dep => !knownIds.has(dep));
      if (unknownDeps.length) {
        parsingErrors.push(`Unknown dependency: ${unknownDeps.join(', ')}`);
      }

      if (parsingErrors.length) {
        warnings.push({ text: t.text, path, line: t.line, errors: parsingErrors });
      }
      all.push(taskEntry);
    }
  }

  return { all, seen, warnings, completed };
}

// --- Graph Building ---
export function buildGraph(all) {
  const dependents = {};
  all.forEach(r => r.deps.forEach(dep => {
    dependents[dep] = dependents[dep] || [];
    dependents[dep].push(r);
  }));

  const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

  function effectiveDL(item) {
    let best = item.ownDL;
    const vis = new Set([item.key]);
    const stack = [item];
    while (stack.length) {
      const cur = stack.pop();
      best = minDate(best, cur.graphDL);
      if (cur.id && dependents[cur.id]) {
        for (const d of dependents[cur.id]) {
          if (!vis.has(d.key)) {
            vis.add(d.key);
            stack.push(d);
          }
        }
      }
    }
    return best;
  }

  all.forEach(r => r.eff = r.locked ? null : effectiveDL(r));

  function effectivePriority(item) {
    let best = item.priority;
    const vis = new Set([item.key]);
    const stack = [item];
    while (stack.length) {
      const cur = stack.pop();
      best = Math.min(best, cur.priority);
      for (const dep of cur.deps) {
        const depTasks = all.filter(r => r.id === dep);
        for (const dt of depTasks) {
          if (!vis.has(dt.key)) {
            vis.add(dt.key);
            stack.push(dt);
          }
        }
      }
    }
    return best;
  }

  all.forEach(r => r.effPriority = effectivePriority(r));
  const markSet = new Set(all.filter(r => r.eff).map(r => r.key));

  return { dependents, markSet };
}

// --- Chargeable Hours Calculation ---
export function chargeableHours(node, path, markSet) {
  let sum = ownDur(node);
  for (const c of node.subtasks ?? []) {
    if (c.completed || c.status === '-') continue;
    if (markSet.has(`${path}:${c.line}`)) continue;
    sum += chargeableHours(c, path, markSet);
  }
  return sum === 0 ? 0.1 : sum;
}

// --- Main Data Collection ---
export function collectPlannerData(pages) {
  const { all, warnings, completed } = collectAll(pages);
  const { dependents, markSet } = buildGraph(all);
  const items = [];
  const locks = [];

  for (const r of all) {
    if (r.locked) {
      // A meeting whose date failed to parse (mDate null) must not become a lock: the
      // scheduler and renderers assume lk.day is a valid DateTime and would crash the
      // whole dashboard. The parsing-error panel already flags the task with the reason.
      if (!r.mDate) continue;
      const h = chargeableHours(r.node, r.path, markSet);
      if (h > 0) {
        locks.push({
          day: r.mDate,
          hour: r.mHour,
          min: r.mMin,
          hours: h,
          title: r.title,
          path: r.path,
          line: r.line,
          file: r.file,
          id: r.id,
          deps: r.deps,
          priority: r.effPriority
        });
      }
      continue;
    }

    if (!r.eff) continue;

    const hours = chargeableHours(r.node, r.path, markSet);
    items.push({
      duration: hours,
      deadline: r.eff,
      title: r.title,
      path: r.path,
      line: r.line,
      file: r.file,
      id: r.id,
      deps: r.deps,
      ownStr: r.ownDL ? r.ownDL.toFormat('yyyy-MM-dd') : '--',
      inherited: !r.ownDL || r.eff < r.ownDL,
      priority: r.effPriority
    });
  }

  return { tasks: all, items, locks, dependents, markSet, warnings, completed };
}
