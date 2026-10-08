// src/execution_sequence.js - Build the execution-order sequence (tasks + meetings).
// Pure, testable. `sched` entries come from computeSchedule; `locks` are meetings.
// `today` is the schedule's reference DateTime (luxon).

// Task row for the execution list.
function taskRow(s) {
  return {
    kind: 'task',
    startCal: s.startCal,
    endCal: s.endCal,
    title: s.title,
    hours: s.duration,
    path: s.path,
    line: s.line,
    file: s.file,
    late: s.late,
    dl: s.deadline.toFormat('dd LLL yyyy'),
    priority: s.priority
  };
}

// Meeting row. A meeting past working hours must stay on its requested calendar date
// (it must NOT roll to the next day): clamp its display start into its own working day
// so it groups under `meetDateStr`, and carry the requested date for the date header.
// Sort keys: `sortDay` is the clamped day (grouping stays on the requested date),
// `sortFrac` is the TRUE intra-day position — negative for a pre-hours meeting
// (08:00 < 09:00 day start), above 1 for a post-hours one — so a pre-hours meeting
// sorts before a 09:00 task even though both clamp to startCal 0, while a post-hours
// meeting stays after the day's last task without rolling into the next day.
function meetRow(l, today) {
  // Integer calendar-day index (DST-exact — see scheduler.js note on Math.round).
  const dayIdx = Math.round(l.day.diff(today, 'days').days);
  const dispStart = Math.max(dayIdx, Math.min(l.calS, dayIdx + 1 - 1e-9));
  return {
    kind: 'meet',
    startCal: dispStart,
    sortDay: Math.floor(dispStart),
    sortFrac: l.calS - dayIdx,
    // True clock time as written in the note: the agenda shows the real time of a
    // meeting, including ones outside working hours — calToDT cannot express those
    // (the cal fraction only maps into the working window), and the clamped
    // startCal is only for date grouping and sort in the execution list.
    meetTrueTime: `${String(l.hour).padStart(2, '0')}:${String(l.min).padStart(2, '0')}`,
    endCal: l.calE,
    title: l.title,
    hours: l.hours,
    path: l.path,
    line: l.line,
    file: l.file,
    late: l.displayLate,
    priority: l.priority,
    dl: l.day.toFormat('dd LLL yyyy'),
    meetDateStr: l.day.toFormat('ccc dd LLL')
  };
}

// Tasks and meetings interleaved in chronological (cal) order. Primary key: the
// display day. Secondary key: the intra-day position — the true clock fraction for
// meetings, the scheduled working-window fraction for tasks (09:00 -> 0, 17:00 -> 1;
// a pre-hours meeting is < 0 and a post-hours one is > 1, so both compare correctly).
export function buildExecutionSequence(sched, locks, today) {
  const dayOf = (e) => e.sortDay ?? Math.floor(e.startCal);
  const fracOf = (e) => e.sortFrac ?? e.startCal - Math.floor(e.startCal);
  return [
    ...sched.map(taskRow),
    ...locks.map(l => meetRow(l, today))
  ].sort((a, b) => dayOf(a) - dayOf(b) || fracOf(a) - fracOf(b));
}
