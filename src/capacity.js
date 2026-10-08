// src/capacity.js - Capacity calculation logic
// All emoji are imported from constants.js - NEVER use literal emoji

/**
 * Compute capacity data for visualization
 * Pure function - takes items, locks, today, SCHEDULE config
 * Returns capacity data object
 */
export function computeCapacity(items, locks, today, SCHEDULE) {
  // Find date range
  const lastDeadline = items.reduce((mx, it) => (it.deadline > mx ? it.deadline : mx), today);
  const firstDeadline = items.reduce((mn, it) => (it.deadline < mn ? it.deadline : mn), lastDeadline);
  const range = Math.max(1, Math.round(lastDeadline.diff(today, 'days').days));
  const startDate = firstDeadline < today ? firstDeadline : today;
  const endDate = today.plus({ days: 2 * range });
  const totalDays = Math.max(1, Math.round(endDate.diff(startDate, 'days').days));
  const t0 = Math.round(today.diff(startDate, 'days').days);

  // Calculate meeting hours per day
  const meetH = {};
  locks.forEach(lk => {
    const k = lk.day.toFormat('yyyy-MM-dd');
    meetH[k] = (meetH[k] || 0) + lk.hours;
  });

  // Build date array and labels
  const dateArr = [];
  const labels = [];
  const values = [];
  const capHours = new Array(totalDays + 1);

  for (let d = 0; d <= totalDays; d++) {
    const date = startDate.plus({ days: d });
    dateArr.push(date);
    labels.push(date.toFormat('yyyy-MM-dd'));
  }

  // Calculate cumulative capacity hours
  capHours[t0] = 0;
  const nonWorking = SCHEDULE.nonWorkingDays || new Set();
  for (let i = t0 + 1; i <= totalDays; i++) {
    const dk = dateArr[i].toFormat('yyyy-MM-dd');
    capHours[i] = capHours[i - 1] + (dateArr[i].weekday <= 5 && !nonWorking.has(dk) ? Math.max(0, SCHEDULE.hoursPerDay - (meetH[dk] || 0)) : 0);
  }
  for (let i = t0 - 1; i >= 0; i--) capHours[i] = 0;

  // Demand owed by the END of day d: a task counts once its due-by day — its
  // deadline minus the buffer day (README > Deadline: the deadline date is NOT
  // usable working time, on-time means finished by midnight the day BEFORE) — has
  // arrived, i.e. dueIdx <= d. The red deadline markers (marksData) stay on the
  // deadline's own date; the demand line must lead them by one day or the chart
  // shows a deficit only when it is already too late to act on it.
  const dueIdx = items.map(it => Math.round(it.deadline.diff(startDate, 'days').days) - 1);
  for (let d = 0; d <= totalDays; d++) {
    const demand = items.reduce((s, it, k) => s + (dueIdx[k] <= d ? it.duration : 0), 0);
    values.push(capHours[d] - demand);
  }

  // Calculate forward minimum (worst deficit from this point onward)
  let fwdMin = Infinity;
  for (let d = totalDays; d >= 0; d--) {
    fwdMin = Math.min(fwdMin, values[d]);
    values[d] = fwdMin;
  }

  // Build marks data for visualization
  const marksData = items.map(it => ({
    i: Math.round(it.deadline.diff(startDate, 'days').days),
    date: it.deadline.toFormat('yyyy-MM-dd'),
    title: it.title,
    hours: it.duration,
    path: it.path,
    line: it.line,
    file: it.file,
    inherited: it.inherited,
    ownStr: it.ownStr,
    priority: it.priority
  }));

  // Group by day
  const byDay = {};
  marksData
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title))
    .forEach(d => {
      if (!byDay[d.i]) byDay[d.i] = [];
      byDay[d.i].push(d);
    });

  // Calculate max stack height
  let maxStack = 1;
  Object.values(byDay).forEach(arr => {
    let acc = 0;
    arr.forEach(d => {
      d.accBelow = acc;
      acc += d.hours;
    });
    if (acc > maxStack) maxStack = acc;
  });

  return { values, labels, dateArr, byDay, maxStack, totalDays, t0, startDate };
}
