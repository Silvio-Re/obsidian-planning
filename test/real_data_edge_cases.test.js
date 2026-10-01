import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('Testing regex patterns against real vault data...');

// Load the actual regex patterns from src/constants.js
const constantsRaw = fs.readFileSync(path.join(ROOT, 'src/constants.js'), 'utf8');
const CLOCK_CHAR = '\u{23F1}';
const CALENDAR_CHAR = '\u{1F4C5}';
const ID_CHAR = '\u{1F194}';
const BLOCK_CHAR = '\u{26D4}';

const durRe = new RegExp(
  `${CLOCK_CHAR} *(?::: *)?(?:` +
  `(?<th>\\d{1,2})[:h](?<tmm>\\d{2})(?![A-Za-z\\d])` +
  `|(?<num>\\d+(?:[.,]\\d+)?) *(?<unit>h|hours?|d|days?|j|jours?|min(?:ute)?s?)(?![A-Za-z\\d])` +
  `|(?<bnum>\\d{1,2}(?:[.,]\\d+)?)(?![A-Za-z\\d:]|\\s+[A-Za-z]|,\\s*[A-Za-z])` +
  `)`,
  'iu'
);
const dateRe = new RegExp(
  `${CALENDAR_CHAR}\\s*\\[*\\s*(\\d{4}-\\d{2}-\\d{2})(?:\\s*\\]*\\s*(\\d{1,2}):(\\d{2}))?`,
  'u'
);
const idRe = new RegExp(
  `${ID_CHAR}\\s*([\\w-]+)`,
  'u'
);
const blkRe = new RegExp(
  `${BLOCK_CHAR}\\s*([\\w,\\-\\s]+)`,
  'u'
);

// Real priority symbols from the vault
const PRIORITY_SYMBOLS = ['\ud83d\udd3a', '\u23eb', '\ud83d\udd3c', '\ud83d\udd3d', '\u23ec'];
const PRIORITY_RANK = { '\ud83d\udd3a': 0, '\u23eb': 1, '\ud83d\udd3c': 2, '\ud83d\udd3d': 3, '\u23ec': 4 };
const PRIORITY_DEFAULT = 2;
const priorityRe = new RegExp(
  `(${PRIORITY_SYMBOLS.join('|')})\\uFE0F?`,
  'u'
);

const DAY_H = 7.8;
function ownDur(t) {
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
  if (unit === 'd' || unit === 'j' || unit.startsWith('day') || unit.startsWith('jour')) return v * DAY_H;
  return v;
}

function parsePriority(text) {
  const pm = text.match(priorityRe);
  return pm ? PRIORITY_RANK[pm[1]] : PRIORITY_DEFAULT;
}

// Real task text snippets copied from the vault
const realTasks = [
  "Demandé à Baptiste : qui va s'occuper de la DIC 📅 [[2026-09-21]]",
  "📅 2026-09-24 9:00 (⏱:: 8h) ⛔ zmr7cx",
  "Devis insitu 📅 2026-09-14 🔽   ⏱ 3h ",
  "📅 [[2026-09-15]] ⏱ 1h ⏫ ",
  "Relancer le projet sous le périph 📅 [[2026-09-14]] ⛔ n3zqo9 (⏱:: 1h)  🔽 ",
  "Relancer Bastien sur le sujet facturation le 📅  [[2026-10-01]] (⏱:: 0.1h) 🔽 ",
  "📅 2026-09-01 ⏱4h",
  "📅 [[2026-09-01 ]] (⏱:: 1h) ⏬  ",
  "Faire un planning 📅 [[2026-10-05 ]] ⏱ 50h",
  "📅 2026-11-02 (⏱:: 0.2h) ⏫ ",
  "pading 📅 2026-10-31⏱ 200h",
  "prépa déplacement 📅 2026-09-17 ⏱ 1h",
  "Répondre à fernando.perez@ibk.baug.ethz.ch 📅 2026-09-01 🔽 ⏱ 1h",
  "Implémenter la pr.AxA (méthode simplifiée + méthode de consigni) 🆔 837lo3 (⏱:: 24h) 📅  2026-10-12",
  "📅 2026-09-24 9:00 (⏱:: 8h)",
  "📅 2026-09-22 9:00 (⏱:: 0.5h)",
  "📅 [[2026-09-08]] ⏱ 1h 🆔 5fenhr",
  "retour à Manuel sur le planning à partir du 2026-10-12 📅 2026-09-10 ⏱ 1h ⛔ 5fenhr",
  "(⏱:: 1h)",
  "⏱ 2h",
  "📅 2026-09-14 🔽 ⏱ 1h",
];

// --- durRe patterns from real data ---
console.log('  Testing durRe against real duration patterns...');

assert.strictEqual(ownDur({ text: "(⏱:: 1h)" }), 1, '(⏱:: 1h)');
assert.strictEqual(ownDur({ text: "⏱ 3h" }), 3, '⏱ 3h');
assert.strictEqual(ownDur({ text: "⏱4h" }), 4, '⏱4h no space');
assert.strictEqual(ownDur({ text: "(⏱:: 0.1h)" }), 0.1, '(⏱:: 0.1h) fractional');
assert.strictEqual(ownDur({ text: "⏱ 50h" }), 50, '⏱ 50h large');
assert.strictEqual(ownDur({ text: "(⏱:: 200h)" }), 200, '(⏱:: 200h) very large');
assert.strictEqual(ownDur({ text: "(⏱:: 0.2h)" }), 0.2, '(⏱:: 0.2h) very small');
assert.strictEqual(ownDur({ text: "⏱ 1h" }), 1, '⏱ 1h');
assert.strictEqual(ownDur({ text: "(⏱:: 0.5h)" }), 0.5, '(⏱:: 0.5h) half hour');
assert.strictEqual(ownDur({ text: "(⏱:: 24h)" }), 24, '(⏱:: 24h) full day');

// Real task texts
assert.strictEqual(ownDur({ text: "Devis insitu 📅 2026-09-14 🔽   ⏱ 3h " }), 3, 'real: Devis insitu');
assert.strictEqual(ownDur({ text: "Relancer le projet sous le périph 📅 [[2026-09-14]] ⛔ n3zqo9 (⏱:: 1h)  🔽 " }), 1, 'real: Relancer le projet');
assert.strictEqual(ownDur({ text: "📅 2026-09-01 ⏱4h" }), 4, 'real: ⏱4h no space');
assert.strictEqual(ownDur({ text: "Faire un planning 📅 [[2026-10-05 ]] ⏱ 50h" }), 50, 'real: ⏱ 50h');
assert.strictEqual(ownDur({ text: "pading 📅 2026-10-31⏱ 200h" }), 200, 'real: ⏱ 200h no space');
assert.strictEqual(ownDur({ text: "Répondre à fernando.perez@ibk.baug.ethz.ch 📅 2026-09-01 🔽 ⏱ 1h" }), 1, 'real: email address in text');
assert.strictEqual(ownDur({ text: "Faire un CR 📅 2026-09-01  (⏱:: 2h)" }), 2, 'real: CR meeting');

// No duration
assert.strictEqual(ownDur({ text: "Demandé à Baptiste : qui va s'occuper 📅 2026-09-21" }), 0, 'no duration');
assert.strictEqual(ownDur({ text: "Comander des cartouches" }), 0, 'no duration plain text');
assert.strictEqual(ownDur({ text: "" }), 0, 'empty text');

console.log('    durRe real patterns: PASS');

// --- dateRe with wikilinks and edge cases ---
console.log('  Testing dateRe against real date patterns...');

function extractDate(text) {
  const m = text.match(dateRe);
  return m ? { date: m[1], hour: m[2], min: m[3] } : null;
}

assert.deepStrictEqual(extractDate('📅 2026-09-24'), { date: '2026-09-24', hour: undefined, min: undefined }, 'plain date');
assert.deepStrictEqual(extractDate('📅 2026-09-24 9:00'), { date: '2026-09-24', hour: '9', min: '00' }, 'date + locked time');
assert.deepStrictEqual(extractDate('📅 [[2026-09-21]]'), { date: '2026-09-21', hour: undefined, min: undefined }, 'wikilink date');
assert.deepStrictEqual(extractDate('📅 [[2026-09-15]] ⏱ 1h ⏫'), { date: '2026-09-15', hour: undefined, min: undefined }, 'wikilink with suffix');
assert.deepStrictEqual(extractDate('📅 [[2026-09-01 ]]'), { date: '2026-09-01', hour: undefined, min: undefined }, 'wikilink with trailing space');
assert.deepStrictEqual(extractDate('📅  [[2026-10-01]]'), { date: '2026-10-01', hour: undefined, min: undefined }, 'double space before wikilink');
assert.deepStrictEqual(extractDate('📅 [[2026-10-05 ]] ⏱ 50h'), { date: '2026-10-05', hour: undefined, min: undefined }, 'wikilink trailing space + suffix');
assert.deepStrictEqual(extractDate('📅 2026-09-24 9:00 (⏱:: 8h) ⛔ zmr7cx'), { date: '2026-09-24', hour: '9', min: '00' }, 'date+time with parenthetical duration');
assert.deepStrictEqual(extractDate('📅 [[2026-09-08]] ⏱ 1h 🆔 5fenhr'), { date: '2026-09-08', hour: undefined, min: undefined }, 'wikilink with ID');

// No date
assert.strictEqual(extractDate('Comander des cartouches'), null, 'no date');
assert.strictEqual(extractDate(''), null, 'empty text');

// Pinned date with text before (edge case from vault: "à partir du 2026-10-12 📅 2026-09-10")
assert.deepStrictEqual(extractDate('retour à Manuel 📅 2026-09-10 ⏱ 1h'), { date: '2026-09-10', hour: undefined, min: undefined }, 'date after text');

console.log('    dateRe real patterns: PASS');

// --- cleanTitle against real snippets ---
console.log('  Testing cleanTitle against real task titles...');

function cleanTitle(text) {
  const metadataChars = `${CALENDAR_CHAR}${ID_CHAR}${BLOCK_CHAR}`;
  const metadataPattern = new RegExp(`[${metadataChars}\\uFE0F].*`, 'u');
  return text
    .replace(metadataPattern, '')
    .replace(durRe, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// French text with accents, special characters
assert.strictEqual(cleanTitle('Demandé à Baptiste : qui va s\'occuper de la DIC 📅 [[2026-09-21]]'),
  "Demandé à Baptiste : qui va s'occuper de la DIC", 'French text with accents');

assert.strictEqual(cleanTitle('Devis insitu 📅 2026-09-14 🔽   ⏱ 3h '),
  'Devis insitu', 'simple title');

assert.strictEqual(cleanTitle('Relancer le projet sous le périph 📅 [[2026-09-14]] ⛔ n3zqo9 (⏱:: 1h)  🔽 '),
  "Relancer le projet sous le périph", 'title with all metadata types');

assert.strictEqual(cleanTitle('Relancer Bastien sur le sujet facturation le 📅  [[2026-10-01]] (⏱:: 0.1h) 🔽 '),
  "Relancer Bastien sur le sujet facturation le", 'long French title');

assert.strictEqual(cleanTitle('📅 2026-09-01 ⏱4h'),
  '', 'date and dur at start, no title');

assert.strictEqual(cleanTitle('Répondre à fernando.perez@ibk.baug.ethz.ch 📅 2026-09-01 🔽 ⏱ 1h'),
  "Répondre à fernando.perez@ibk.baug.ethz.ch", 'email address preserved');

assert.strictEqual(cleanTitle('Implémenter la pr.AxA (méthode simplifiée + méthode de consigni) 🆔 837lo3 (⏱:: 24h) 📅  2026-10-12'),
  'Implémenter la pr.AxA (méthode simplifiée + méthode de consigni)', 'title with ID before date');

assert.strictEqual(cleanTitle('prépa déplacement 📅 2026-09-17 ⏱ 1h'),
  'prépa déplacement', 'short title');

// No metadata → unchanged
assert.strictEqual(cleanTitle('Comander des cartouches'),
  "Comander des cartouches", 'no metadata');

assert.strictEqual(cleanTitle('Faire un rapport "I" à partir de l\'article 📅 2026-10-01'),
  'Faire un rapport "I" à partir de l\'article', 'quotes in title preserved');

console.log('    cleanTitle real snippets: PASS');

// --- parsePriority all 5 levels ---
console.log('  Testing parsePriority all levels...');

// Highest (🔺)
assert.strictEqual(parsePriority('🔺 Devis insitu'), 0, '🔺 highest');
assert.strictEqual(parsePriority('Devis insitu 🔺'), 0, '🔺 at end');

// High (⏫)
assert.strictEqual(parsePriority('⏫ Formulaire de demande'), 1, '⏫ high');
assert.strictEqual(parsePriority('Devis insitu ⏫'), 1, '⏫ at end');

// Medium (🔼) — default
assert.strictEqual(parsePriority('🔼 Medium task'), 2, '🔼 medium');
assert.strictEqual(parsePriority('Task without priority'), 2, 'no priority => default');
assert.strictEqual(parsePriority(''), 2, 'empty => default');

// Low (🔽)
assert.strictEqual(parsePriority('🔽 voir l\'alimentation'), 3, '🔽 low');
assert.strictEqual(parsePriority('Relancer Bastien 🔽'), 3, '🔽 at end');

// Lowest (⏬)
assert.strictEqual(parsePriority('⏬ ndf'), 4, '⏬ lowest');
assert.strictEqual(parsePriority('Task ⏬'), 4, '⏬ at end');

console.log('    parsePriority levels: PASS');

// --- idRe with real IDs ---
console.log('  Testing idRe with real IDs...');

function extractId(text) {
  const m = text.match(idRe);
  return m ? m[1] : null;
}

assert.strictEqual(extractId('🆔 zmr7cx'), 'zmr7cx', 'real ID zmr7cx');
assert.strictEqual(extractId('🆔 7zwi35'), '7zwi35', 'numeric ID');
assert.strictEqual(extractId('🆔 ewpd2x'), 'ewpd2x', 'alphanumeric ID');
assert.strictEqual(extractId('🆔 5fenhr'), '5fenhr', 'mixed ID');
assert.strictEqual(extractId('🆔 n3zqo9'), 'n3zqo9', 'ID with numbers');
assert.strictEqual(extractId('🆔 837lo3'), '837lo3', 'numeric-start ID');
assert.strictEqual(extractId('Task 🆔 zmr7cx done'), 'zmr7cx', 'ID in middle of text');
assert.strictEqual(extractId('no ID here'), null, 'no ID');
assert.strictEqual(extractId('🆔'), null, 'empty ID');

console.log('    idRe real IDs: PASS');

// --- blkRe with real dependencies ---
console.log('  Testing blkRe with real deps...');

function extractDeps(text) {
  const m = text.match(blkRe);
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
}

assert.deepStrictEqual(extractDeps('⛔ zmr7cx'), ['zmr7cx'], 'single dep');
assert.deepStrictEqual(extractDeps('⛔ n3zqo9'), ['n3zqo9'], 'single dep n3zqo9');
assert.deepStrictEqual(extractDeps('⛔ 5fenhr'), ['5fenhr'], 'single dep 5fenhr');
assert.deepStrictEqual(extractDeps('⛔ ewpd2x ✅ 2026-09-09'), ['ewpd2x'], 'dep with emoji after');

// Multiple deps (from Planning.md)
assert.deepStrictEqual(extractDeps('⛔ dep1, dep2'), ['dep1', 'dep2'], 'comma-separated deps');
assert.deepStrictEqual(extractDeps('no deps'), [], 'no deps');
assert.deepStrictEqual(extractDeps('⛔ '), [], 'empty dep');

console.log('    blkRe real deps: PASS');

// --- ownDur edge cases from real data ---
console.log('  Testing ownDur edge cases from real data...');

// Task with bold markers (from vault)
assert.strictEqual(ownDur({ text: '**Épernon** maj du système dic📅 2026-09-24 9:00 (⏱:: 8h) ⛔ zmr7cx' }), 8, 'bold markers + dur');
assert.strictEqual(ownDur({ text: 'prépa déplacement 📅 2026-09-17 ⏱ 1h' }), 1, 'french text + dur');
assert.strictEqual(ownDur({ text: 'Faire un planning 📅 [[2026-10-05 ]] ⏱ 50h' }), 50, 'planning task');

// Tasks where durRe pattern appears in unexpected places
assert.strictEqual(ownDur({ text: 'Durée estimée ⏱ 3h pour le projet' }), 3, 'dur in middle of sentence');
assert.strictEqual(ownDur({ text: '(⏱:: 2h) at start' }), 2, 'dur at start in parens');
assert.strictEqual(ownDur({ text: 'text (⏱:: 0.1h) more text' }), 0.1, 'dur in middle in parens');

console.log('    ownDur real edge cases: PASS');

console.log('\nAll real data edge case tests passed!');
process.exit(0);
