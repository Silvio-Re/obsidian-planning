// src/scheduler.js - Scheduling logic (no Obsidian/Dataview dependencies)
// All emoji are imported from constants.js - NEVER use literal emoji

/**
 * Create an allocator for scheduling tasks across work days
 * Pure function - takes configuration and returns allocation functions
 */
export function createAllocator(today, workDays, meetIv, SCHEDULE) {
  const freeCache = {};

  function dayFree(di) {
    if (freeCache[di]) return freeCache[di];
    const ms = (meetIv[di] || []).slice().sort((a, b) => a.s - b.s);
    const free = [];
    let c = 0;
    for (const mi of ms) {
      if (mi.s > c) free.push([c, mi.s]);
      c = Math.max(c, mi.e);
    }
    if (c < 1) free.push([c, 1]);
    return (freeCache[di] = free.filter(iv => iv[1] - iv[0] > 1e-9));
  }

  let di = 0;
  let ivs = dayFree(0);
  let fi = 0;
  let pos = ivs[0] ? ivs[0][0] : 1;

  function advance() {
    while (di < workDays.length) {
      while (fi < ivs.length) {
        if (pos < ivs[fi][1] - 1e-9) return true;
        fi++;
        if (fi < ivs.length) pos = ivs[fi][0];
      }
      di++;
      if (di < workDays.length) {
        ivs = dayFree(di);
        fi = 0;
        pos = ivs[0] ? ivs[0][0] : 1;
      }
    }
    return false;
  }

  return {
    allocate: (hours) => {
      const segs = [];
      let rem = hours;
      while (rem > 1e-9 && advance()) {
        const iv = ivs[fi];
        const base = workDays[di].diff(today, 'days').days;
        const availH = (iv[1] - pos) * SCHEDULE.hoursPerDay;
        const take = Math.min(availH, rem);
        const tf = take / SCHEDULE.hoursPerDay;
        segs.push({ calS: base + pos, calE: base + pos + tf });
        pos += tf;
        rem -= take;
      }
      return segs;
    },
    reset: () => {
      di = 0;
      ivs = dayFree(0);
      fi = 0;
      pos = ivs[0] ? ivs[0][0] : 1;
    }
  };
}

/**
 * Check if there's priority inversion among late tasks
 * Late tasks are those where endCal > dlIdx
 * Priority inversion: a higher priority task (lower number) comes after a lower priority task
 */
export function hasPriorityInversionAmongLate(sched) {
  const lateTasks = sched.filter(s => s.late);
  if (lateTasks.length < 2) return false;

  // Sort late tasks by their start time in the schedule
  const lateTasksByTime = [...lateTasks].sort((a, b) => a.startCal - b.startCal);

  // Check if any higher priority late task comes after a lower priority late task
  for (let i = 0; i < lateTasksByTime.length; i++) {
    for (let j = i + 1; j < lateTasksByTime.length; j++) {
      // If task j has higher priority (lower number) but comes later (higher startCal)
      if (lateTasksByTime[j].priority < lateTasksByTime[i].priority &&
          lateTasksByTime[j].startCal > lateTasksByTime[i].startCal) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find the highest priority late task with the earliest deadline that is NOT already locked.
 * Among equal-priority late tasks the earliest deadline wins (a (priority, deadline) order,
 * consistent with the EDF heuristic), not the shortest duration.
 */
export function findHighestPriorityEarliestDeadlineLate(sched, lockedKeys) {
  const lateTasks = sched.filter(s => s.late && !lockedKeys.has(`${s.path}:${s.line}`));
  if (lateTasks.length === 0) return null;

  // Find the highest priority (lowest priority number) among late tasks
  const minPriority = Math.min(...lateTasks.map(t => t.priority));
  const highestPriorityLate = lateTasks.filter(t => t.priority === minPriority);

  // Among highest priority late tasks, pick the one with the earliest deadline
  let earliest = highestPriorityLate[0];
  for (const task of highestPriorityLate) {
    if (task.deadline < earliest.deadline) {
      earliest = task;
    }
  }

  return earliest;
}

/**
 * Schedule with EDF (Earliest Deadline First) respecting dependency order.
 * Uses topological sort with deadline constraint: among tasks whose
 * dependencies are all already placed, pick the earliest-deadline one
 * (tie-break: longer duration first).
 *
 * Pure function - takes items, lockedItems, allocator config
 */
export function scheduleWithEDF(remainingItems, lockedItems, allocator, today) {
  const lockedWithTimes = [];

  // First, allocate time for locked items (they've been placed first)
  for (const lockedItem of lockedItems) {
    const dlIdx = lockedItem.deadline.diff(today, 'days').days;
    const segs = lockedItem.duration <= 0 ? [{ calS: dlIdx, calE: dlIdx }] : allocator.allocate(lockedItem.duration);
    const startCal = segs.length ? segs[0].calS : dlIdx;
    const endCal = segs.length ? segs[segs.length - 1].calE : dlIdx;
    const late = endCal > dlIdx;

    lockedWithTimes.push({
      ...lockedItem,
      dlIdx,
      segs,
      startCal,
      endCal,
      late
    });
  }

  // Schedule remaining items respecting dependencies (topological EDF)
  const scheduled = new Set(lockedItems.map(it => `${it.path}:${it.line}`));
  const unscheduled = new Map();
  remainingItems.forEach(item => unscheduled.set(`${item.path}:${item.line}`, item));
  const result = [];
  let cycleGuard = scheduled.size + unscheduled.size + 1;

  while (unscheduled.size > 0 && cycleGuard > 0) {
    cycleGuard--;

    // Find ready tasks: all deps already scheduled (or have no deps)
    const ready = [];
    for (const [key, item] of unscheduled) {
      if (item.deps.length === 0 || item.deps.every(dep => scheduled.has(dep))) {
        ready.push(item);
      }
    }

    // If no ready tasks but unscheduled remain, we have a cycle.
    // Fall back to remaining items sorted by deadline (handles orphan deps).
    if (ready.length === 0) {
      for (const item of remainingItems) {
        if (!scheduled.has(`${item.path}:${item.line}`)) {
          const dlIdx = item.deadline.diff(today, 'days').days;
          const segs = item.duration <= 0 ? [{ calS: dlIdx, calE: dlIdx }] : allocator.allocate(item.duration);
          const startCal = segs.length ? segs[0].calS : dlIdx;
          const endCal = segs.length ? segs[segs.length - 1].calE : dlIdx;
          const late = endCal > dlIdx;
          scheduled.add(`${item.path}:${item.line}`);
          result.push({ ...item, dlIdx, segs, startCal, endCal, late });
        }
      }
      break;
    }

    // Among ready tasks, pick earliest deadline; tie-break: longer duration
    ready.sort((a, b) => a.deadline - b.deadline || b.duration - a.duration);
    const chosen = ready[0];
    unscheduled.delete(`${chosen.path}:${chosen.line}`);
    scheduled.add(`${chosen.path}:${chosen.line}`);

    const dlIdx = chosen.deadline.diff(today, 'days').days;
    const segs = chosen.duration <= 0 ? [{ calS: dlIdx, calE: dlIdx }] : allocator.allocate(chosen.duration);
    const startCal = segs.length ? segs[0].calS : dlIdx;
    const endCal = segs.length ? segs[segs.length - 1].calE : dlIdx;
    const late = endCal > dlIdx;

    result.push({ ...chosen, dlIdx, segs, startCal, endCal, late });
  }

  return [...lockedWithTimes, ...result];
}

/**
 * Compute schedule using EDF with iterative priority correction for late tasks
 * Pure function - takes items, locks, today, SCHEDULE config
 * Returns schedule data with today, SCHEDULE, calToDT, idToAll, workDays
 */
export function computeSchedule(items, locks, today, SCHEDULE) {
  // Setup work days and meetings
  let sStart = today;
  while (sStart.weekday > 5) sStart = sStart.plus({ days: 1 });

  const totalWH = items.reduce((s, it) => s + it.duration, 0) + locks.reduce((s, l) => s + l.hours, 0);
  const needWD = Math.ceil(totalWH / (SCHEDULE.hoursPerDay / 2)) + 6;
  const workDays = [];
  let d = sStart;
  let guard = 0;
  while (workDays.length < needWD && guard++ < 9000) {
    if (d.weekday <= 5) workDays.push(d);
    d = d.plus({ days: 1 });
  }

  const wdIndex = {};
  workDays.forEach((d, i) => wdIndex[d.toFormat('yyyy-MM-dd')] = i);

  const meetIv = {};
  const meetData = [];

  locks.forEach(lk => {
    const i = wdIndex[lk.day.toFormat('yyyy-MM-dd')];
    const sc = lk.hour + lk.min / 60;
    // (Unclamped) intra-day start/end fraction. A meeting past working hours keeps its
    // true position so the Gantt bar extends past the day's end into the next working
    // day (the user knows the meeting time and it must be enforced).
    const s = (sc - SCHEDULE.startHour) / SCHEDULE.hoursPerDay;
    const e = s + lk.hours / SCHEDULE.hoursPerDay;
    // Working-time lock: clamp to the day's [0,1] so only in-hours time is reserved;
    // a meeting that starts past the working day reserves no extra working time.
    const lockS = Math.max(0, Math.min(1, s));
    const lockE = Math.max(lockS, Math.min(1, e));
    const dayIdx = lk.day.diff(today, 'days').days;
    lk.calS = dayIdx + s;
    lk.calE = dayIdx + e;
    if (i != null) (meetIv[i] = meetIv[i] || []).push({ s: lockS, e: lockE });
    meetData.push({ ...lk });
  });

  // Iterative scheduling with priority correction
  let remainingItems = [...items];
  let lockedItems = [];
  let lockedKeys = new Set();
  let finalSched = [];

  const maxIterations = items.length * 2;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const allocator = createAllocator(today, workDays, meetIv, SCHEDULE);
    finalSched = scheduleWithEDF(remainingItems, lockedItems, allocator, today);

    // Check if there's priority inversion among late tasks
    if (!hasPriorityInversionAmongLate(finalSched)) {
      break;
    }

    // Find the highest priority late task with the earliest deadline that is NOT already locked
    const taskToLock = findHighestPriorityEarliestDeadlineLate(finalSched, lockedKeys);

    if (!taskToLock) {
      break;
    }

    // Lock this task
    const taskKey = `${taskToLock.path}:${taskToLock.line}`;
    lockedKeys.add(taskKey);
    remainingItems = remainingItems.filter(item =>
      `${item.path}:${item.line}` !== taskKey
    );
    lockedItems.push(taskToLock);
  }

  const sched = finalSched;

  // Build lookup maps
  const idToAll = {};
  sched.forEach(s => { if (s.id) idToAll[s.id] = s; });
  meetData.forEach(l => { if (l.id) idToAll[l.id] = l; });

  // A meeting (lock) is a fixed block and cannot itself be late. But tasks that
  // must be performed BEFORE the meeting are its prerequisites (lk.deps). If any
  // prerequisite task is late, the meeting is flagged as displayLate so the UI
  // can highlight it exactly like a late task (its prep work didn't finish on time).
  locks.forEach(lk => {
    let late = false;
    for (const dep of lk.deps || []) {
      const depTask = idToAll[dep];
      if (depTask && depTask.late) { late = true; break; }
    }
    lk.displayLate = late;
  });

  // Calendar utilities
  function calToDT(cal) {
    const dayOff = Math.floor(cal + 1e-9);
    const frac = cal - dayOff;
    return today.plus({
      days: dayOff,
      hours: SCHEDULE.startHour,
      minutes: Math.round(frac * SCHEDULE.hoursPerDay * 60)
    });
  }

  return { sched, meetData: locks, today, SCHEDULE, calToDT, idToAll, workDays };
}
