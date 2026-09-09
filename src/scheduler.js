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
 * Find the highest priority late task with shortest duration that is NOT already locked
 */
export function findHighestPriorityShortestLate(sched, lockedKeys) {
  const lateTasks = sched.filter(s => s.late && !lockedKeys.has(`${s.path}:${s.line}`));
  if (lateTasks.length === 0) return null;

  // Find the highest priority (lowest priority number) among late tasks
  const minPriority = Math.min(...lateTasks.map(t => t.priority));
  const highestPriorityLate = lateTasks.filter(t => t.priority === minPriority);

  // Among highest priority late tasks, find the one with shortest duration
  let shortest = highestPriorityLate[0];
  for (const task of highestPriorityLate) {
    if (task.duration < shortest.duration) {
      shortest = task;
    }
  }

  return shortest;
}

/**
 * Schedule with EDF (Earliest Deadline First)
 * Pure function - takes items, lockedItems, allocator config
 */
export function scheduleWithEDF(remainingItems, lockedItems, allocator) {
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

  // Sort remaining items by EDF (earliest deadline first)
  const sorted = [...remainingItems].sort((a, b) =>
    a.deadline - b.deadline || b.duration - a.duration
  );

  const result = [];

  for (const item of sorted) {
    const dlIdx = item.deadline.diff(today, 'days').days;
    const segs = item.duration <= 0 ? [{ calS: dlIdx, calE: dlIdx }] : allocator.allocate(item.duration);
    const startCal = segs.length ? segs[0].calS : dlIdx;
    const endCal = segs.length ? segs[segs.length - 1].calE : dlIdx;
    const late = endCal > dlIdx;

    result.push({
      ...item,
      dlIdx,
      segs,
      startCal,
      endCal,
      late
    });
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
    let s = (sc - SCHEDULE.startHour) / SCHEDULE.hoursPerDay;
    let e = s + lk.hours / SCHEDULE.hoursPerDay;
    s = Math.max(0, Math.min(1, s));
    e = Math.max(s, Math.min(1, e));
    lk.calS = lk.day.diff(today, 'days').days + s;
    lk.calE = lk.day.diff(today, 'days').days + e;
    if (i != null) (meetIv[i] = meetIv[i] || []).push({ s, e });
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
    finalSched = scheduleWithEDF(remainingItems, lockedItems, allocator);

    // Check if there's priority inversion among late tasks
    if (!hasPriorityInversionAmongLate(finalSched)) {
      break;
    }

    // Find the highest priority late task with shortest duration that is NOT already locked
    const taskToLock = findHighestPriorityShortestLate(finalSched, lockedKeys);

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
