// src/daily_notes.js — entry point for the daily-note template (bundled into daily.md).
// Mirrors index.js: shows the /Projets tasks completed on the day of the daily note it lives in.
// It uses dv, dv.app, and other Obsidian APIs, same as index.js.

import { renderDailyCompleted } from './render/daily_notes.js';
import { USER_CONFIG, folderQuery } from './config.js';

const pages = dv.pages(folderQuery(USER_CONFIG.folders));

const today = dv.date('today');

// The daily note's title (its file name without extension) is the date the view is filtered to.
// Guarded because dv.current() / file.name are the source of truth and must exist in Obsidian.
const current = (dv.current && dv.current()) || null;
const dailyTitle = current && current.file ? current.file.name : null;

renderDailyCompleted(dv.container, pages, today, dailyTitle);
