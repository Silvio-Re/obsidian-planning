// src/index.js - Main orchestrator for Obsidian DataviewJS
// This is the entry point that gets wrapped in ```dataviewjs ```
// It uses dv, dv.app, and other Obsidian APIs

// Import all modules
import { USER_CONFIG, folderQuery, nonWorkingSet } from './config.js';
import { CLOCK, CALENDAR, ID_MARKER, BLOCK_MARKER, PRIORITY, PRIORITY_RANK, PRIORITY_DEFAULT, priorityRe, durRe, dateRe, idRe, blkRe, parsePriority, fmtHours, ownDur, cleanTitle, baseName } from './constants.js';
import { collectPlannerData } from './parser.js';
import { computeSchedule } from './scheduler.js';
import { computeCapacity } from './capacity.js';
import { buildExecutionSequence } from './execution_sequence.js';
import { selectTodayAgenda } from './agenda.js';
import { renderAgenda } from './render/agenda.js';
import { renderCapacity } from './render/capacity_chart.js';
import { renderGantt } from './render/gantt.js';
import { renderExecutionList } from './render/execution_list.js';
import { computeSlack, computeAtRisk } from './risk.js';
import { renderRisk } from './render/risk.js';
import { renderIgnored, getIgnoreReason } from './render/ignored.js';
import { renderParsingErrors } from './render/parsing_errors.js';
import { renderCompleted } from './render/completed.js';

// =============================================
// MAIN EXECUTION
// =============================================

const pages = dv.pages(folderQuery(USER_CONFIG.folders));

// Collect all planner data
const { tasks: all, items, locks, dependents, markSet, warnings: parsingWarnings, completed } = collectPlannerData(pages);

const today = dv.date('today');
const SCHEDULE_CONFIG = { startHour: USER_CONFIG.startHour, hoursPerDay: USER_CONFIG.hoursPerDay, nonWorkingDays: nonWorkingSet(USER_CONFIG.nonWorkingDays) };

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
  // Each section is a header followed by its own container, appended in order,
  // so the dashboard reads top-to-bottom: Today, capacity, Gantt, execution list.
  const section = (text) => {
    const h = dv.container.createEl('div', { text });
    h.style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;';
    return dv.container.createEl('div');
  };
  // Today's agenda — first panel: the most actionable slice of the plan.
  const seq = buildExecutionSequence(sched, locks, today);
  const agendaRows = selectTodayAgenda(seq);
  renderAgenda(section('Today'), agendaRows, scheduleData.calToDT, today);
  // Capacity Chart
  renderCapacity(section('Capacity Chart'), capacityData, SCHEDULE_CONFIG);
  // Gantt Chart
  renderGantt(section(`EDF schedule (single resource — weekday ${SCHEDULE_CONFIG.hoursPerDay}h — meetings fixed)`), scheduleData);
  // Execution List
  renderExecutionList(section('Planning — execution order'), seq, scheduleData.calToDT);
  // At-risk panel: on-time tasks whose slack margin is thin
  const slacked = computeSlack(scheduleData.sched, scheduleData.workDays, scheduleData.meetIv, SCHEDULE_CONFIG, today);
  renderRisk(section('At risk — on time but with almost no slack'), computeAtRisk(slacked, SCHEDULE_CONFIG));
  // Ignored Tasks
  const ignored = all.filter(r => !r.isIndented && !r.locked && !r.eff);
  dv.container.createEl('div', { text: 'Ignored first-class undone tasks (to review, correct or delete)' }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;color:rgb(224,108,117);';
  renderIgnored(dv.container, ignored);

  // Parsing Errors
  dv.container.createEl('div', { text: 'Parsing errors (tasks with malformed metadata)' }).style.cssText = 'margin-top:16px;font-weight:700;font-size:13px;color:rgb(255,165,0);';
  renderParsingErrors(dv.container, parsingWarnings);
}

// ===== COMPLETED TASKS (always rendered, at the very end) =====
dv.container.createEl('div', { text: 'Completed tasks' }).style.cssText = 'margin-top:24px;font-weight:700;font-size:13px;';
renderCompleted(dv.container, completed, today);
