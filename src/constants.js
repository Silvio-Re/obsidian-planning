import { USER_CONFIG } from './config.js';
// Emoji Constants
// DO NOT EDIT - Use escape sequences from EMOJI_REFERENCE.md
// AI MUST use these constants. NEVER use literal emoji.
// ALL emoji MUST use \u{XXXXXX} format - these are Unicode escape sequences

// Define emoji using Unicode escape sequences
// These are interpreted by JavaScript as the actual Unicode characters
const P0 = '\u{1F53A}';  // U+1F53A: UP-POINTING RED TRIANGLE
const P1 = '\u{23EB}';  // U+23EB: BLACK UP-POINTING DOUBLE TRIANGLE  
const P2 = '\u{1F53C}';  // U+1F53C: UP-POINTING TRIANGLE
const P3 = '\u{1F53D}';  // U+1F53D: DOWN-POINTING TRIANGLE
const P4 = '\u{23EC}';  // U+23EC: BLACK DOWN-POINTING DOUBLE TRIANGLE
const CLOCK_CHAR = '\u{23F1}';  // U+23F1: STOPWATCH
const CHECK_CHAR = '\u{2705}';  // U+2705: GREEN CHECK MARK
const CALENDAR_CHAR = '\u{1F4C5}';  // U+1F4C5: CALENDAR
const ID_CHAR = '\u{1F194}';  // U+1F194: SQUARED CL
const BLOCK_CHAR = '\u{26D4}';  // U+26D4: CROSSED SWORDS

export const CLOCK = CLOCK_CHAR;
export const CHECK = CHECK_CHAR;
export const CALENDAR = CALENDAR_CHAR;
export const ID_MARKER = ID_CHAR;
export const BLOCK_MARKER = BLOCK_CHAR;

export const PRIORITY = {
  P0: P0,
  P1: P1,
  P2: P2,
  P3: P3,
  P4: P4,
};

export const PRIORITY_RANK = {
  [P0]: 0,
  [P1]: 1,
  [P2]: 2,
  [P3]: 3,
  [P4]: 4,
};

export const PRIORITY_DEFAULT = 2;

// Emoji for each priority rank (reverse of PRIORITY_RANK).
export const PRIORITY_BY_RANK = {
  0: P0,
  1: P1,
  2: P2,
  3: P3,
  4: P4,
};

// Map a numeric priority rank to its emoji (defaults to P2).
export function priorityEmoji(rank) {
  return PRIORITY_BY_RANK[rank] != null ? PRIORITY_BY_RANK[rank] : PRIORITY_BY_RANK[PRIORITY_DEFAULT];
}

// Regex patterns
// In template literals used with new RegExp(), we need to double-escape backslashes
// \s becomes \\s, \d becomes \\d, etc.

export const priorityRe = new RegExp(
  `(${P0}|${P1}|${P2}|${P3}|${P4})\\uFE0F?`,
  'u'
);

export const durRe = new RegExp(
  `${CLOCK_CHAR} *(?::: *)?(?:` +
  `(?<th>\\d{1,2})[:h](?<tmm>\\d{2})(?![A-Za-z\\d])` +
  `|(?<num>\\d+(?:[.,]\\d+)?) *(?<unit>h|hours?|d|days?|j|jours?|min(?:ute)?s?)(?![A-Za-z\\d])` +
  `|(?<bnum>\\d{1,2}(?:[.,]\\d+)?)(?![A-Za-z\\d:]|\\s+[A-Za-z]|,\\s*[A-Za-z])` +
  `)`,
  'iu'
);

export const dateRe = new RegExp(
  `${CALENDAR_CHAR}\\s*\\[*\\s*(\\d{4}-\\d{2}-\\d{2})(?:\\s*\\]*\\s*(\\d{1,2}):(\\d{2}))?`,
  'u'
);

export const idRe = new RegExp(
  `${ID_CHAR}\\s*([\\w-]+)`,
  'u'
);

// Completion date marker (✅ YYYY-MM-DD). Optional surrounding brackets/spaces are tolerated.
export const completionRe = new RegExp(
  `${CHECK_CHAR} *\\[*\\s*([0-9]{4}-[0-9]{2}-[0-9]{2})`,
  'u'
);

export const blkRe = new RegExp(
  `${BLOCK_CHAR}\\s*([\\w,\\-\\s]+)`,
  'u'
);

// Helper functions
export function parsePriority(text) {
  const pm = text.match(priorityRe);
  return pm ? PRIORITY_RANK[pm[1]] : PRIORITY_DEFAULT;
}

export function fmtHours(h) {
  return h.toFixed(1).replace(/\.0$/, '');
}

// --- Completion-date filtering (used by the Completed Tasks month filter) ---

// Parse a "YYYY-MM-DD" completion date into { year: number, month: number(1-12) }, or null.
export function completionMonth(compDate) {
  if (!compDate) return null;
  const m = String(compDate).match(/^(\d{4})-(\d{2})/);
  return m ? { year: +m[1], month: +m[2] } : null;
}

// Filter completed tasks to those finished in the given year/month (month is 1-12).
export function filterByCompletionMonth(completed, year, month) {
  return (completed || []).filter((t) => {
    const cm = completionMonth(t.compDate);
    return cm && cm.year === year && cm.month === month;
  });
}

// Full completion date key "YYYY-MM-DD", or null if missing/unparseable.
export function completionKey(compDate) {
  if (!compDate) return null;
  const m = String(compDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// True only for a complete "YYYY-MM-DD" date.
export function isCompleteDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v));
}

// Normalize typed input to "YYYY-MM-DD". Accepts a raw digit string ("20260915") or a
// partially typed one; leaves short input untouched so the field stays usable while typing.
// Once the year (4 digits) is present, the month/day are appended exactly as typed
// (slice(4,6)/slice(6,8) keep 1 or 2 digits), so a partial month like "2026-0" or a partial
// day like "2026-09-1" survive instead of being dropped.
export function normDate(v) {
  const d = String(v).replace(/\D/g, '');
  if (d.length < 4) return v;
  let out = d.slice(0, 4);
  if (d.length >= 5) out += '-' + d.slice(4, 6);
  if (d.length >= 7) out += '-' + d.slice(6, 8);
  return out;
}

// Inclusive completion-date range filter. Empty bounds are treated as open-ended.
// Dates are compared as "YYYY-MM-DD" strings (lexicographic order == chronological order).
export function filterByCompletionRange(completed, startKey, endKey) {
  return (completed || []).filter((t) => {
    const k = completionKey(t.compDate);
    if (!k) return false;
    if (startKey && k < startKey) return false;
    if (endKey && k > endKey) return false;
    return true;
  });
}

// First / last day ("YYYY-MM-DD") of a month (month is 1-12).
export function monthStartKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
export function monthEndKey(year, month) {
  // new Date(year, month, 0) => last day of `month` (month is 1-12).
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// The current year/month from a luxon DateTime (has numeric .year/.month) or a native Date.
// Defaults to now when nothing usable is provided.
export function currentMonth(today) {
  if (today && typeof today.year === 'number' && typeof today.month === 'number') {
    return { year: today.year, month: today.month };
  }
  const d = today instanceof Date ? today : new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// Build the markdown line shown for a completed task, e.g.:
//   - [x] Formulaire de demande de formation 📅 [[[2026-09-15](2026-09-15)]] ⏱ 1h ⏫ ✅ 2026-09-15
// Input `t` fields: title, dlStr (YYYY-MM-DD), hours (>0 to show), priority (rank), compDate (YYYY-MM-DD).
export function formatCompletedLine(t) {
  const out = ['- [x]'];
  if (t.title) out.push(t.title);
  if (t.dlStr) out.push(`${CALENDAR} [[[${t.dlStr}](${t.dlStr})]]`);
  if (t.hours && t.hours > 0) out.push(`${CLOCK} ${fmtHours(t.hours)}h`);
  out.push(priorityEmoji(t.priority));
  if (t.compDate) out.push(`${CHECK} ${t.compDate}`);
  return out.join(' ');
}

export function ownDur(t) {
  const dm = t.text.match(durRe);
  if (!dm) return 0;
  const g = dm.groups;
  const toNum = (s) => parseFloat(String(s).replace(',', '.'));
  if (g.th != null) {
    if (+g.tmm > 59) return 0;
    return toNum(g.th) + toNum(g.tmm) / 60;
  }
  const raw = g.num ?? g.bnum;
  if (raw == null) return 0;
  const unit = (g.unit ?? 'h').toLowerCase();
  const v = toNum(raw);
  if (unit.startsWith('min')) return v / 60;
  if (unit === 'd' || unit === 'j' || unit.startsWith('day') || unit.startsWith('jour')) {
    return v * (USER_CONFIG?.hoursPerDay || 7.8);
  }
  return v;
}

export function cleanTitle(text) {
  // Remove all metadata markers from the START of text to end of line
  // In Obsidian, metadata appears at the beginning: "📅 2024-01-01 ⏱:: 2h actual task"
  // This pattern removes from the first metadata char to the end
  const metadataChars = `${CALENDAR_CHAR}${ID_CHAR}${BLOCK_CHAR}${P0}${P1}${P2}${P3}${P4}`;
  const metadataPattern = new RegExp(
    `[${metadataChars}\\uFE0F].*`,
    'u'
  );
  return text
    .replace(metadataPattern, '')
    .replace(durRe, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function baseName(p) {
  return p.split('/').pop().replace(/\.md$/, '');
}
