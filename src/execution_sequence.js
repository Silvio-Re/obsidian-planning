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
function meetRow(l, today) {
  const dayIdx = l.day.diff(today, 'days').days;
  const dispStart = Math.max(dayIdx, Math.min(l.calS, dayIdx + 1 - 1e-9));
  return {
    kind: 'meet',
    startCal: dispStart,
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

// Tasks and meetings interleaved in chronological (cal) order.
export function buildExecutionSequence(sched, locks, today) {
  return [
    ...sched.map(taskRow),
    ...locks.map(l => meetRow(l, today))
  ].sort((a, b) => a.startCal - b.startCal);
}
