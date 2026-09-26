// src/agenda.js — pure selector for "today's agenda": the scheduled work and
// meetings that fall on the schedule's reference day (today).
// Pure, testable: consumes the execution sequence (buildExecutionSequence output)
// — no Obsidian/Dataview dependencies.
// A cal value (days + fraction) belongs to `today` when its whole-day part is 0
// relative to the schedule's reference date. Meetings keep their requested date
// (meetDateStr carries it), so a meeting is "today" when its display start is.
export function selectTodayAgenda(seq) {
  // Tasks/meetings starting in [0, 1) cal-days from today (i.e. on today's date).
  // A segment that starts today and spills past 17:00 still belongs to today.
  // Meetings clamped past working hours keep dayIdx in [0, 1) so they stay today.
  return seq.filter(e => Math.floor(e.startCal) === 0);
}
