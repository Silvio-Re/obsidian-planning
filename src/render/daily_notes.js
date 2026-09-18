// src/render/daily_notes.js — "Completed today" view for a daily-note template.
// Shows the /Projets tasks completed on the day the block lives in, reusing the SAME grouped tree
// as the main dashboard's completed panel (renderCompleted, onlyDate mode) — one source of truth
// for both the monthly range view and the single-day view.

import { isCompleteDate, baseName } from '../constants.js';
import { extractCompletedTask } from '../parser.js';
import { renderCompleted } from './completed.js';

// Collect finished ([x]) tasks from /Projets pages into the shared completion shape. Only tasks
// with a completion date ever reach renderCompleted (it filters on compDate), so tasks marked
// done without a completion marker are naturally excluded from the daily view.
export function collectDailyCompleted(pages) {
  const done = [];
  for (const page of pages || []) {
    const path = page.file.path;
    const file = baseName(path);
    for (const t of page.file.tasks) {
      if (!t.completed) continue;
      done.push(extractCompletedTask({ text: t.text, path, file, line: t.line }));
    }
  }
  return done;
}

// Render the daily completed view. `dailyTitle` is the daily note's title (yyyy-mm-dd) or null
// when the current note is not a date-named daily note (then show a hint instead of an empty tree).
export function renderDailyCompleted(container, pages, today, dailyTitle) {
  // The header is always shown; the body below it depends on whether this note is a dated daily.
  container.createEl('div', { text: 'Completed today' }).style.cssText =
    'margin-top:24px;font-weight:700;font-size:13px;';

  if (!isCompleteDate(dailyTitle)) {
    container.createEl('div', {
      text: 'Paste this block into a dated daily note (file name YYYY-MM-DD) to see tasks completed that day.'
    }).style.cssText =
      'font-size:12px;color:gray;padding:6px 8px;border:1px solid rgba(128,128,128,0.2);border-radius:6px;margin-top:4px;';
    return;
  }
  const done = collectDailyCompleted(pages);
  renderCompleted(container, done, today, { onlyDate: dailyTitle });
}
