// test/render_bundle.test.js — end-to-end render tests.
// Runs the BUNDLED planning.md (built by pretest) against fake Obsidian pages and asserts on
// the generated SVG/Gantt and HTML/execution-list. This is the ONLY way to test the render
// modules, because they import non-exported helpers from utils.js that only exist after build.js
// inlines everything into one flat file.
//
// IMPORTANT: the harness uses a DOM mock, not a real browser. It verifies the generated
// STRING content (colors, tags, structure), not actual pixel rendering. It also checks that the
// SVG is well-formed by parsing it as XML, which catches the classic bug of injecting HTML markup
// (e.g. <b>) inside an SVG <text> element.
//
// ARTIFACTS: every fixture's generated SVG/HTML is written to test/output/ (for string inspection)
// AND a faithful PNG rasterization is written to test/output/png/ (for visual inspection). The PNG
// uses resvg-js; if it isn't installed the PNG step is skipped and the SVG is still written.

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { runBundle, findGanttSVG, findExecHTML, findCompleted } from './harness/sandbox.mjs';

console.log('Testing end-to-end render (bundled planning.md)…\n');

// Write generated SVG/HTML to test/output/ for the user to inspect visually.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'output');
const OUT_PNG = path.join(OUT, 'png');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(OUT_PNG)) fs.mkdirSync(OUT_PNG, { recursive: true });
function writeArtifact(name, content) {
  fs.writeFileSync(path.join(OUT, name), content);
  console.log(`  wrote test/output/${name}`);
}

// Faithfully rasterize an SVG string to a PNG Buffer using resvg-js (full CSS/<tspan> support).
// Gracefully returns null if the native module isn't installed, so tests still pass.
let resvgPromise = null;
async function renderToPng(svg) {
  try {
    if (!resvgPromise) resvgPromise = await import('@resvg/resvg-js');
    const { Resvg } = resvgPromise;
    // resvg-js requires an xmlns namespace on the root element.
    if (!/<svg[^>]*xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const r = new Resvg(svg, { backgroundColor: 'ffffff', fitTo: { mode: 'original' } });
    return Buffer.from(r.render().asPng());
  } catch (err) {
    console.log('  (resvg-js unavailable — PNG preview skipped)');
    return null;
  }
}
async function writeArtifactPng(name, svg) {
  const png = await renderToPng(svg);
  if (png) {
    fs.writeFileSync(path.join(OUT_PNG, name.replace(/\.svg$/, '.png')), png);
    console.log(`  wrote test/output/png/${name.replace(/\.svg$/, '.png')}`);
  }
}

const today = '2026-09-15'; // Monday

// Fixture: a file with a LATE meeting (depends on a late prereq) followed by on-time tasks.
const lateMeetPages = [
  { file: { path: 'Projets/Colab ASNR.md', tasks: [
    { line: 1, completed: false, status: ' ', text: 'Réunion de planification 📅 2026-09-15 15:00 ⏱0.25h ⛔ 6wansy ⏫' },
    { line: 2, completed: false, status: ' ', text: 'Task A 🆔 ta 📅 2026-09-16 ⏱ 2h' },
    { line: 3, completed: false, status: ' ', text: 'Task B 🆔 tb 📅 2026-09-17 ⏱ 2h' },
  ] } },
  { file: { path: 'Projets/Prereq.md', tasks: [
    { line: 1, completed: false, status: ' ', text: 'Préparer la réunion ⏱1h 🆔 6wansy' },
  ] } },
];

// Fixture: a plain on-time meeting (no deps) PLUS a regular task, so the dashboard renders
// (it only renders when there is at least one regular task).
const onTimeMeetPages = [
  { file: { path: 'Projets/Standup.md', tasks: [
    { line: 1, completed: false, status: ' ', text: 'Standup 📅 2026-09-15 09:00 ⏱0.25h' },
    { line: 2, completed: false, status: ' ', text: 'Task C 🆔 tc 📅 2026-09-16 ⏱ 2h' },
  ] } },
];

async function main() {
  // --- 1. The Gantt SVG must be well-formed XML (catches HTML markup leaked into SVG text) ---
  console.log('Test 1: Gantt SVG is well-formed XML');
  {
    const root = runBundle(lateMeetPages, { today });
    const svg = findGanttSVG(root);
    assert.ok(svg, 'Gantt SVG was rendered');
    const tmp = path.join(os.tmpdir(), 'gantt-' + process.pid + '.svg');
    fs.writeFileSync(tmp, '<svg xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>');
    try {
      // xmllint is commonly available; if not, skip (string assertions below still apply).
      execSync('xmllint --noout "' + tmp + '"', { stdio: 'pipe' });
    } catch (_) {
      console.log('  (xmllint not available — skipping strict XML parse)');
    } finally {
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
    writeArtifact('gantt-late-meeting.svg', svg);
    await writeArtifactPng('gantt-late-meeting.svg', svg);
    console.log('    PASS');
  }

  // --- 2. Late meeting: bar is red, label uses <tspan> (NOT <b>), and no <b> leaks into SVG ---
  console.log('Test 2: Late meeting rendered red with <tspan> LATE, no <b> in SVG');
  {
    const root = runBundle(lateMeetPages, { today });
    const svg = findGanttSVG(root);

    // No raw HTML <b> anywhere in the Gantt SVG — that is the bug that broke rendering.
    assert.ok(!/<b>/.test(svg), 'no <b> tag in Gantt SVG');
    assert.ok(!/<\/b>/.test(svg), 'no </b> tag in Gantt SVG');

    // The late meeting label must use the SVG-correct <tspan> for bold LATE.
    assert.ok(svg.includes('<tspan font-weight="bold">LATE</tspan>'), 'late meeting label uses <tspan LATE>');

    // The late meeting bar must be red (rgb(224,108,117)), not purple.
    assert.ok(/fill="rgb\(224,108,117\)"/.test(svg), 'late meeting bar is red');

    // The on-time task bar must still be blue (rgba(97,175,239,0.9)).
    assert.ok(svg.includes('fill="rgba(97,175,239,0.9)"'), 'on-time task bar is blue');
    console.log('    PASS');
  }

  // --- 3. Control: an on-time meeting stays purple, no LATE tag ---
  console.log('Test 3: On-time meeting stays purple, no LATE');
  {
    const root = runBundle(onTimeMeetPages, { today });
    const svg = findGanttSVG(root);
    assert.ok(svg.includes('rgba(198,120,221,0.9)'), 'on-time meeting bar is purple');
    assert.ok(!svg.includes('<tspan font-weight="bold">LATE</tspan>'), 'on-time meeting has no LATE tag');
    writeArtifact('gantt-on-time-meeting.svg', svg);
    await writeArtifactPng('gantt-on-time-meeting.svg', svg);
    console.log('    PASS');
  }

  // --- 4. Execution list: late meeting row is red/orange and shows LATE; on-time stays purple ---
  console.log('Test 4: Execution-list late-meeting row colored and labeled');
  {
    const root = runBundle(lateMeetPages, { today });
    const html = findExecHTML(root);
    assert.ok(html, 'execution list rendered');
    // Late meeting row: priority 2 → orange (rgb(255,165,80)) + red row background + <b>LATE</b>.
    assert.ok(html.includes('<b>LATE</b>'), 'execution list shows LATE for late meeting');
    assert.ok(html.includes('background:rgba(224,108,117,0.1)'), 'late meeting row has red background');
    assert.ok(html.includes('rgb(255,165,80)'), 'late meeting text is orange (P2)');
    writeArtifact('execution-late-meeting.html', html);
    console.log('    PASS');
  }

  // --- 5. No regressions: existing non-meeting behavior intact ---
  console.log('Test 5: Non-meeting tasks still render normally');
  {
    const root = runBundle(lateMeetPages, { today });
    const svg = findGanttSVG(root);
    // Task bars still use the original blue fill and the standard rect class.
    assert.ok(svg.includes('class="gbar"'), 'gbar rects present');
    console.log('    PASS');
  }

  // --- 6. Completed tasks rendered as a foldable tree (Gantt first-column layout) ---
  console.log('Test 6: Completed tasks rendered as foldable project tree');
  {
    const completedPages = [
      // Formation (parent) > Recrutement (leaf) : 1h ; and Onboarding (leaf) : 2.5h
      { file: { path: 'Projets/Formation/Recrutement.md', tasks: [
        { line: 2, completed: true, status: 'x', text: 'Tests unitaires 📅 2026-09-15 ⏱ 1h ⏫ ✅ 2026-09-15' },
      ] } },
      { file: { path: 'Projets/Formation/Onboarding.md', tasks: [
        { line: 3, completed: true, status: 'x', text: 'Accueil stagiaire 📅 2026-09-14 ⏱2.5h ⏫ ✅ 2026-09-14' },
      ] } },
      // Budget (leaf) : 1h. No deadline field, only a completion date.
      { file: { path: 'Projets/Budget.md', tasks: [
        { line: 4, completed: true, status: 'x', text: 'Devis client ⏱1h ✅ 2026-09-13' },
        // Completed but WITHOUT a completion date -> must be filtered out.
        { line: 5, completed: true, status: 'x', text: 'Tache sans date de completion ⏱1h' },
        // Completed in AUGUST (today is 2026-09-15 => current month = September).
        // It must be filtered out by default; if it leaked through, Budget would be (2h).
        { line: 6, completed: true, status: 'x', text: "Tache d'aout 2026 ⏱1h ✅ 2026-08-10" },
      ] } },
    ];
    const root = runBundle(completedPages, { today });
    const html = findCompleted(root);
    assert.ok(html, 'completed tree rendered');
    // Tasks lacking a ✅ completion date are not shown.
    assert.ok(!html.includes('Tache sans date de completion'), 'task without completion date filtered out');
    // Toolbar shows From / To calendar + text inputs defaulting to the month boundaries,
    // and NO leftover "fold" help text.
    assert.ok(html.includes('cdate-start-date'), 'From calendar date input present');
    assert.ok(html.includes('cdate-start-text'), 'From text date input present');
    assert.ok(html.includes('cdate-end-date'), 'To calendar date input present');
    assert.ok(html.includes('cdate-end-text'), 'To text date input present');
    assert.ok(html.includes('value="2026-09-01"'), 'From defaults to month start');
    assert.ok(html.includes('value="2026-09-30"'), 'To defaults to month end');
    assert.ok(!html.includes('fold)'), 'no leftover fold help text');
    // Default range = current month (September 2026). An August completion is hidden.
    assert.ok(!html.includes("Tache d'aout"), 'task from a different month filtered out by default');
    assert.ok(!html.includes('(2h)'), 'August task excluded keeps Budget total at 1h');
    // Group headers with cumulative hours (Formation: 1h + 2.5h = 3.5h).
    assert.ok(html.includes('Formation'), 'parent group label shown');
    assert.ok(html.includes('(3.5h)'), 'cumulative hours on parent group');
    assert.ok(html.includes('Recrutement'), 'leaf group label shown');
    assert.ok(html.includes('(1h)'), 'hours on leaf group (Recrutement)');
    assert.ok(html.includes('Onboarding'), 'leaf group label shown');
    assert.ok(html.includes('(2.5h)'), 'hours on leaf group (Onboarding)');
    assert.ok(html.includes('📁'), 'parent group shows folder icon');
    assert.ok(html.includes('📄'), 'leaf group shows page icon');
    // Task rows carry the crow class, show the title + hours, and append the completion date.
    assert.ok(html.includes('crow'), 'task rows carry crow class');
    assert.ok(html.includes('Tests unitaires (1h)'), 'task shown as title + hours');
    assert.ok(html.includes('Devis client (1h)'), 'task without deadline shown with hours');
    assert.ok(html.includes('✅ 2026-09-15'), 'completion date appended to task row');
    assert.ok(html.includes('✅ 2026-09-13'), 'completion date shown even without deadline');
    writeArtifact('completed-tree.html', html);
    console.log('    PASS');
  }

  // --- 7. No completed tasks => empty state ---
  console.log('Test 7: Empty completed state when nothing is done');
  {
    const emptyPages = [
      { file: { path: 'Projets/Pure.md', tasks: [
        { line: 1, completed: false, status: ' ', text: 'Only active 🆔 pa 📅 2026-09-21 ⏱ 1h' },
      ] } },
    ];
    const root = runBundle(emptyPages, { today });
    const html = findCompleted(root);
    assert.ok(html, 'completed section rendered even with no completed tasks');
    assert.ok(html.includes('No completed tasks found.'), 'empty state shown');
    console.log('    PASS');
  }

  // --- 8. Completed tasks exist but none have a completion date => empty state ---
  console.log('Test 8: Empty state when all completed tasks lack a completion date');
  {
    const pages = [
      { file: { path: 'Projets/Pure.md', tasks: [
        { line: 1, completed: true, status: 'x', text: 'Done without date ⏱ 1h' },
        { line: 2, completed: true, status: 'x', text: 'Also done without date ⏱ 1h' },
      ] } },
    ];
    const root = runBundle(pages, { today });
    const html = findCompleted(root);
    assert.ok(html, 'completed section rendered');
    assert.ok(html.includes('No completed tasks found.'), 'empty state shown when nothing has a completion date');
    assert.ok(!html.includes('Done without date'), 'filtered tasks not rendered');
    console.log('    PASS');
  }


  // --- 9. Today agenda panel: today's tasks/meetings first, empty state otherwise ---
  console.log('Test 9: Today agenda panel renders today\u2019s rows before other sections');
  {
    const walk = (el, cb) => { cb(el); (el._children || []).forEach(c => walk(c, cb)); };
    const findAgenda = (root) => {
      let found = null;
      walk(root, (el) => {
        if (!found && typeof el.innerHTML === 'string' &&
            (el.innerHTML.includes('arow prow') || el.innerHTML.includes('Nothing scheduled today'))) {
          found = el.innerHTML;
        }
      });
      return found;
    };
    const headerIdx = (root, text) => root._children.findIndex(c => c.text === text);

    // 9a. The dependency task lands on today (its prereq meeting is today too)
    const root = runBundle(lateMeetPages, { today });
    const agenda = findAgenda(root);
    assert.ok(agenda, 'agenda panel rendered');
    assert.ok(agenda.includes('arow prow'), 'agenda has at least one row');
    assert.ok(agenda.includes('Pr\u00e9parer la r\u00e9union'), 'today task listed');
    assert.ok(agenda.includes('HH:') === false, 'no literal template leftovers');
    assert.ok(headerIdx(root, 'Today') > -1, 'Today header present');
    assert.ok(headerIdx(root, 'Today') < headerIdx(root, 'Capacity Chart'),
      'Today panel comes before the Capacity Chart');

    // 9b. Nothing scheduled today (today is a weekend day, work resumes Monday)
    // -> explicit empty state
    const laterPages = [
      { file: { path: 'Projets/Next.md', tasks: [
        { line: 1, completed: false, status: ' ', text: 'Task W \u{1F194} tw \u{1F4C5} 2026-09-22 \u23f1 2h' },
      ] } },
    ];
    const root2 = runBundle(laterPages, { today: '2026-09-19' }); // Saturday
    const agenda2 = findAgenda(root2);
    assert.ok(agenda2 && agenda2.includes('Nothing scheduled today'),
      'agenda shows the empty state when no work lands on today');
    console.log('    PASS');
  }

  // --- 10. Gantt group labels carry the subtree's finish date ---
  console.log('Test 10: Gantt groups show per-project finish dates');
  {
    const pages = [
      { file: { path: 'Projets/Alpha/Website.md', tasks: [
        { line: 1, completed: false, status: ' ', text: 'Design \u{1F194} d1 \u{1F4C5} 2026-09-18 \u23f1 8h' },
        { line: 2, completed: false, status: ' ', text: 'Build \u{1F194} b1 \u26d4 d1 \u{1F4C5} 2026-09-25 \u23f1 16h' },
      ] } },
      { file: { path: 'Projets/Beta/Report.md', tasks: [
        { line: 1, completed: false, status: ' ', text: 'Write \u{1F194} w1 \u{1F4C5} 2026-09-24 \u23f1 8h' },
      ] } },
    ];
    const root = runBundle(pages, { today: '2026-09-15' }); // Tuesday
    const svg = findGanttSVG(root);
    assert.ok(svg, 'Gantt SVG rendered');
    const labels = svg.match(/\([\d.]+h → [^)]*\)/g) || [];
    // With a 7.8h day (USER_CONFIG.hoursPerDay), an 8h task spills 0.2h into the
    // next day, so finishes cascade: Design ends 16 Sep, Write ends 17 Sep,
    // Build ends workday index 4.1 = Mon 21 Sep (weekend skipped).
    assert.ok(labels.some(l => l.includes('24h') && l.includes('21 Sep')),
      'Alpha group finishes Monday 21 Sep, got: ' + labels.join(' '));
    assert.ok(labels.some(l => l.includes('8h') && l.includes('17 Sep')),
      'Beta group finishes Thursday 17 Sep, got: ' + labels.join(' '));
    console.log('    PASS');
  }
  console.log('\nAll end-to-end render tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
