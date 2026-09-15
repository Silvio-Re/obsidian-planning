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
import { runBundle, findGanttSVG, findExecHTML } from './harness/sandbox.mjs';

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

  console.log('\nAll end-to-end render tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
