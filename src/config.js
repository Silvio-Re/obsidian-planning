// src/config.js — USER_CONFIG, the one block a user edits in the generated bundle.
// This file is FIRST in every artifact's build list, so after `npm run build` the
// USER_CONFIG object is the first thing in the planning.md / daily.md code block.
// Pure module (no Obsidian/Dataview dependencies) — testable directly.
//
// Fields:
//   folders    — vault folder(s) holding task notes: a string or an array of strings.
//   startHour  — workday start (24h clock). 9 = 09:00.
//   hoursPerDay — workday length in hours.

export const USER_CONFIG = {
  folders: 'Projets',
  startHour: 9,
  hoursPerDay: 7.8,
  // Days with no working capacity (holidays, vacation). Each entry is a
  // 'YYYY-MM-DD' date or a 'YYYY-MM-DD/YYYY-MM-DD' inclusive range.
  nonWorkingDays: [],
};

// Dataview folder query for the configured folder(s).
// A single folder  -> '"Projets"'
// Multiple folders  -> '"A" or "B"' (Dataview's source "or" syntax)
// Empty/invalid     -> '""' (matches nothing — the dashboard shows its empty state
//                      instead of scanning the whole vault by accident).
export function folderQuery(folders) {
  // null/undefined -> the configured default (same as calling with no argument).
  if (folders == null) folders = USER_CONFIG.folders;
  const list = (Array.isArray(folders) ? folders : [folders])
    .filter(f => typeof f === 'string' && f.trim())
    .map(f => f.trim().replace(/^"|"$/g, ''));
  if (!list.length) return '""';
  return list.map(f => `"${f}"`).join(' or ');
}

// Expand USER_CONFIG.nonWorkingDays into a Set of 'YYYY-MM-DD' keys.
// Accepts single dates ('2026-12-25') and inclusive ranges ('2026-07-20/2026-08-07').
// Invalid or non-string entries are ignored (a holiday typo must not break the
// schedule; the plan just treats that day as a normal workday).
export function nonWorkingSet(days) {
  const set = new Set();
  const list = Array.isArray(days) ? days : (days != null ? [days] : []);
  const valid = (iso) => {
    const d = new Date(iso + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
  };
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const m = entry.match(/^(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(\d{4}-\d{2}-\d{2}))?$/);
    if (!m || !valid(m[1])) continue;
    if (!m[2]) { set.add(m[1]); continue; }
    if (!valid(m[2])) continue;
    let d = new Date(m[1] + 'T00:00:00Z');
    const end = new Date(m[2] + 'T00:00:00Z');
    let guard = 0;
    while (d <= end && guard++ < 4000) {
      set.add(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() + 86400000);
    }
    if (guard >= 4000 && d <= end) {
      // Range over ~11 years: warn instead of silently dropping the tail.
      console.warn(`[planning] nonWorkingDays range '${entry}' exceeds 4000 days; only the first 4000 were applied`);
    }
  }
  return set;
}
