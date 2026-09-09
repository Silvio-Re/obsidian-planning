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
const CALENDAR_CHAR = '\u{1F4C5}';  // U+1F4C5: CALENDAR
const ID_CHAR = '\u{1F3F4}';  // U+1F3F4: WAVING BLACK FLAG
const BLOCK_CHAR = '\u{26D4}';  // U+26D4: CROSSED SWORDS

export const CLOCK = CLOCK_CHAR;
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

// Regex patterns
// In template literals used with new RegExp(), we need to double-escape backslashes
// \s becomes \\s, \d becomes \\d, etc.

export const priorityRe = new RegExp(
  `(${P0}|${P1}|${P2}|${P3}|${P4})\\uFE0F?`,
  'u'
);

export const durRe = new RegExp(
  `(${CLOCK_CHAR}:: *(\\d+(?:\\.\\d+)?)h)|${CLOCK_CHAR} *(\\d+(?:\\.\\d+)?)h`,
  'u'
);

export const dateRe = new RegExp(
  `${CALENDAR_CHAR}\\s*\\[*\\s*(\\d{4}-\\d{2}-\\d{2})(?:\\s*\\]*\\s*(\\d{1,2}):(\\d{2}))?`,
  'u'
);

export const idRe = new RegExp(
  `${ID_CHAR}\\s*([\\w-]+)`,
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

export function ownDur(t) {
  const dm = t.text.match(durRe);
  if (!dm) return 0;
  const num = dm[2] || dm[3];
  return num ? parseFloat(num) : 0;
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
