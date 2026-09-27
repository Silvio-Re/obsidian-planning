// src/risk.js — at-risk detection: per-task slack between scheduled finish and deadline.
// Pure, testable: consumes the computed schedule (computeSchedule output), the
// work-day list, the per-day meeting intervals (meetIv) and the SCHEDULE config.
//
// Slack of a task = working capacity still available between its scheduled finish
// and its deadline, minus the duration of every OTHER on-time task that is
// scheduled to finish after it but shares or precedes its deadline (that work
// must also fit inside the same window). Late tasks are excluded everywhere:
// they are already condemned and surfaced by the lateness indicators elsewhere —
// counting them here would push on-time siblings to negative slack that says
// nothing about the sibling itself.
//
// A task is AT RISK when its slack is positive but thin: less than a quarter of
// a working day (SCHEDULE.hoursPerDay / 4). One small surprise — a meeting moved,
// a task underestimated — and it turns late.

// Working capacity (hours) available in the continuous cal-window (from, to].
// `base(i)` is the cal start of work day i. Meetings reduce a day's capacity
// through meetIv (clamped [s, e] fractions, exactly like the allocator's dayFree).
function windowCapacity(from, to, workDays, meetIv, SCHEDULE, today) {
  let cap = 0;
  for (let i = 0; i < workDays.length; i++) {
    const base = workDays[i].diff(today, 'days').days;
    const dayEnd = base + 1;
    const lo = Math.max(from, base);
    const hi = Math.min(to, dayEnd);
    if (hi <= lo) continue;
    let free = hi - lo;
    for (const mi of meetIv[i] || []) {
      const ov = Math.min(hi, base + mi.e) - Math.max(lo, base + mi.s);
      if (ov > 0) free -= ov;
    }
    cap += Math.max(0, free) * SCHEDULE.hoursPerDay;
  }
  return cap;
}

// Compute slack (hours) for every scheduled task.
export function computeSlack(sched, workDays, meetIv, SCHEDULE, today) {
  return sched.map(t => {
    const cap = windowCapacity(t.endCal, t.dlIdx, workDays, meetIv, SCHEDULE, today);
    const competing = sched
      .filter(o => o !== t && !o.late && o.endCal > t.endCal && o.dlIdx <= t.dlIdx)
      .reduce((s, o) => s + o.duration, 0);
    return { ...t, slackHours: cap - competing };
  });
}

// Tasks whose slack is positive but below a quarter working day — the plan
// technically finishes them on time, but with almost no margin. Sorted worst
// first. Already-late tasks are not repeated here.
export function computeAtRisk(slacked, SCHEDULE) {
  const threshold = SCHEDULE.hoursPerDay / 4;
  return slacked
    .filter(t => !t.late && t.slackHours < threshold)
    .sort((a, b) => a.slackHours - b.slackHours);
}
