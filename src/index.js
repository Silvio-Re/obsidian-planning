// src/index.js - Main orchestrator for Obsidian DataviewJS
// This is the entry point that gets wrapped in ```dataviewjs ```
// It uses dv, dv.app, and other Obsidian APIs

// Import all modules
import { CLOCK, CALENDAR, ID_MARKER, BLOCK_MARKER, PRIORITY, PRIORITY_RANK, PRIORITY_DEFAULT, priorityRe, durRe, dateRe, idRe, blkRe, parsePriority, fmtHours, ownDur, cleanTitle, baseName } from './constants.js';
import { collectPlannerData } from './parser.js';
import { computeSchedule } from './scheduler.js';
import { computeCapacity } from './capacity.js';
import { renderCapacity } from './render/capacity_chart.js';
import { renderGantt } from './render/gantt.js';
import { renderExecutionList } from './render/execution_list.js';
import { renderIgnored, getIgnoreReason } from './render/ignored.js';
import { renderParsingErrors } from './render/parsing_errors.js';

// =============================================
// MAIN EXECUTION
// =============================================

const pages = dv.pages('"Projets"');

// Collect all planner data
const { tasks: all, items, locks, dependents, markSet, warnings: parsingWarnings } = collectPlannerData(pages);

const today = dv.date('today');
const SCHEDULE_CONFIG = { startHour: 9, hoursPerDay: 8 };

if (!items.length) {
  dv.paragraph('No tasks with a duration and an (own or inherited) deadline found.');
} else {
  // --- Duplicate ID Warning ---
  const idCounts = new Map();
  all.forEach(t => { if (t.id == null) return; idCounts.set(t.id, (idCounts.get(t.id) || 0) + 1); });
  const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();
  if (dupIds.length) {
    const dupWarn = dv.container.createEl('div', { text: '' });
    dupWarn.style.cssText = 'margin-top:12px;font-weight:700;font-size:13px;color:rgb(224,108,117);';
    dupWarn.innerHTML = `\u26a0 Duplicate task id${dupIds.length > 1 ? 's' : ''}: ${dupIds.map(id => `${id} (${idCounts.get(id)}\u00d7)`).join(', ')}`;
  }

  // ===== LOGIC PHASE =====
  const scheduleData = computeSchedule(items, locks, today, SCHEDULE_CONFIG);
  const capacityData = computeCapacity(items, locks, today, SCHEDULE_CONFIG);

  // ===== DEFICIT SUMMARY (needs schedule results) =====
  const { sched } = scheduleData;
  const deficitSummary = dv.container.createEl('div', { text: '' });
  deficitSummary.style.cssText = 'margin-top:12px;font-weight:700;font-size:13px;color:rgb(224,108,117);';
  const late = sched.filter(s => s.late).length;
  const planned = items.reduce((s, it) => s + it.duration, 0);
  const peakDeficit = capacityData.values.length ? -Math.min(0, ...capacityData.values) : 0;
  deficitSummary.innerHTML = `${late} late ${late === 1 ? 'task' : 'tasks'} \u2014 peak deficit ${fmtHours(peakDeficit)}h \u2014 ${fmtHours(planned)}h planned`;

  // ===== RENDERING PHASE =====
  const wrap = dv.container.createEl('div');

  // Capacity Chart
  dv.container.createEl('div', { text: 'Capacity Chart' }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;';
  renderCapacity(wrap, capacityData, SCHEDULE_CONFIG);

  // Gantt Chart
  dv.container.createEl('div', { text: `EDF schedule (single resource \u2014 weekday ${SCHEDULE_CONFIG.hoursPerDay}h \u2014 meetings fixed)` }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;';
  renderGantt(wrap, scheduleData);

  // Execution List
  const seq = [...sched.map(s => ({ kind: 'task', startCal: s.startCal, endCal: s.endCal, title: s.title, hours: s.duration, path: s.path, line: s.line, file: s.file, late: s.late, dl: s.deadline.toFormat('dd LLL yyyy'), priority: s.priority })), ...locks.map(l => ({ kind: 'meet', startCal: l.calS, endCal: l.calE, title: l.title, hours: l.hours, path: l.path, line: l.line, file: l.file, late: false, dl: l.day.toFormat('dd LLL yyyy') }))].sort((a, b) => a.startCal - b.startCal);
  dv.container.createEl('div', { text: 'Planning \u2014 execution order' }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;';
  renderExecutionList(wrap, seq, scheduleData.calToDT);

  // Ignored Tasks
  const ignored = all.filter(r => !r.isIndented && !r.locked && !r.eff);
  dv.container.createEl('div', { text: 'Ignored first-class undone tasks (to review, correct or delete)' }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;color:rgb(224,108,117);';
  renderIgnored(dv.container, ignored);

  // Parsing Errors
  dv.container.createEl('div', { text: 'Parsing errors (tasks with malformed metadata)' }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;color:rgb(255,165,0);';
  renderParsingErrors(dv.container, parsingWarnings);
}
