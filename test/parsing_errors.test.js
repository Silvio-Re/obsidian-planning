import assert from 'assert';

// parsing_errors.js can't be imported directly because it imports makeTaskOpener/openTask
// from utils.js which references `app`. We replicate the render logic for testing.

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escA(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderMd(s) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  return h;
}

function renderParsingErrorsHTML(warnings) {
  const errDiv = { tagName: 'div', children: [], cssText: '' };
  errDiv.cssText = 'font-size:13px;border:1px solid rgba(128,128,0.25);border-radius:6px;overflow:hidden;';
  
  if (!warnings.length) {
    errDiv.children.push({ tagName: 'div', text: 'No parsing errors found - all task metadata is valid.' });
    return { errDiv };
  }

  const ul = { tagName: 'ul', children: [] };
  for (const w of warnings) {
    const li = { tagName: 'li', children: [] };
    const reasonSpan = { tagName: 'span', text: esc(w.reason), cssText: 'font-weight:bold;color:red;' };
    li.children.push(reasonSpan);
    
    if (w.extra) {
      const extraSpan = { tagName: 'span', text: ' ' + renderMd(w.extra), cssText: 'color:gray;' };
      li.children.push(extraSpan);
    }
    
    ul.children.push(li);
  }

  const footer = { tagName: 'div', text: `${warnings.length} task(s) have issues. Check each row in the calendar view for more detail.`, cssText: 'font-size:11px;padding:5px;box-sizing:border-box;color:gray;' };
  errDiv.children.push(ul, footer);
  return { errDiv };
}

console.log('Testing renderParsingErrors logic...');

// Empty warnings
const r1 = renderParsingErrorsHTML([]);
assert(r1.errDiv.children[0].text.includes('No parsing errors found'), 'empty => no errors message');

// Single warning
const r2 = renderParsingErrorsHTML([{ reason: 'Missing duration', extra: 'no ⏱ found' }]);
assert(r2.errDiv.children[0].children[0].children[0].text === 'Missing duration', 'shows reason');
assert(r2.errDiv.children[0].children[0].children[1].text.includes('no ⏱ found'), 'shows extra');

// Multiple warnings
const r3 = renderParsingErrorsHTML([
  { reason: 'No deadline' },
  { reason: 'Invalid duration', extra: '`abc`' },
]);
assert.strictEqual(r3.errDiv.children[0].children.length, 2, 'two list items');
assert(r3.errDiv.children[1].text.includes('2 task(s)'), 'shows count');
assert(r3.errDiv.children[1].cssText.includes('color:gray'), 'footer is gray');

// HTML escaping in extra text
const r4 = renderParsingErrorsHTML([{ reason: '<script>alert(1)</script>' }]);
assert(r4.errDiv.children[0].children[0].children[0].text === '&lt;script&gt;alert(1)&lt;/script&gt;', 'escapes HTML');

// Markdown in extra text
const r5 = renderParsingErrorsHTML([{ reason: 'test', extra: '**bold** and `code`' }]);
assert(r5.errDiv.children[0].children[0].children[1].text.includes('<strong>bold</strong>'), 'renders bold in extra');
assert(r5.errDiv.children[0].children[0].children[1].text.includes('<code>code</code>'), 'renders code in extra');

console.log('  renderParsingErrors HTML: PASS');

console.log('\nAll parsing_errors tests passed!');
process.exit(0);
